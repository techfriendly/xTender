#!/usr/bin/env python3
"""Import official CPV 2008 codes from TED/SIMAP and optionally index them in Milvus."""

from __future__ import annotations

import argparse
import io
import json
import os
import subprocess
import tempfile
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

import requests
from pymilvus import DataType, MilvusClient


ROOT = Path(__file__).resolve().parents[1]
SOURCE_URL = "https://ted.europa.eu/documents/d/ted/cpv_2008_xml"
DEFAULT_OUTPUT = ROOT / "data" / "cpv" / "cpv_2008_main.json"
DEFAULT_COLLECTION = "cpv_codes_v1"
DEFAULT_DIMENSION = 1024


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


def download_xml(url: str) -> bytes:
    response = requests.get(url, headers={"User-Agent": "xTender CPV importer"}, timeout=90)
    response.raise_for_status()
    return xml_from_zip(response.content)


def xml_from_zip(data: bytes) -> bytes:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as bundle:
            return bundle.read("cpv_2008.xml")
    except NotImplementedError:
        with tempfile.NamedTemporaryFile(suffix=".zip") as archive:
            archive.write(data)
            archive.flush()
            completed = subprocess.run(["unzip", "-p", archive.name, "cpv_2008.xml"], check=True, capture_output=True)
            return completed.stdout


def parse_catalog(xml_bytes: bytes) -> list[dict[str, Any]]:
    root = ET.fromstring(xml_bytes)
    items: list[dict[str, Any]] = []
    for node in root.findall("CPV"):
        code = node.attrib.get("CODE", "")
        labels = {child.attrib.get("LANG", "").lower(): (child.text or "").strip() for child in node.findall("TEXT")}
        label_es = labels.get("es") or labels.get("en") or ""
        label_en = labels.get("en") or label_es
        items.append(
            {
                "code": code,
                "code8": "".join(ch for ch in code if ch.isdigit())[:8],
                "label_es": label_es,
                "label_en": label_en,
                "level": cpv_level(code),
                "source": "TED/SIMAP CPV 2008",
            }
        )
    return items


def cpv_level(code: str) -> str:
    digits = "".join(ch for ch in code if ch.isdigit())[:8]
    if len(digits) < 8:
        return "unknown"
    if digits[2:] == "000000":
        return "division"
    if digits[3:] == "00000":
        return "group"
    if digits[4:] == "0000":
        return "class"
    if digits[5:] == "000":
        return "category"
    return "item"


def write_catalog(items: list[dict[str, Any]], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source_url": SOURCE_URL,
        "source_name": "TED/SIMAP CPV 2008 XML",
        "count": len(items),
        "items": items,
    }
    output.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def milvus_client(values: dict[str, str], uri: str | None, db_name: str | None) -> MilvusClient:
    token = env_value(values, "MILVUS_TOKEN")
    user = env_value(values, "MILVUS_USER")
    password = env_value(values, "MILVUS_PASSWORD")
    kwargs: dict[str, Any] = {"uri": uri or env_value(values, "MILVUS_URI", default="http://127.0.0.1:19530")}
    database = db_name or env_value(values, "MILVUS_DB", default="default")
    if database:
        kwargs["db_name"] = database
    if token:
        kwargs["token"] = token
    elif user and password:
        kwargs["token"] = f"{user}:{password}"
    return MilvusClient(**kwargs)


def ensure_collection(client: MilvusClient, collection: str, dimension: int) -> None:
    if client.has_collection(collection):
        return
    schema = MilvusClient.create_schema(auto_id=False, enable_dynamic_field=False)
    schema.add_field("cpv_id", DataType.VARCHAR, is_primary=True, max_length=32)
    schema.add_field("code", DataType.VARCHAR, max_length=16)
    schema.add_field("code8", DataType.VARCHAR, max_length=8)
    schema.add_field("label_es", DataType.VARCHAR, max_length=512)
    schema.add_field("label_en", DataType.VARCHAR, max_length=512)
    schema.add_field("level", DataType.VARCHAR, max_length=32)
    schema.add_field("source", DataType.VARCHAR, max_length=64)
    schema.add_field("search_text", DataType.VARCHAR, max_length=2048)
    schema.add_field("dense_vector", DataType.FLOAT_VECTOR, dim=dimension)
    schema.add_field("sparse_vector", DataType.SPARSE_FLOAT_VECTOR)

    index_params = client.prepare_index_params()
    index_params.add_index("dense_vector", index_type="HNSW", metric_type="COSINE", params={"M": 16, "efConstruction": 100})
    index_params.add_index("sparse_vector", index_type="SPARSE_INVERTED_INDEX", metric_type="IP")
    index_params.add_index("code8", index_type="INVERTED")
    index_params.add_index("level", index_type="INVERTED")
    client.create_collection(collection_name=collection, schema=schema, index_params=index_params)


def embed_batch(embedding_api: str, texts: list[str], timeout: int) -> list[dict[str, Any]]:
    response = requests.post(
        f"{embedding_api.rstrip('/')}/embed/hybrid",
        json={"texts": texts, "normalize": True},
        timeout=timeout,
    )
    response.raise_for_status()
    return response.json()["items"]


def sparse_to_milvus(value: Any) -> dict[int, float]:
    import hashlib

    if not isinstance(value, dict):
        return {}
    converted: dict[int, float] = {}
    for token, weight in sorted(value.items()):
        digest = hashlib.blake2b(str(token).encode(), digest_size=8).digest()
        converted[int.from_bytes(digest, "big") % 1_000_000_000] = float(weight)
    return converted


def index_milvus(
    items: list[dict[str, Any]],
    *,
    env: dict[str, str],
    uri: str | None,
    db_name: str | None,
    collection: str,
    embedding_api: str,
    batch_size: int,
    timeout: int,
) -> int:
    client = milvus_client(env, uri, db_name)
    ensure_collection(client, collection, DEFAULT_DIMENSION)
    inserted = 0
    for offset in range(0, len(items), batch_size):
        batch = items[offset : offset + batch_size]
        texts = [search_text(item) for item in batch]
        embeddings = embed_batch(embedding_api, texts, timeout)
        rows = [
            {
                "cpv_id": item["code"],
                "code": item["code"],
                "code8": item["code8"],
                "label_es": item["label_es"][:500],
                "label_en": item["label_en"][:500],
                "level": item["level"],
                "source": item["source"],
                "search_text": text[:2000],
                "dense_vector": embedding["dense_vector"],
                "sparse_vector": sparse_to_milvus(embedding.get("sparse_vector")),
            }
            for item, text, embedding in zip(batch, texts, embeddings)
        ]
        client.upsert(collection_name=collection, data=rows)
        inserted += len(rows)
    client.flush(collection)
    client.load_collection(collection)
    return inserted


def search_text(item: dict[str, Any]) -> str:
    return f"{item['code']} {item['label_es']} {item['label_en']} CPV contratación pública public procurement"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--env", default=".env.local")
    parser.add_argument("--source-url", default=SOURCE_URL)
    parser.add_argument("--input-zip")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    parser.add_argument("--index-milvus", action="store_true")
    parser.add_argument("--uri")
    parser.add_argument("--db")
    parser.add_argument("--collection", default=DEFAULT_COLLECTION)
    parser.add_argument("--embedding-api")
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--timeout", type=int, default=120)
    args = parser.parse_args()

    env = load_env(Path(args.env) if args.env else None)
    xml_bytes = xml_from_zip(Path(args.input_zip).read_bytes()) if args.input_zip else download_xml(args.source_url)
    items = parse_catalog(xml_bytes)
    output = Path(args.output)
    write_catalog(items, output)
    result: dict[str, Any] = {"source_url": args.source_url, "output": str(output), "items": len(items)}
    if args.index_milvus:
        embedding_api = args.embedding_api or env_value(env, "EMBEDDING_API_URL", default="http://127.0.0.1:8010")
        if embedding_api.startswith("http://embedding-api"):
            embedding_api = "http://127.0.0.1:8010"
        result["indexed"] = index_milvus(
            items,
            env=env,
            uri=args.uri,
            db_name=args.db,
            collection=args.collection,
            embedding_api=embedding_api,
            batch_size=args.batch_size,
            timeout=args.timeout,
        )
        result["collection"] = args.collection
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
