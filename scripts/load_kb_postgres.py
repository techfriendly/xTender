#!/usr/bin/env python3
"""Load the real PCSP knowledge base into PostgreSQL."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

import psycopg2
from psycopg2.extras import Json, execute_values


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DSN = "postgresql://procureai:procureai@127.0.0.1:55432/procureai"
SCHEMA_FILES = [
    ROOT / "infra" / "postgres" / "001_procureai_schema.sql",
    ROOT / "infra" / "postgres" / "002_kb_schema.sql",
    ROOT / "infra" / "postgres" / "003_elicit_runtime.sql",
]


def load_env(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        text = line.strip()
        if not text or text.startswith("#") or "=" not in text:
            continue
        key, value = text.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def dsn_from_env(env_file: Path | None) -> str:
    values = load_env(env_file) if env_file else {}
    return os.environ.get("POSTGRES_DSN") or values.get("POSTGRES_DSN") or DEFAULT_DSN


def apply_schema(connection) -> None:
    with connection.cursor() as cursor:
        for schema_file in SCHEMA_FILES:
            cursor.execute(schema_file.read_text(encoding="utf-8"))
    connection.commit()


def tender_id(tender: dict[str, Any]) -> str:
    return tender.get("id") or tender.get("tender_id") or tender.get("expediente") or tender["atom_id"]


def load_kb(connection, kb_path: Path) -> dict[str, int]:
    kb = json.loads(kb_path.read_text(encoding="utf-8"))
    tenders = kb.get("tenders", [])
    documents = kb.get("documents", [])
    chunks = kb.get("chunks", [])

    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO kb_imports(id, source, generated_at, metadata)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE
              SET source = EXCLUDED.source,
                  generated_at = EXCLUDED.generated_at,
                  imported_at = now(),
                  metadata = EXCLUDED.metadata
            """,
            (
                "pcsp-real-kb",
                kb.get("source") or "PCSP",
                kb.get("generated_at"),
                Json({"source_urls": kb.get("source_urls"), "builder": kb.get("builder")}),
            ),
        )

        if tenders:
            execute_values(
                cursor,
                """
                INSERT INTO kb_tenders(
                  id, atom_id, expediente, title, updated_at, status, cpv, contracting_body,
                  contract_uri, technical_uri, legal_uri, estimated_value, budget_without_tax,
                  budget_with_tax, currency, province, locality, source_feed, metadata
                )
                VALUES %s
                ON CONFLICT (id) DO UPDATE SET
                  atom_id = EXCLUDED.atom_id,
                  expediente = EXCLUDED.expediente,
                  title = EXCLUDED.title,
                  updated_at = EXCLUDED.updated_at,
                  status = EXCLUDED.status,
                  cpv = EXCLUDED.cpv,
                  contracting_body = EXCLUDED.contracting_body,
                  contract_uri = EXCLUDED.contract_uri,
                  technical_uri = EXCLUDED.technical_uri,
                  legal_uri = EXCLUDED.legal_uri,
                  estimated_value = EXCLUDED.estimated_value,
                  budget_without_tax = EXCLUDED.budget_without_tax,
                  budget_with_tax = EXCLUDED.budget_with_tax,
                  currency = EXCLUDED.currency,
                  province = EXCLUDED.province,
                  locality = EXCLUDED.locality,
                  source_feed = EXCLUDED.source_feed,
                  metadata = EXCLUDED.metadata
                """,
                [
                    (
                        tender_id(tender),
                        tender["atom_id"],
                        tender.get("expediente"),
                        tender["title"],
                        tender.get("updated_at"),
                        tender.get("status"),
                        tender.get("cpv"),
                        tender.get("contracting_body"),
                        tender.get("contract_uri"),
                        tender.get("technical_uri"),
                        tender.get("legal_uri"),
                        tender.get("estimated_value"),
                        tender.get("budget_without_tax"),
                        tender.get("budget_with_tax"),
                        tender.get("currency"),
                        tender.get("province"),
                        tender.get("locality"),
                        tender.get("source_feed"),
                        Json(tender),
                    )
                    for tender in tenders
                ],
            )

        if documents:
            execute_values(
                cursor,
                """
                INSERT INTO kb_documents(
                  id, tender_id, document_type, title, source_url, markdown_path, content_hash,
                  page_count, indexed_pages, extraction_quality, language, metadata
                )
                VALUES %s
                ON CONFLICT (id) DO UPDATE SET
                  tender_id = EXCLUDED.tender_id,
                  document_type = EXCLUDED.document_type,
                  title = EXCLUDED.title,
                  source_url = EXCLUDED.source_url,
                  markdown_path = EXCLUDED.markdown_path,
                  content_hash = EXCLUDED.content_hash,
                  page_count = EXCLUDED.page_count,
                  indexed_pages = EXCLUDED.indexed_pages,
                  extraction_quality = EXCLUDED.extraction_quality,
                  language = EXCLUDED.language,
                  metadata = EXCLUDED.metadata
                """,
                [
                    (
                        document["document_id"],
                        document["tender_id"],
                        document["document_type"],
                        document["title"],
                        document["source_url"],
                        document["markdown_path"],
                        document["content_hash"],
                        document.get("page_count"),
                        document.get("indexed_pages"),
                        document.get("extraction_quality"),
                        document.get("language", "es"),
                        Json(document),
                    )
                    for document in documents
                ],
            )

        if chunks:
            execute_values(
                cursor,
                """
                INSERT INTO kb_chunks(
                  id, document_id, tender_id, document_type, title, chunk_text, source_url,
                  heading_path, page_start, page_end, cpv_codes, contracting_body,
                  publication_date, language, content_hash, token_count_estimate,
                  chunk_strategy, embedding_model_max_tokens, metadata
                )
                VALUES %s
                ON CONFLICT (id) DO UPDATE SET
                  document_id = EXCLUDED.document_id,
                  tender_id = EXCLUDED.tender_id,
                  document_type = EXCLUDED.document_type,
                  title = EXCLUDED.title,
                  chunk_text = EXCLUDED.chunk_text,
                  source_url = EXCLUDED.source_url,
                  heading_path = EXCLUDED.heading_path,
                  page_start = EXCLUDED.page_start,
                  page_end = EXCLUDED.page_end,
                  cpv_codes = EXCLUDED.cpv_codes,
                  contracting_body = EXCLUDED.contracting_body,
                  publication_date = EXCLUDED.publication_date,
                  language = EXCLUDED.language,
                  content_hash = EXCLUDED.content_hash,
                  token_count_estimate = EXCLUDED.token_count_estimate,
                  chunk_strategy = EXCLUDED.chunk_strategy,
                  embedding_model_max_tokens = EXCLUDED.embedding_model_max_tokens,
                  metadata = EXCLUDED.metadata
                """,
                [
                    (
                        chunk["chunk_id"],
                        chunk["document_id"],
                        chunk["tender_id"],
                        chunk["document_type"],
                        chunk["title"],
                        chunk["chunk_text"],
                        chunk["source_url"],
                        Json(chunk.get("heading_path", [])),
                        chunk.get("page_start"),
                        chunk.get("page_end"),
                        Json(chunk.get("cpv_codes", [])),
                        chunk.get("contracting_body"),
                        chunk.get("publication_date"),
                        chunk.get("language", "es"),
                        chunk["content_hash"],
                        chunk.get("token_count_estimate"),
                        chunk.get("chunk_strategy"),
                        chunk.get("embedding_model_max_tokens"),
                        Json(chunk),
                    )
                    for chunk in chunks
                ],
                page_size=500,
            )
    connection.commit()
    return {"tenders": len(tenders), "documents": len(documents), "chunks": len(chunks)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--env", default=".env.local")
    parser.add_argument("--dsn")
    parser.add_argument("--kb", default="data/kb/kb.json")
    args = parser.parse_args()

    dsn = args.dsn or dsn_from_env(Path(args.env) if args.env else None)
    with psycopg2.connect(dsn) as connection:
        apply_schema(connection)
        result = load_kb(connection, ROOT / args.kb)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
