#!/usr/bin/env python3
"""Index real KB chunks into Milvus.

The JSON/Markdown folder is only an import seed. This script materializes the
retrieval runtime in Milvus with chunk text, source metadata, dense vectors and
sparse vectors generated through the configured BGE-M3-compatible API.
"""

from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
import os
import re
from pathlib import Path
from typing import Any

import requests
from pymilvus import DataType, MilvusClient


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DIMENSION = 1024


def _sparse_vector(text: str) -> dict[str, float]:
    tokens = re.findall(r"[a-zA-Z0-9áéíóúàèòçñüÁÉÍÓÚÀÈÒÇÑÜ]+", text.lower())
    counts = Counter(tokens)
    total = sum(counts.values()) or 1
    return {token: round(count / total, 6) for token, count in counts.items()}


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
    schema.add_field("chunk_id", DataType.VARCHAR, is_primary=True, max_length=256)
    schema.add_field("tenant_id", DataType.VARCHAR, max_length=128)
    schema.add_field("corpus_id", DataType.VARCHAR, max_length=128)
    schema.add_field("document_id", DataType.VARCHAR, max_length=256)
    schema.add_field("document_version_id", DataType.VARCHAR, max_length=256)
    schema.add_field("source_platform", DataType.VARCHAR, max_length=128)
    schema.add_field("source_url", DataType.VARCHAR, max_length=2048)
    schema.add_field("expediente_id", DataType.VARCHAR, max_length=256)
    schema.add_field("contracting_body", DataType.VARCHAR, max_length=512)
    schema.add_field("title", DataType.VARCHAR, max_length=1024)
    schema.add_field("document_type", DataType.VARCHAR, max_length=64)
    schema.add_field("language", DataType.VARCHAR, max_length=16)
    schema.add_field("functional_service", DataType.VARCHAR, max_length=128)
    schema.add_field("cpv_codes_json", DataType.VARCHAR, max_length=512)
    schema.add_field("publication_date", DataType.VARCHAR, max_length=64)
    schema.add_field("page_start", DataType.INT64)
    schema.add_field("page_end", DataType.INT64)
    schema.add_field("heading_path_json", DataType.VARCHAR, max_length=2048)
    schema.add_field("chunk_text", DataType.VARCHAR, max_length=12000)
    schema.add_field("content_hash", DataType.VARCHAR, max_length=128)
    schema.add_field("token_count_estimate", DataType.INT64)
    schema.add_field("chunk_strategy", DataType.VARCHAR, max_length=128)
    schema.add_field("embedding_model_max_tokens", DataType.INT64)
    schema.add_field("extraction_quality", DataType.FLOAT)
    schema.add_field("has_table", DataType.BOOL)
    schema.add_field("has_formula", DataType.BOOL)
    schema.add_field("has_legal_reference", DataType.BOOL)
    schema.add_field("dense_vector", DataType.FLOAT_VECTOR, dim=dimension)
    schema.add_field("sparse_vector", DataType.SPARSE_FLOAT_VECTOR)

    index_params = client.prepare_index_params()
    index_params.add_index("dense_vector", index_type="HNSW", metric_type="COSINE", params={"M": 16, "efConstruction": 100})
    index_params.add_index("sparse_vector", index_type="SPARSE_INVERTED_INDEX", metric_type="IP")
    index_params.add_index("document_type", index_type="INVERTED")
    index_params.add_index("language", index_type="INVERTED")
    client.create_collection(collection_name=collection, schema=schema, index_params=index_params)


def embed_batch(embedding_api: str, texts: list[str], timeout: int) -> list[dict[str, Any]]:
    api_style = os.environ.get("EMBEDDING_API_STYLE", "").strip().lower()
    if api_style in {"openai", "openai_compatible", "vllm"}:
        base_url = embedding_api.rstrip("/")
        endpoint = f"{base_url}/embeddings" if base_url.endswith("/v1") else f"{base_url}/v1/embeddings"
        response = requests.post(
            endpoint,
            json={
                "model": os.environ.get("EMBEDDING_OPENAI_MODEL") or os.environ.get("EMBEDDING_MODEL") or "bge-m3",
                "input": texts,
                "encoding_format": "float",
            },
            timeout=timeout,
        )
        response.raise_for_status()
        payload = response.json()
        data = sorted(payload["data"], key=lambda item: item.get("index", 0))
        return [
            {"dense_vector": [float(value) for value in item["embedding"]], "sparse_vector": _sparse_vector(text)}
            for text, item in zip(texts, data)
        ]

    response = requests.post(
        f"{embedding_api.rstrip('/')}/embed/hybrid",
        json={"texts": texts, "normalize": True},
        timeout=timeout,
    )
    response.raise_for_status()
    return response.json()["items"]


def sparse_to_milvus(value: Any) -> dict[int, float]:
    if not isinstance(value, dict):
        return {}
    converted: dict[int, float] = {}
    for token, weight in sorted(value.items()):
        digest = hashlib.blake2b(str(token).encode(), digest_size=8).digest()
        converted[int.from_bytes(digest, "big") % 1_000_000_000] = float(weight)
    return converted


def has_formula(text: str) -> bool:
    return any(token in text for token in ["=", "%", "IVA", "PBL", "VEC", "€"])


def row_from_chunk(chunk: dict[str, Any], embedding: dict[str, Any]) -> dict[str, Any]:
    text = chunk["chunk_text"][:11000]
    heading_path = chunk.get("heading_path") or []
    cpv_codes = chunk.get("cpv_codes") or []
    return {
        "chunk_id": chunk["chunk_id"],
        "tenant_id": "shared-public-kb",
        "corpus_id": "pcsp-real",
        "document_id": chunk["document_id"],
        "document_version_id": f"{chunk['document_id']}:v1",
        "source_platform": "PCSP",
        "source_url": chunk["source_url"],
        "expediente_id": chunk["tender_id"],
        "contracting_body": (chunk.get("contracting_body") or "")[:500],
        "title": chunk["title"][:1000],
        "document_type": chunk["document_type"],
        "language": chunk.get("language") or "ca",
        "functional_service": "pliegos",
        "cpv_codes_json": json.dumps(cpv_codes, ensure_ascii=False),
        "publication_date": chunk.get("publication_date") or "",
        "page_start": int(chunk.get("page_start") or 0),
        "page_end": int(chunk.get("page_end") or 0),
        "heading_path_json": json.dumps(heading_path, ensure_ascii=False)[:2000],
        "chunk_text": text,
        "content_hash": chunk["content_hash"],
        "token_count_estimate": int(chunk.get("token_count_estimate") or 0),
        "chunk_strategy": (chunk.get("chunk_strategy") or "markdown_section")[:120],
        "embedding_model_max_tokens": int(chunk.get("embedding_model_max_tokens") or 8192),
        "extraction_quality": 0.85,
        "has_table": "|" in text,
        "has_formula": has_formula(text),
        "has_legal_reference": "LCSP" in text or "article" in text.lower() or "art." in text.lower(),
        "dense_vector": embedding["dense_vector"],
        "sparse_vector": sparse_to_milvus(embedding.get("sparse_vector")),
    }


def index_kb(
    client: MilvusClient,
    collection: str,
    kb_path: Path,
    embedding_api: str,
    batch_size: int,
    timeout: int,
    *,
    ensure: bool = True,
    flush: bool = True,
    load: bool = True,
) -> dict[str, int]:
    kb = json.loads(kb_path.read_text(encoding="utf-8"))
    chunks = kb.get("chunks", [])
    if ensure:
        ensure_collection(client, collection, DEFAULT_DIMENSION)

    inserted = 0
    for offset in range(0, len(chunks), batch_size):
        batch = chunks[offset : offset + batch_size]
        embeddings = embed_batch(embedding_api, [chunk["chunk_text"] for chunk in batch], timeout)
        rows = [row_from_chunk(chunk, embedding) for chunk, embedding in zip(batch, embeddings)]
        client.upsert(collection_name=collection, data=rows)
        inserted += len(rows)
    if chunks and flush:
        client.flush(collection)
    if chunks and load:
        client.load_collection(collection)
    return {"chunks": len(chunks), "indexed": inserted}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--env", default=".env.local")
    parser.add_argument("--kb", default="data/kb/kb.json")
    parser.add_argument("--uri")
    parser.add_argument("--db")
    parser.add_argument("--collection")
    parser.add_argument("--embedding-api")
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--timeout", type=int, default=120)
    args = parser.parse_args()

    env = load_env(Path(args.env) if args.env else None)
    client = milvus_client(env, args.uri, args.db)
    collection = args.collection or env_value(env, "MILVUS_COLLECTION", default="kb_chunks_v1")
    embedding_api = args.embedding_api or env_value(env, "EMBEDDING_API_URL", default="http://127.0.0.1:8010")
    result = index_kb(client, collection, ROOT / args.kb, embedding_api, args.batch_size, args.timeout)
    print(json.dumps({"collection": collection, **result}, ensure_ascii=False))


if __name__ == "__main__":
    main()
