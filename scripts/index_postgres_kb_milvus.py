#!/usr/bin/env python3
"""Reindex PostgreSQL KB chunks into Milvus.

Use this when the crawler already persisted tenders/documents/chunks in
PostgreSQL but Milvus was unavailable during ingestion. Vectors are generated
on demand and stored only in Milvus.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import psycopg2
from psycopg2.extras import RealDictCursor

from index_kb_milvus import DEFAULT_DIMENSION, embed_batch, ensure_collection, load_env, milvus_client, row_from_chunk
from load_kb_postgres import dsn_from_env


ROOT = Path(__file__).resolve().parents[1]


def fetch_chunks(connection, document_type: str | None, limit: int | None) -> list[dict[str, Any]]:
    clauses: list[str] = []
    params: list[Any] = []
    if document_type:
        clauses.append("c.document_type = %s")
        params.append(document_type)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    limit_sql = "LIMIT %s" if limit else ""
    if limit:
        params.append(limit)
    with connection.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            f"""
            SELECT
              c.id AS chunk_id,
              c.document_id,
              c.tender_id,
              c.document_type,
              c.title,
              c.chunk_text,
              c.source_url,
              c.heading_path,
              c.page_start,
              c.page_end,
              c.cpv_codes,
              c.contracting_body,
              c.publication_date,
              c.language,
              c.content_hash,
              c.token_count_estimate,
              c.chunk_strategy,
              c.embedding_model_max_tokens
            FROM kb_chunks c
            {where}
            ORDER BY c.document_type, c.document_id, c.id
            {limit_sql}
            """,
            params,
        )
        return [dict(row) for row in cursor.fetchall()]


def normalize_chunk(chunk: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(chunk)
    for key in ("publication_date",):
        value = normalized.get(key)
        if hasattr(value, "isoformat"):
            normalized[key] = value.isoformat()
    for key in ("heading_path", "cpv_codes"):
        value = normalized.get(key)
        if value is None:
            normalized[key] = []
    for key in ("source_url", "contracting_body", "language", "content_hash", "chunk_strategy"):
        if normalized.get(key) is None:
            normalized[key] = ""
    if not normalized.get("title"):
        normalized["title"] = normalized.get("document_id") or "pliego"
    return normalized


def index_postgres_chunks(
    chunks: list[dict[str, Any]],
    *,
    env: dict[str, str],
    uri: str | None,
    db_name: str | None,
    collection: str,
    embedding_api: str,
    batch_size: int,
    timeout: int,
) -> dict[str, int]:
    client = milvus_client(env, uri, db_name)
    ensure_collection(client, collection, DEFAULT_DIMENSION)

    indexed = 0
    for offset in range(0, len(chunks), batch_size):
        batch = [normalize_chunk(chunk) for chunk in chunks[offset : offset + batch_size]]
        embeddings = embed_batch(embedding_api, [str(chunk["chunk_text"]) for chunk in batch], timeout)
        rows = [row_from_chunk(chunk, embedding) for chunk, embedding in zip(batch, embeddings)]
        client.upsert(collection_name=collection, data=rows)
        indexed += len(rows)
        print(json.dumps({"event": "milvus.batch", "indexed": indexed, "total": len(chunks)}, ensure_ascii=False), flush=True)

    if chunks:
        client.flush(collection)
        client.load_collection(collection)
    return {"chunks": len(chunks), "indexed": indexed}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--env", default=".env.local")
    parser.add_argument("--dsn")
    parser.add_argument("--uri")
    parser.add_argument("--db")
    parser.add_argument("--collection")
    parser.add_argument("--embedding-api")
    parser.add_argument("--document-type", choices=["ppt", "pcap"])
    parser.add_argument("--limit", type=int)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--timeout", type=int, default=180)
    args = parser.parse_args()

    env_path = Path(args.env) if args.env else None
    env = load_env(env_path) if env_path else {}
    dsn = args.dsn or dsn_from_env(env_path)
    collection = args.collection or env.get("MILVUS_COLLECTION") or "kb_chunks_v1"
    embedding_api = args.embedding_api or env.get("EMBEDDING_API_URL") or "http://127.0.0.1:8010"

    with psycopg2.connect(dsn) as connection:
        chunks = fetch_chunks(connection, args.document_type, args.limit)

    result = index_postgres_chunks(
        chunks,
        env=env,
        uri=args.uri,
        db_name=args.db,
        collection=collection,
        embedding_api=embedding_api,
        batch_size=args.batch_size,
        timeout=args.timeout,
    )
    print(json.dumps({"collection": collection, **result}, ensure_ascii=False))


if __name__ == "__main__":
    main()
