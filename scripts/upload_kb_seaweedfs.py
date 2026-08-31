#!/usr/bin/env python3
"""Upload KB artifacts to SeaweedFS S3.

`data/kb` is an import seed. Runtime artifacts live in SeaweedFS under stable
keys so PostgreSQL and Milvus can reference complete Markdown/JSON/PDF assets.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

import boto3
from botocore.client import Config


ROOT = Path(__file__).resolve().parents[1]


def load_env(path: Path | None) -> dict[str, str]:
    if not path or not path.exists():
        return {}
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        text = line.strip()
        if not text or text.startswith("#") or "=" not in text:
            continue
        key, value = text.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def env_value(values: dict[str, str], *keys: str, default: str = "") -> str:
    for key in keys:
        candidate = os.environ.get(key) or values.get(key)
        if candidate:
            return candidate
    return default


def s3_client(values: dict[str, str], endpoint: str | None):
    return boto3.client(
        "s3",
        endpoint_url=endpoint or env_value(values, "OBJECT_STORAGE_ENDPOINT", default="http://127.0.0.1:8333"),
        aws_access_key_id=env_value(values, "OBJECT_STORAGE_ACCESS_KEY", "SEAWEEDFS_ACCESS_KEY", default="seaweedfs"),
        aws_secret_access_key=env_value(values, "OBJECT_STORAGE_SECRET_KEY", "SEAWEEDFS_SECRET_KEY", default="change-me"),
        region_name=env_value(values, "OBJECT_STORAGE_REGION", default="eu-west-1"),
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


def ensure_bucket(client, bucket: str) -> None:
    try:
        client.head_bucket(Bucket=bucket)
    except Exception:
        client.create_bucket(Bucket=bucket)


def put_file(client, bucket: str, key: str, path: Path, content_type: str) -> str:
    client.upload_file(
        str(path),
        bucket,
        key,
        ExtraArgs={"ContentType": content_type, "Metadata": {"source": "xtender-kb-import"}},
    )
    return f"s3://{bucket}/{key}"


def upload_kb(client, bucket: str, kb_path: Path, prefix: str) -> dict[str, Any]:
    kb = json.loads(kb_path.read_text(encoding="utf-8"))
    base = kb_path.parent
    uploaded: dict[str, str] = {}

    uploaded["kb_json"] = put_file(client, bucket, f"{prefix}/derived/json/kb.json", kb_path, "application/json")
    for document in kb.get("documents", []):
        document_id = document["document_id"]
        markdown_path = base / document["markdown_path"]
        key = f"{prefix}/derived/md/{document_id}/v1.md"
        uploaded[document_id] = put_file(client, bucket, key, markdown_path, "text/markdown; charset=utf-8")
        document.setdefault("artifact_keys", {})["markdown"] = uploaded[document_id]
        raw_pdf = base / "raw" / f"{document_id}.pdf"
        if raw_pdf.exists():
            pdf_key = f"{prefix}/raw/pdf/pcsp/{document['tender_id']}/{document_id}.pdf"
            document["artifact_keys"]["pdf"] = put_file(client, bucket, pdf_key, raw_pdf, "application/pdf")

    manifest = {
        "source": kb.get("source"),
        "generated_at": kb.get("generated_at"),
        "documents": len(kb.get("documents", [])),
        "chunks": len(kb.get("chunks", [])),
        "uploaded": uploaded,
    }
    manifest_path = base / "seaweedfs-manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    uploaded["manifest"] = put_file(client, bucket, f"{prefix}/manifests/kb-import.json", manifest_path, "application/json")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--env", default=".env.local")
    parser.add_argument("--kb", default="data/kb/kb.json")
    parser.add_argument("--bucket")
    parser.add_argument("--prefix", default="xtender/kb")
    parser.add_argument("--endpoint")
    args = parser.parse_args()

    env = load_env(Path(args.env) if args.env else None)
    bucket = args.bucket or env_value(env, "OBJECT_STORAGE_BUCKET", default="procureai")
    client = s3_client(env, args.endpoint)
    ensure_bucket(client, bucket)
    result = upload_kb(client, bucket, ROOT / args.kb, args.prefix.strip("/"))
    print(json.dumps({"bucket": bucket, "documents": result["documents"], "chunks": result["chunks"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
