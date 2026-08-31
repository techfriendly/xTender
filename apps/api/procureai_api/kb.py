from __future__ import annotations

import json
import math
import os
import re
from collections import Counter
from functools import lru_cache
from pathlib import Path
from typing import Any

import psycopg2
from psycopg2.extras import RealDictCursor

from .config import load_runtime_config
from .models import SearchHit, SourceRef


def repo_root() -> Path:
    configured = os.environ.get("PROCUREAI_REPO_ROOT")
    if configured:
        return Path(configured)
    for parent in Path(__file__).resolve().parents:
        if (parent / "data" / "kb" / "kb.json").exists():
            return parent
    return Path.cwd()


def kb_path() -> Path:
    return repo_root() / "data" / "kb" / "kb.json"


@lru_cache(maxsize=1)
def load_kb() -> dict[str, Any]:
    path = kb_path()
    if not path.exists():
        raise FileNotFoundError(f"Knowledge base not found at {path}. Run scripts/ingest_pcsp_kb.py first.")
    return json.loads(path.read_text(encoding="utf-8"))


def reload_kb() -> dict[str, Any]:
    load_kb.cache_clear()
    return load_kb()


def tenders() -> list[dict[str, Any]]:
    try:
        if not force_json_kb():
            return db_tenders()
    except Exception:
        pass
    return load_kb().get("tenders", [])


def documents() -> list[dict[str, Any]]:
    try:
        if not force_json_kb():
            return db_documents()
    except Exception:
        pass
    return load_kb().get("documents", [])


def chunks() -> list[dict[str, Any]]:
    return load_kb().get("chunks", [])


def document_by_id(document_id: str) -> dict[str, Any] | None:
    return next((document for document in documents() if document_id in {document.get("document_id"), document.get("id")}), None)


def tender_by_id(tender_id: str) -> dict[str, Any] | None:
    return next(
        (
            tender
            for tender in tenders()
            if tender.get("expediente") == tender_id or tender.get("atom_id") == tender_id
        ),
        None,
    )


def markdown_for_document(document_id: str) -> str:
    document = document_by_id(document_id)
    if not document:
        raise KeyError(document_id)
    path = repo_root() / "data" / "kb" / document["markdown_path"]
    return path.read_text(encoding="utf-8")


def force_json_kb() -> bool:
    return os.environ.get("PROCUREAI_FORCE_JSON_KB", "").lower() in {"1", "true", "yes", "on"}


def db_connection():
    if force_json_kb():
        raise RuntimeError("json_kb_forced")
    config = load_runtime_config()
    return psycopg2.connect(config.postgres_dsn, connect_timeout=2, cursor_factory=RealDictCursor)


def db_fetch_all(query: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    with db_connection() as connection, connection.cursor() as cursor:
        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]


def db_fetch_one(query: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
    with db_connection() as connection, connection.cursor() as cursor:
        cursor.execute(query, params)
        row = cursor.fetchone()
        return dict(row) if row else None


def db_ready() -> bool:
    try:
        row = db_fetch_one(
            """
            SELECT
              (SELECT count(*) FROM kb_tenders) AS tenders,
              (SELECT count(*) FROM kb_documents) AS documents,
              (SELECT count(*) FROM kb_chunks) AS chunks
            """
        )
    except Exception:
        return False
    return bool(row and row["tenders"] and row["documents"] and row["chunks"])


def active_backend() -> str:
    return "postgres" if db_ready() else "json_fallback"


def _jsonb_array(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return []


def _normalize_db_document(row: dict[str, Any]) -> dict[str, Any]:
    metadata = row.pop("metadata", {}) or {}
    result = {**metadata, **row}
    result["document_id"] = row["id"]
    result["id"] = row["id"]
    return result


def _normalize_db_tender(row: dict[str, Any]) -> dict[str, Any]:
    metadata = row.pop("metadata", {}) or {}
    result = {**metadata, **row}
    result["id"] = row["id"]
    return result


def db_tenders() -> list[dict[str, Any]]:
    rows = db_fetch_all("SELECT * FROM kb_tenders ORDER BY updated_at DESC NULLS LAST, id")
    return [_normalize_db_tender(row) for row in rows]


def db_documents() -> list[dict[str, Any]]:
    rows = db_fetch_all("SELECT * FROM kb_documents ORDER BY id")
    return [_normalize_db_document(row) for row in rows]


def db_document_by_id(document_id: str) -> dict[str, Any] | None:
    row = db_fetch_one("SELECT * FROM kb_documents WHERE id = %s", (document_id,))
    return _normalize_db_document(row) if row else None


def tokenize(text: str) -> list[str]:
    return re.findall(r"[a-zA-Z0-9áéíóúàèòçñüÁÉÍÓÚÀÈÒÇÑÜ·l]+", str(text).lower())


def bm25_scores(query: str, candidate_chunks: list[dict[str, Any]]) -> list[float]:
    query_terms = tokenize(query)
    if not query_terms or not candidate_chunks:
        return [0.0 for _ in candidate_chunks]
    doc_tokens = [tokenize(chunk.get("chunk_text", "")) for chunk in candidate_chunks]
    doc_lens = [max(1, len(tokens)) for tokens in doc_tokens]
    avg_len = sum(doc_lens) / len(doc_lens)
    doc_freq: Counter[str] = Counter()
    frequencies: list[Counter[str]] = []
    for tokens in doc_tokens:
        freq = Counter(tokens)
        frequencies.append(freq)
        doc_freq.update(freq.keys())

    scores: list[float] = []
    k1 = 1.4
    b = 0.72
    corpus_size = len(candidate_chunks)
    for freq, doc_len in zip(frequencies, doc_lens):
        score = 0.0
        for term in set(query_terms):
            if term not in freq:
                continue
            idf = math.log((corpus_size - doc_freq[term] + 0.5) / (doc_freq[term] + 0.5) + 1.0)
            denominator = freq[term] + k1 * (1 - b + b * doc_len / avg_len)
            score += idf * ((freq[term] * (k1 + 1)) / denominator)
        scores.append(score)
    max_score = max(scores) if scores else 0
    return [round(score / max_score, 4) if max_score else 0.0 for score in scores]


def search(
    query: str,
    *,
    tender_id: str | None = None,
    cpv: str | None = None,
    document_type: str | None = None,
    language: str | None = None,
    top_k: int = 10,
) -> list[SearchHit]:
    try:
        if not force_json_kb():
            hits = db_search(query, tender_id=tender_id, cpv=cpv, document_type=document_type, language=language, top_k=top_k)
            if hits:
                return hits
    except Exception:
        pass
    candidates = [
        chunk
        for chunk in chunks()
        if (not tender_id or chunk.get("tender_id") == tender_id)
        and (not cpv or cpv in chunk.get("cpv_codes", []))
        and (not document_type or chunk.get("document_type") == document_type)
        and (not language or chunk.get("language") == language)
    ]
    scores = bm25_scores(query, candidates)
    ranked = sorted(zip(candidates, scores), key=lambda item: item[1], reverse=True)
    hits: list[SearchHit] = []
    for chunk, score in ranked[:top_k]:
        document = document_by_id(chunk["document_id"]) or {}
        tender = tender_by_id(chunk["tender_id"]) or {}
        why = []
        if chunk.get("document_type"):
            why.append(f"documento {chunk['document_type'].upper()}")
        if chunk.get("cpv_codes"):
            why.append(f"CPV {', '.join(chunk['cpv_codes'])}")
        if tender.get("contracting_body"):
            why.append(str(tender["contracting_body"]))
        if query and score > 0:
            why.append("coincidencia BM25 sobre texto extraido")
        hits.append(
            SearchHit(
                chunk_id=chunk["chunk_id"],
                document_id=chunk["document_id"],
                title=chunk["title"],
                text=chunk["chunk_text"],
                score=score,
                metadata={
                    "tender_id": chunk["tender_id"],
                    "document_type": chunk["document_type"],
                    "language": chunk["language"],
                    "cpv_codes": chunk.get("cpv_codes", []),
                    "contracting_body": chunk.get("contracting_body"),
                    "publication_date": chunk.get("publication_date"),
                    "page_start": chunk.get("page_start"),
                    "page_end": chunk.get("page_end"),
                    "heading_path": chunk.get("heading_path") or [chunk["title"]],
                    "expediente": tender.get("expediente"),
                    "budget_with_tax": tender.get("budget_with_tax"),
                    "budget_without_tax": tender.get("budget_without_tax"),
                    "currency": tender.get("currency"),
                    "markdown_path": document.get("markdown_path"),
                    "token_count_estimate": chunk.get("token_count_estimate"),
                    "chunk_strategy": chunk.get("chunk_strategy"),
                    "embedding_model_max_tokens": chunk.get("embedding_model_max_tokens"),
                },
                source=SourceRef(
                    source_id=chunk["document_id"],
                    title=chunk["title"],
                    url=chunk["source_url"],
                    page=chunk.get("page_start"),
                    section=None,
                    trust="alta",
                ),
                why_similar=why,
            )
        )
    return hits


def db_search(
    query: str,
    *,
    tender_id: str | None = None,
    cpv: str | None = None,
    document_type: str | None = None,
    language: str | None = None,
    top_k: int = 10,
) -> list[SearchHit]:
    text_query = query.strip() or "contrato"
    stopwords = {
        "a", "al", "as", "con", "contratacion", "contratación", "contrato", "contratos", "de", "del", "el", "en", "e", "es",
        "incluyendo", "la", "las", "lo", "los", "o", "para", "por", "publica", "pública", "publico", "público", "que", "se", "servicio",
        "servicios", "su", "sus", "un", "una", "y", "así", "como", "així", "amb", "dels",
    }
    relaxed_terms: list[str] = []
    for term in tokenize(text_query):
        if len(term) < 4 or term in stopwords or term in relaxed_terms:
            continue
        relaxed_terms.append(term)
        if len(relaxed_terms) >= 12:
            break
    # Long natural-language objects rarely repeat every word verbatim. The
    # first indexed pass uses up to four meaningful terms (AND), which retains
    # precision and lets PostgreSQL use the GIN index instead of falling into a
    # broad corpus scan.
    indexed_query = " ".join(relaxed_terms[:4]) or text_query
    filters = [
        "(%s::text IS NULL OR c.tender_id = %s)",
        "(%s::text IS NULL OR c.document_type = %s)",
        "(%s::text IS NULL OR c.language = %s)",
        "(%s::text IS NULL OR c.cpv_codes @> %s::jsonb)",
    ]
    filter_params: list[Any] = [
        tender_id,
        tender_id,
        document_type,
        document_type,
        language,
        language,
        cpv,
        json.dumps([cpv]) if cpv else None,
    ]
    params: list[Any] = [indexed_query, *filter_params, indexed_query, indexed_query, top_k]
    rows = db_fetch_all(
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
          c.embedding_model_max_tokens,
          d.markdown_path,
          d.page_count,
          d.indexed_pages,
          d.extraction_quality,
          t.expediente,
          t.budget_with_tax,
          t.budget_without_tax,
          t.currency,
          ts_rank(c.search_vector, plainto_tsquery('simple', %s)) AS lexical_rank,
          0.0 AS exact_rank
        FROM kb_chunks c
        JOIN kb_documents d ON d.id = c.document_id
        JOIN kb_tenders t ON t.id = c.tender_id
        WHERE {' AND '.join(filters)}
          AND c.search_vector @@ plainto_tsquery('simple', %s)
        ORDER BY ts_rank(c.search_vector, plainto_tsquery('simple', %s)) DESC,
                 c.publication_date DESC NULLS LAST,
                 c.id
        LIMIT %s
        """,
        tuple(params),
    )
    if not rows:
        relaxed_query = " | ".join(relaxed_terms)
        if relaxed_query:
            relaxed_params: list[Any] = [relaxed_query, *filter_params, relaxed_query, relaxed_query, top_k]
            rows = db_fetch_all(
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
                  c.embedding_model_max_tokens,
                  d.markdown_path,
                  d.page_count,
                  d.indexed_pages,
                  d.extraction_quality,
                  t.expediente,
                  t.budget_with_tax,
                  t.budget_without_tax,
                  t.currency,
                  ts_rank(c.search_vector, to_tsquery('simple', %s)) AS lexical_rank,
                  0.0 AS exact_rank
                FROM kb_chunks c
                JOIN kb_documents d ON d.id = c.document_id
                JOIN kb_tenders t ON t.id = c.tender_id
                WHERE {' AND '.join(filters)}
                  AND c.search_vector @@ to_tsquery('simple', %s)
                ORDER BY ts_rank(c.search_vector, to_tsquery('simple', %s)) DESC,
                         c.publication_date DESC NULLS LAST,
                         c.id
                LIMIT %s
                """,
                tuple(relaxed_params),
            )
    if not rows:
        rows = db_fetch_all(
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
              c.embedding_model_max_tokens,
              d.markdown_path,
              d.page_count,
              d.indexed_pages,
              d.extraction_quality,
              t.expediente,
              t.budget_with_tax,
              t.budget_without_tax,
              t.currency,
              0.0 AS lexical_rank,
              0.0 AS exact_rank
            FROM kb_chunks c
            JOIN kb_documents d ON d.id = c.document_id
            JOIN kb_tenders t ON t.id = c.tender_id
            WHERE {' AND '.join(filters)}
            ORDER BY c.publication_date DESC NULLS LAST, c.id
            LIMIT %s
            """,
            tuple(filter_params + [top_k]),
        )
    max_rank = max([float(row.get("lexical_rank") or 0) + float(row.get("exact_rank") or 0) for row in rows] or [0])
    hits: list[SearchHit] = []
    for row in rows:
        raw_score = float(row.get("lexical_rank") or 0) + float(row.get("exact_rank") or 0)
        score = round(raw_score / max_rank, 4) if max_rank else 0.5
        cpv_codes = _jsonb_array(row.get("cpv_codes"))
        heading_path = _jsonb_array(row.get("heading_path")) or [row["title"]]
        why = [f"documento {row['document_type'].upper()}"]
        if cpv_codes:
            why.append(f"CPV {', '.join(cpv_codes)}")
        if row.get("contracting_body"):
            why.append(str(row["contracting_body"]))
        why.append("busqueda textual PostgreSQL con filtros")
        hits.append(
            SearchHit(
                chunk_id=row["chunk_id"],
                document_id=row["document_id"],
                title=row["title"],
                text=row["chunk_text"],
                score=score,
                metadata={
                    "tender_id": row["tender_id"],
                    "document_type": row["document_type"],
                    "language": row["language"],
                    "cpv_codes": cpv_codes,
                    "contracting_body": row.get("contracting_body"),
                    "publication_date": row.get("publication_date").isoformat() if row.get("publication_date") else None,
                    "page_start": row.get("page_start"),
                    "page_end": row.get("page_end"),
                    "heading_path": heading_path,
                    "expediente": row.get("expediente"),
                    "budget_with_tax": float(row["budget_with_tax"]) if row.get("budget_with_tax") is not None else None,
                    "budget_without_tax": float(row["budget_without_tax"]) if row.get("budget_without_tax") is not None else None,
                    "currency": row.get("currency"),
                    "markdown_path": row.get("markdown_path"),
                    "extraction_quality": float(row["extraction_quality"]) if row.get("extraction_quality") is not None else None,
                    "token_count_estimate": row.get("token_count_estimate"),
                    "chunk_strategy": row.get("chunk_strategy"),
                    "embedding_model_max_tokens": row.get("embedding_model_max_tokens"),
                },
                source=SourceRef(
                    source_id=row["document_id"],
                    title=row["title"],
                    url=row["source_url"],
                    page=row.get("page_start"),
                    section=" > ".join(str(item) for item in heading_path) if heading_path else None,
                    trust="alta" if float(row.get("extraction_quality") or 0) >= 0.5 else "media",
                ),
                why_similar=why,
            )
        )
    return hits


def source_rows() -> list[dict[str, Any]]:
    try:
        if not force_json_kb():
            rows = db_fetch_all(
                """
                SELECT
                  d.id AS source_id,
                  d.title,
                  d.source_url AS url,
                  d.document_type AS type,
                  t.updated_at AS date,
                  d.extraction_quality,
                  d.tender_id,
                  t.contracting_body,
                  t.cpv,
                  d.page_count,
                  d.indexed_pages
                FROM kb_documents d
                JOIN kb_tenders t ON t.id = d.tender_id
                ORDER BY t.updated_at DESC NULLS LAST, d.id
                """
            )
            return [
                {
                    "source_id": row["source_id"],
                    "title": row["title"],
                    "url": row["url"],
                    "type": row["type"],
                    "date": row["date"].isoformat() if row.get("date") else None,
                    "usedIn": "knowledge base",
                    "trust": "alta" if float(row.get("extraction_quality") or 0) >= 0.5 else "media",
                    "status": "indexada",
                    "tender_id": row["tender_id"],
                    "contracting_body": row.get("contracting_body"),
                    "cpv": row.get("cpv"),
                    "page_count": row.get("page_count"),
                    "indexed_pages": row.get("indexed_pages"),
                }
                for row in rows
            ]
    except Exception:
        pass
    rows = []
    for document in documents():
        tender = tender_by_id(document["tender_id"]) or {}
        rows.append(
            {
                "source_id": document["document_id"],
                "title": document["title"],
                "url": document["source_url"],
                "type": document["document_type"],
                "date": tender.get("updated_at"),
                "usedIn": "knowledge base",
                "trust": "alta" if document.get("extraction_quality", 0) >= 0.5 else "media",
                "status": "indexada",
                "tender_id": document["tender_id"],
                "contracting_body": tender.get("contracting_body"),
                "cpv": tender.get("cpv"),
                "page_count": document.get("page_count"),
                "indexed_pages": document.get("indexed_pages"),
            }
        )
    return rows


def summary() -> dict[str, Any]:
    try:
        if not force_json_kb():
            row = db_fetch_one(
                """
                SELECT
                  (SELECT count(*) FROM kb_tenders) AS tenders,
                  (SELECT count(*) FROM kb_documents) AS documents,
                  (SELECT count(*) FROM kb_chunks) AS chunks,
                  (SELECT max(generated_at) FROM kb_imports) AS generated_at,
                  (SELECT source FROM kb_imports ORDER BY imported_at DESC LIMIT 1) AS source,
                  (SELECT jsonb_agg(DISTINCT language) FROM kb_chunks WHERE language IS NOT NULL) AS languages,
                  (SELECT jsonb_agg(DISTINCT document_type) FROM kb_documents WHERE document_type IS NOT NULL) AS document_types
                """
            )
            if row and row["documents"]:
                return {
                    "generated_at": row["generated_at"].isoformat() if row.get("generated_at") else None,
                    "source": row.get("source") or "PostgreSQL KB",
                    "source_urls": load_kb().get("source_urls"),
                    "tenders": row["tenders"],
                    "documents": row["documents"],
                    "chunks": row["chunks"],
                    "languages": sorted(row.get("languages") or []),
                    "document_types": sorted(row.get("document_types") or []),
                    "backend": "postgres",
                }
    except Exception:
        pass
    kb = load_kb()
    return {
        "generated_at": kb.get("generated_at"),
        "source": kb.get("source"),
        "source_urls": kb.get("source_urls"),
        "tenders": len(kb.get("tenders", [])),
        "documents": len(kb.get("documents", [])),
        "chunks": len(kb.get("chunks", [])),
        "languages": sorted({chunk.get("language") for chunk in kb.get("chunks", []) if chunk.get("language")}),
        "document_types": sorted({document.get("document_type") for document in kb.get("documents", []) if document.get("document_type")}),
        "backend": "json_fallback",
    }
