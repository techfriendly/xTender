#!/usr/bin/env python3
"""Monthly PCSP backfill worker for PPT/PCAP knowledge base.

The worker downloads the official monthly ATOM ZIP files for the general
platform and aggregated platforms, preserves tender metadata in PostgreSQL,
stores extracted artifacts locally and in SeaweedFS when configured, and
indexes Markdown chunks in Milvus for semantic retrieval.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import tempfile
import time
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock, local
from typing import Any
from urllib.parse import urlparse

import boto3
import psycopg2
import requests
from botocore.exceptions import BotoCoreError, ClientError
from lxml import etree
from psycopg2.extras import Json

from ingest_pcsp_kb import (
    ATOM_NS,
    BGE_M3_MAX_TOKENS,
    USER_AGENT,
    chunk_markdown,
    detect_language,
    estimate_bge_m3_tokens,
    first_text,
    normalize,
    parse_entry,
    pdf_to_markdown,
    slugify,
)
from index_kb_milvus import DEFAULT_DIMENSION, ensure_collection, index_kb, milvus_client
from load_kb_postgres import apply_schema, load_kb


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DSN = "postgresql://procureai:procureai@postgres:5432/procureai"

FEED_ARCHIVES = {
    "s643": {
        "name": "Plataforma general",
        "root": "licitacionesPerfilesContratanteCompleto3.atom",
        "url": "https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_643/licitacionesPerfilesContratanteCompleto3_{ym}.zip",
    },
    "s1044": {
        "name": "Plataformas agregadas",
        "root": "PlataformasAgregadasSinMenores.atom",
        "url": "https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_1044/PlataformasAgregadasSinMenores_{ym}.zip",
    },
}

_THREAD_LOCAL = local()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def env_bool(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def env_int(name: str, default: int) -> int:
    value = os.environ.get(name)
    if not value:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def env_float(name: str, default: float) -> float:
    value = os.environ.get(name)
    if not value:
        return default
    try:
        return float(value)
    except ValueError:
        return default


def env_text(name: str, default: str) -> str:
    return os.environ.get(name) or default


def log_event(event: str, **payload: Any) -> None:
    print(
        json.dumps({"at": utcnow().isoformat(), "event": event, **payload}, ensure_ascii=False),
        flush=True,
    )


def worker_session() -> requests.Session:
    session = getattr(_THREAD_LOCAL, "session", None)
    if session is None:
        session = requests.Session()
        session.headers.update({"User-Agent": USER_AGENT})
        _THREAD_LOCAL.session = session
    return session


def parse_period(period: str) -> tuple[int, int]:
    match = re.fullmatch(r"(\d{4})-(\d{2})", period.strip())
    if not match:
        raise ValueError(f"periodo inválido: {period}")
    year = int(match.group(1))
    month = int(match.group(2))
    if month < 1 or month > 12:
        raise ValueError(f"mes inválido: {period}")
    return year, month


def current_period() -> str:
    now = datetime.now()
    return f"{now.year:04d}-{now.month:02d}"


def iter_periods(start_period: str, end_period: str, order: str) -> list[str]:
    start_year, start_month = parse_period(start_period)
    end_year, end_month = parse_period(end_period)
    periods: list[str] = []
    year, month = start_year, start_month
    while (year, month) <= (end_year, end_month):
        periods.append(f"{year:04d}-{month:02d}")
        month += 1
        if month > 12:
            year += 1
            month = 1
    if order.lower() == "desc":
        periods.reverse()
    return periods


def zip_url(feed_id: str, period: str) -> str:
    year, month = parse_period(period)
    return FEED_ARCHIVES[feed_id]["url"].format(ym=f"{year:04d}{month:02d}")


def local_name(tag: str) -> str:
    if "}" in tag:
        return tag.rsplit("}", 1)[1]
    return tag


def xml_to_metadata(node: etree._Element | None, depth: int = 0) -> Any:
    if node is None:
        return None
    if depth > 14:
        return {"tag": local_name(str(node.tag)), "truncated": True}
    payload: dict[str, Any] = {"tag": local_name(str(node.tag))}
    if node.attrib:
        payload["attributes"] = {local_name(str(key)): value for key, value in node.attrib.items()}
    text = normalize(node.text)
    if text:
        payload["text"] = text
    children = [xml_to_metadata(child, depth + 1) for child in node if isinstance(child.tag, str)]
    if children:
        payload["children"] = children
    return payload


def all_texts(node: etree._Element | None, xpath: str) -> list[str]:
    if node is None:
        return []
    values: list[str] = []
    seen: set[str] = set()
    for item in node.xpath(xpath):
        text = normalize(item.text if isinstance(item, etree._Element) else item)
        if text and text not in seen:
            seen.add(text)
            values.append(text)
    return values


def document_references(cfs: etree._Element | None) -> list[dict[str, Any]]:
    if cfs is None:
        return []
    refs: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    for xml_name, document_type in [
        ("TechnicalDocumentReference", "ppt"),
        ("LegalDocumentReference", "pcap"),
    ]:
        nodes = cfs.xpath(f".//*[local-name()='{xml_name}']")
        for position, node in enumerate(nodes, start=1):
            uri = first_text(node, ".//*[local-name()='URI']/text()")
            if not uri or uri in seen_urls:
                continue
            seen_urls.add(uri)
            refs.append(
                {
                    "document_type": document_type,
                    "url": uri,
                    "position": position,
                    "xml_name": xml_name,
                    "reference_id": first_text(node, "./*[local-name()='ID']/text()"),
                    "document_type_code": first_text(node, ".//*[local-name()='DocumentTypeCode']/text()"),
                    "metadata": xml_to_metadata(node),
                }
            )
    return refs


def entry_metadata(entry: etree._Element, feed_id: str, period: str) -> dict[str, Any]:
    cfs_nodes = entry.xpath(".//*[local-name()='ContractFolderStatus']")
    cfs = cfs_nodes[0] if cfs_nodes else None
    return {
        "source_feed_id": feed_id,
        "source_feed_name": FEED_ARCHIVES[feed_id]["name"],
        "source_period": period,
        "atom": {
            "id": first_text(entry, "./*[local-name()='id']/text()"),
            "title": first_text(entry, "./*[local-name()='title']/text()"),
            "updated": first_text(entry, "./*[local-name()='updated']/text()"),
            "summary": first_text(entry, "./*[local-name()='summary']/text()"),
            "links": [
                {"rel": normalize(link.get("rel")), "href": normalize(link.get("href"))}
                for link in entry.xpath("./atom:link", namespaces={"atom": ATOM_NS})
            ],
        },
        "contract_folder_status": xml_to_metadata(cfs),
        "deadline_date": first_text(
            cfs,
            ".//*[local-name()='TenderingProcess']//*[local-name()='TenderSubmissionDeadlinePeriod']/*[local-name()='EndDate']/text()",
        ),
        "deadline_time": first_text(
            cfs,
            ".//*[local-name()='TenderingProcess']//*[local-name()='TenderSubmissionDeadlinePeriod']/*[local-name()='EndTime']/text()",
        ),
        "contract_type_code": first_text(cfs, ".//*[local-name()='ProcurementProject']/*[local-name()='TypeCode']/text()"),
        "subtype_code": first_text(cfs, ".//*[local-name()='ProcurementProject']/*[local-name()='SubTypeCode']/text()"),
        "procedure_code": first_text(cfs, ".//*[local-name()='TenderingProcess']/*[local-name()='ProcedureCode']/text()"),
        "urgency_code": first_text(cfs, ".//*[local-name()='TenderingProcess']/*[local-name()='UrgencyCode']/text()"),
        "cpv_codes": all_texts(
            cfs,
            ".//*[local-name()='RequiredCommodityClassification']/*[local-name()='ItemClassificationCode']/text()",
        ),
        "document_references": document_references(cfs),
    }


def parse_feed_file(path: Path, feed_id: str, period: str) -> tuple[list[dict[str, Any]], str | None]:
    parser = etree.XMLParser(recover=True, huge_tree=True)
    root = etree.parse(str(path), parser).getroot()
    entries: list[dict[str, Any]] = []
    for entry in root.xpath(".//atom:entry", namespaces={"atom": ATOM_NS}):
        record = parse_entry(entry, feed_id)
        if not record:
            continue
        entries.append({"record": record, "metadata": entry_metadata(entry, feed_id, period)})
    next_links = root.xpath(".//atom:link[@rel='next']", namespaces={"atom": ATOM_NS})
    if not next_links:
        return entries, None
    href = normalize(next_links[0].get("href"))
    return entries, Path(urlparse(href or "").path).name if href else None


def download_month_zip(session: requests.Session, feed_id: str, period: str, timeout: int, runtime_dir: Path) -> Path | None:
    url = zip_url(feed_id, period)
    target = runtime_dir / "archives" / feed_id / f"{period}.zip"
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and target.stat().st_size > 0:
        log_event("pcsp.month_zip.cached", feed_id=feed_id, period=period, path=str(target))
        return target
    log_event("pcsp.month_zip.download.start", feed_id=feed_id, period=period, url=url)
    response = session.get(url, timeout=timeout)
    if response.status_code == 404:
        log_event("pcsp.month_zip.not_found", feed_id=feed_id, period=period, url=url)
        return None
    response.raise_for_status()
    target.write_bytes(response.content)
    log_event("pcsp.month_zip.download.done", feed_id=feed_id, period=period, bytes=len(response.content))
    return target


def extract_zip(zip_path: Path) -> Path:
    target = Path(tempfile.mkdtemp(prefix="pcsp_month_"))
    with zipfile.ZipFile(zip_path) as archive:
        archive.extractall(target)
    return target


def find_zip_member(root: Path, name: str) -> Path | None:
    direct = root / name
    if direct.exists():
        return direct
    matches = list(root.rglob(name))
    return matches[0] if matches else None


def collect_month_entries(zip_path: Path, feed_id: str, period: str) -> list[dict[str, Any]]:
    extracted = extract_zip(zip_path)
    try:
        root_name = FEED_ARCHIVES[feed_id]["root"]
        current = find_zip_member(extracted, root_name)
        if current is None:
            raise FileNotFoundError(f"no se encuentra {root_name} en {zip_path.name}")
        entries: list[dict[str, Any]] = []
        seen_pages: set[Path] = set()
        while current and current not in seen_pages:
            seen_pages.add(current)
            page_entries, next_name = parse_feed_file(current, feed_id, period)
            entries.extend(page_entries)
            current = find_zip_member(extracted, next_name) if next_name else None
        return entries
    finally:
        shutil.rmtree(extracted, ignore_errors=True)


def stable_tender_id(record: Any) -> str:
    base = record.expediente or record.atom_id
    digest = hashlib.sha1(record.atom_id.encode("utf-8")).hexdigest()[:8]
    return f"{slugify(base)}-{digest}"


def stable_document_id(tender_id: str, document_type: str, position: int) -> str:
    suffix = document_type if position <= 1 else f"{document_type}-{position:02d}"
    return f"{tender_id}-{suffix}"


def selected_document_references(entry: dict[str, Any], document_types: list[str]) -> list[dict[str, Any]]:
    return [
        ref
        for ref in (entry["metadata"].get("document_references") or [])
        if ref.get("document_type") in document_types
    ]


def document_ids_for_entry(entry: dict[str, Any], document_types: list[str]) -> list[str]:
    record = entry["record"]
    tender_id = stable_tender_id(record)
    ids: list[str] = []
    for ref in selected_document_references(entry, document_types):
        ids.append(stable_document_id(tender_id, str(ref["document_type"]), int(ref.get("position") or 1)))
    return ids


def existing_document_ids(connection, document_ids: list[str]) -> set[str]:
    ids = list(dict.fromkeys(document_ids))
    if not ids:
        return set()
    existing: set[str] = set()
    with connection.cursor() as cursor:
        for offset in range(0, len(ids), 2000):
            batch = ids[offset : offset + 2000]
            cursor.execute("SELECT id FROM kb_documents WHERE id = ANY(%s)", (batch,))
            existing.update(row[0] for row in cursor.fetchall())
    return existing


def download_document_pdf(session: requests.Session, url: str, timeout: int) -> tuple[bytes, dict[str, Any]]:
    response = session.get(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/pdf, application/zip, application/octet-stream, */*",
        },
        timeout=timeout,
    )
    response.raise_for_status()
    content = response.content
    content_type = response.headers.get("content-type", "")
    if content.startswith(b"%PDF"):
        return content, {"download_content_type": content_type, "download_kind": "pdf"}
    if content.startswith(b"PK") or "zip" in content_type.lower():
        with tempfile.NamedTemporaryFile(suffix=".zip") as handle:
            handle.write(content)
            handle.flush()
            with zipfile.ZipFile(handle.name) as archive:
                pdf_names = sorted(name for name in archive.namelist() if name.lower().endswith(".pdf"))
                if not pdf_names:
                    raise ValueError("el ZIP no contiene PDF")
                target = pdf_names[0]
                return archive.read(target), {
                    "download_content_type": content_type,
                    "download_kind": "zip",
                    "archive_pdf": target,
                    "archive_pdf_count": len(pdf_names),
                }
    raise ValueError(f"respuesta no PDF/ZIP: {content_type or 'sin content-type'}")


class ObjectStore:
    def __init__(self, enabled: bool) -> None:
        self.enabled = enabled
        self.bucket = os.environ.get("OBJECT_STORAGE_BUCKET", "procureai")
        self.client = None
        if not enabled:
            return
        endpoint = os.environ.get("OBJECT_STORAGE_ENDPOINT")
        access_key = os.environ.get("OBJECT_STORAGE_ACCESS_KEY")
        secret_key = os.environ.get("OBJECT_STORAGE_SECRET_KEY")
        if not endpoint or not access_key or not secret_key:
            self.enabled = False
            return
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=os.environ.get("OBJECT_STORAGE_REGION", "eu-west-1"),
        )
        try:
            self._ensure_bucket()
        except (BotoCoreError, ClientError):
            self.enabled = False
            self.client = None

    def _ensure_bucket(self) -> None:
        if not self.client:
            return
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except ClientError:
            self.client.create_bucket(Bucket=self.bucket)

    def put(self, key: str, body: bytes, content_type: str) -> str | None:
        if not self.enabled or not self.client:
            return None
        try:
            self.client.put_object(Bucket=self.bucket, Key=key, Body=body, ContentType=content_type)
            return key
        except (BotoCoreError, ClientError):
            self.enabled = False
            return None


def artifact_key(feed_id: str, period: str, tender_id: str, document_id: str, suffix: str) -> str:
    return f"pcsp/{feed_id}/{period}/{tender_id}/{document_id}.{suffix}"


def record_ingest_error(
    connection,
    *,
    feed_id: str,
    period: str,
    tender_id: str,
    expediente: str | None,
    document_type: str,
    source_url: str,
    error: str,
    metadata: dict[str, Any],
) -> None:
    error_id = hashlib.sha1(f"{feed_id}:{period}:{tender_id}:{document_type}:{source_url}:{error}".encode("utf-8")).hexdigest()
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO kb_document_ingest_errors(id, feed_id, period, tender_id, expediente, document_type, source_url, error, metadata)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
              error = EXCLUDED.error,
              created_at = now(),
              metadata = EXCLUDED.metadata
            """,
            (error_id, feed_id, period, tender_id, expediente, document_type, source_url, error[:2000], Json(metadata)),
        )
    connection.commit()


def tender_payload(entry: dict[str, Any]) -> dict[str, Any]:
    record = entry["record"]
    payload = asdict(record)
    payload["id"] = stable_tender_id(record)
    payload["metadata"] = entry["metadata"]
    cpv_codes = entry["metadata"].get("cpv_codes") or []
    if cpv_codes and not payload.get("cpv"):
        payload["cpv"] = cpv_codes[0]
    return payload


def build_document_payloads(
    session: requests.Session,
    storage: ObjectStore,
    storage_lock: Lock,
    entry: dict[str, Any],
    *,
    feed_id: str,
    period: str,
    runtime_dir: Path,
    args: argparse.Namespace,
    known_document_ids: set[str],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], int, list[dict[str, Any]]]:
    record = entry["record"]
    tender_id = stable_tender_id(record)
    references = selected_document_references(entry, args.document_types)
    if not references:
        return [], [], 0, []

    raw_dir = runtime_dir / "raw" / feed_id / period
    markdown_dir = runtime_dir / "markdown" / feed_id / period
    raw_dir.mkdir(parents=True, exist_ok=True)
    markdown_dir.mkdir(parents=True, exist_ok=True)

    documents: list[dict[str, Any]] = []
    chunks: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    skipped_existing = 0
    for ref in references:
        document_type = str(ref["document_type"])
        position = int(ref.get("position") or 1)
        source_url = str(ref["url"])
        document_id = stable_document_id(tender_id, document_type, position)
        if document_id in known_document_ids and not args.force:
            skipped_existing += 1
            continue
        try:
            pdf_bytes, download_metadata = download_document_pdf(session, source_url, args.timeout)
            markdown, page_count = pdf_to_markdown(pdf_bytes, max_pages=args.max_doc_pages)
            markdown = markdown.strip()
            if len(markdown) < args.min_chars:
                raise ValueError(f"extracción demasiado corta ({len(markdown)} caracteres)")
        except Exception as exc:
            errors.append(
                {
                    "feed_id": feed_id,
                    "period": period,
                    "tender_id": tender_id,
                    "expediente": record.expediente,
                    "document_type": document_type,
                    "source_url": source_url,
                    "error": str(exc),
                    "metadata": {"reference": ref},
                }
            )
            continue

        raw_path = raw_dir / f"{document_id}.pdf"
        markdown_path = markdown_dir / f"{document_id}.md"
        raw_path.write_bytes(pdf_bytes)
        markdown_path.write_text(markdown, encoding="utf-8")
        with storage_lock:
            raw_key = storage.put(
                artifact_key(feed_id, period, tender_id, document_id, "pdf"),
                pdf_bytes,
                "application/pdf",
            )
            markdown_key = storage.put(
                artifact_key(feed_id, period, tender_id, document_id, "md"),
                markdown.encode("utf-8"),
                "text/markdown; charset=utf-8",
            )

        content_hash = hashlib.sha256(markdown.encode("utf-8")).hexdigest()
        language = detect_language(markdown)
        title = f"{document_type.upper()} - {record.title}"
        document = {
            "document_id": document_id,
            "tender_id": tender_id,
            "document_type": document_type,
            "title": title,
            "source_url": source_url,
            "markdown_path": str(markdown_path.relative_to(runtime_dir)),
            "content_hash": content_hash,
            "page_count": page_count,
            "indexed_pages": min(page_count, args.max_doc_pages),
            "extraction_quality": round(min(1.0, max(0.35, len(markdown) / 50000)), 3),
            "language": language,
            "metadata": {
                "source_feed_id": feed_id,
                "source_period": period,
                "raw_path": str(raw_path.relative_to(runtime_dir)),
                "storage_keys": {"pdf": raw_key, "markdown": markdown_key},
                "download": download_metadata,
                "pcsp_document_reference": ref,
            },
        }
        documents.append(document)

        before_chunks = len(chunks)
        for index, chunk in enumerate(
            chunk_markdown(
                markdown,
                title,
                target_tokens=args.chunk_target_tokens,
                max_tokens=args.chunk_max_tokens,
                overlap_tokens=args.chunk_overlap_tokens,
            ),
            start=1,
        ):
            chunk_id = f"{document_id}-chunk-{index:03d}"
            chunk_text = chunk["text"]
            chunks.append(
                {
                    "chunk_id": chunk_id,
                    "document_id": document_id,
                    "tender_id": tender_id,
                    "document_type": document_type,
                    "title": title,
                    "chunk_text": chunk_text,
                    "source_url": source_url,
                    "heading_path": chunk["heading_path"],
                    "page_start": chunk["page_start"],
                    "page_end": chunk["page_end"],
                    "cpv_codes": entry["metadata"].get("cpv_codes") or ([record.cpv] if record.cpv else []),
                    "contracting_body": record.contracting_body,
                    "publication_date": record.updated_at,
                    "language": language,
                    "content_hash": hashlib.sha256(chunk_text.encode("utf-8")).hexdigest(),
                    "token_count_estimate": chunk.get("token_count") or estimate_bge_m3_tokens(chunk_text),
                    "chunk_strategy": chunk.get("chunk_strategy") or "markdown_section",
                    "embedding_model_max_tokens": BGE_M3_MAX_TOKENS,
                    "metadata": {
                        "source_feed_id": feed_id,
                        "source_period": period,
                        "document_storage_keys": document["metadata"]["storage_keys"],
                    },
                }
            )
        log_event(
            "pcsp.document.ready",
            feed_id=feed_id,
            period=period,
            tender_id=tender_id,
            document_id=document_id,
            document_type=document_type,
            chunks=len(chunks) - before_chunks,
            chars=len(markdown),
        )
        if args.download_sleep_seconds > 0:
            time.sleep(args.download_sleep_seconds)
    return documents, chunks, skipped_existing, errors


def fragment_path(runtime_dir: Path, feed_id: str, period: str) -> Path:
    path = runtime_dir / "fragments" / feed_id
    path.mkdir(parents=True, exist_ok=True)
    return path / f"{period}.json"


def write_fragment(
    runtime_dir: Path,
    feed_id: str,
    period: str,
    tenders: list[dict[str, Any]],
    documents: list[dict[str, Any]],
    chunks: list[dict[str, Any]],
    batch_id: int | None = None,
) -> Path:
    payload = {
        "generated_at": utcnow().isoformat(),
        "source": "Plataforma de Contratación del Sector Público - ZIP mensual",
        "source_urls": {feed_id: zip_url(feed_id, period)},
        "builder": "scripts/pcsp_monthly_kb_worker.py",
        "tenders": tenders,
        "documents": documents,
        "chunks": chunks,
    }
    path = fragment_path(runtime_dir, feed_id, f"{period}-{batch_id:05d}" if batch_id else period)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def mark_month(
    connection,
    *,
    feed_id: str,
    period: str,
    status: str,
    error: str | None = None,
    counts: dict[str, int] | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    year, month = parse_period(period)
    counts = counts or {}
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO kb_crawl_months(
              feed_id, period, year, month, status, attempts, started_at, finished_at,
              tenders_count, documents_count, chunks_count, last_error, source_url, metadata
            )
            VALUES (%s, %s, %s, %s, %s, 1, now(), CASE WHEN %s IN ('done', 'not_found', 'error', 'retry_later') THEN now() ELSE NULL END,
                    %s, %s, %s, %s, %s, %s)
            ON CONFLICT (feed_id, period) DO UPDATE SET
              status = EXCLUDED.status,
              attempts = CASE WHEN EXCLUDED.status = 'running' THEN kb_crawl_months.attempts + 1 ELSE kb_crawl_months.attempts END,
              started_at = CASE WHEN EXCLUDED.status = 'running' THEN now() ELSE kb_crawl_months.started_at END,
              finished_at = CASE WHEN EXCLUDED.status IN ('done', 'not_found', 'error', 'retry_later') THEN now() ELSE kb_crawl_months.finished_at END,
              tenders_count = EXCLUDED.tenders_count,
              documents_count = EXCLUDED.documents_count,
              chunks_count = EXCLUDED.chunks_count,
              last_error = EXCLUDED.last_error,
              source_url = EXCLUDED.source_url,
              metadata = kb_crawl_months.metadata || EXCLUDED.metadata
            """,
            (
                feed_id,
                period,
                year,
                month,
                status,
                status,
                counts.get("tenders", 0),
                counts.get("documents", 0),
                counts.get("chunks", 0),
                error,
                zip_url(feed_id, period),
                Json(metadata or {}),
            ),
        )
    connection.commit()


def update_month_progress(
    connection,
    *,
    feed_id: str,
    period: str,
    counts: dict[str, int],
    metadata: dict[str, Any] | None = None,
) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE kb_crawl_months
            SET
              status = 'running',
              tenders_count = %s,
              documents_count = %s,
              chunks_count = %s,
              metadata = metadata || %s
            WHERE feed_id = %s AND period = %s
            """,
            (
                counts.get("tenders", 0),
                counts.get("documents", 0),
                counts.get("chunks", 0),
                Json(metadata or {}),
                feed_id,
                period,
            ),
        )
    connection.commit()


def month_status(connection, feed_id: str, period: str) -> dict[str, Any] | None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT status, attempts, started_at, finished_at
            FROM kb_crawl_months
            WHERE feed_id = %s AND period = %s
            """,
            (feed_id, period),
        )
        row = cursor.fetchone()
    if not row:
        return None
    return {"status": row[0], "attempts": row[1], "started_at": row[2], "finished_at": row[3]}


def should_process(connection, feed_id: str, period: str, retry_after_seconds: int, running_stale_seconds: int) -> bool:
    status = month_status(connection, feed_id, period)
    if not status:
        return True
    state = status["status"]
    if state in {"done", "not_found"}:
        return False
    if state == "running" and status["started_at"]:
        age = (utcnow() - status["started_at"]).total_seconds()
        return age > running_stale_seconds
    if state in {"retry_later", "error"} and status["finished_at"]:
        age = (utcnow() - status["finished_at"]).total_seconds()
        return age > retry_after_seconds
    return True


def pending_months(connection, args: argparse.Namespace) -> list[tuple[str, str]]:
    periods = iter_periods(args.start_period, args.end_period, args.order)
    pending: list[tuple[str, str]] = []
    for period in periods:
        for feed_id in args.feed_ids:
            if should_process(connection, feed_id, period, args.retry_after_seconds, args.running_stale_seconds):
                pending.append((feed_id, period))
                if len(pending) >= args.months_per_cycle:
                    return pending
    return pending


def acquire_lock(connection, feed_id: str, period: str) -> bool:
    lock_key = f"pcsp-kb:{feed_id}:{period}"
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_try_advisory_lock(hashtext(%s)::bigint)", (lock_key,))
        return bool(cursor.fetchone()[0])


def release_lock(connection, feed_id: str, period: str) -> None:
    lock_key = f"pcsp-kb:{feed_id}:{period}"
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_unlock(hashtext(%s)::bigint)", (lock_key,))
    connection.commit()


def process_month(
    connection,
    session: requests.Session,
    storage: ObjectStore,
    feed_id: str,
    period: str,
    args: argparse.Namespace,
) -> dict[str, int]:
    runtime_dir = Path(args.runtime_dir)
    runtime_dir.mkdir(parents=True, exist_ok=True)
    log_event("pcsp.month.start", feed_id=feed_id, period=period)
    mark_month(connection, feed_id=feed_id, period=period, status="running")
    zip_path = download_month_zip(session, feed_id, period, args.timeout, runtime_dir)
    if zip_path is None:
        status = "retry_later" if period == args.end_period else "not_found"
        mark_month(
            connection,
            feed_id=feed_id,
            period=period,
            status=status,
            error="ZIP mensual no disponible",
            metadata={"source_url": zip_url(feed_id, period)},
        )
        return {"tenders": 0, "documents": 0, "chunks": 0}

    entries = collect_month_entries(zip_path, feed_id, period)
    log_event("pcsp.month.entries", feed_id=feed_id, period=period, entries=len(entries))
    tenders: list[dict[str, Any]] = []
    documents: list[dict[str, Any]] = []
    chunks: list[dict[str, Any]] = []
    seen_tenders: set[str] = set()
    totals = {"tenders": 0, "documents": 0, "chunks": 0}
    batch_id = 0
    indexed = 0
    index_errors: list[str] = []
    fragment_paths: list[str] = []
    skipped_existing = 0
    storage_lock = Lock()
    milvus_runtime_client = None
    milvus_collection_ready = False
    milvus_collection = os.environ.get("MILVUS_COLLECTION", "kb_chunks_v1")
    embedding_api = os.environ.get("EMBEDDING_API_URL", "http://embedding-api:8010")

    def get_milvus_runtime_client():
        nonlocal milvus_runtime_client, milvus_collection_ready
        if milvus_runtime_client is None:
            env_values: dict[str, str] = {}
            milvus_runtime_client = milvus_client(env_values, os.environ.get("MILVUS_URI"), os.environ.get("MILVUS_DB"))
        if not milvus_collection_ready:
            ensure_collection(milvus_runtime_client, milvus_collection, DEFAULT_DIMENSION)
            milvus_collection_ready = True
            log_event("pcsp.month.milvus.ready", feed_id=feed_id, period=period, collection=milvus_collection)
        return milvus_runtime_client

    def flush_batch(reason: str, *, force: bool = False) -> None:
        nonlocal tenders, documents, chunks, batch_id, indexed, milvus_runtime_client, milvus_collection_ready
        if not tenders and not documents and not chunks:
            return
        should_flush = (
            force
            or len(documents) >= args.flush_documents
            or len(chunks) >= args.flush_chunks
            or len(tenders) >= args.flush_tenders
        )
        if not should_flush:
            return

        batch_id += 1
        fragment = write_fragment(runtime_dir, feed_id, period, tenders, documents, chunks, batch_id=batch_id)
        fragment_paths.append(str(fragment.relative_to(runtime_dir)))
        log_event(
            "pcsp.batch.postgres.start",
            feed_id=feed_id,
            period=period,
            batch=batch_id,
            reason=reason,
            tenders=len(tenders),
            documents=len(documents),
            chunks=len(chunks),
        )
        load_kb(connection, fragment)
        totals["tenders"] += len(tenders)
        totals["documents"] += len(documents)
        totals["chunks"] += len(chunks)
        log_event(
            "pcsp.batch.postgres.done",
            feed_id=feed_id,
            period=period,
            batch=batch_id,
            total_tenders=totals["tenders"],
            total_documents=totals["documents"],
            total_chunks=totals["chunks"],
        )

        if args.index_milvus and chunks:
            try:
                log_event("pcsp.batch.milvus.start", feed_id=feed_id, period=period, batch=batch_id, chunks=len(chunks))
                client = get_milvus_runtime_client()
                result = index_kb(
                    client,
                    milvus_collection,
                    fragment,
                    embedding_api,
                    args.milvus_batch_size,
                    args.milvus_timeout,
                    ensure=False,
                    flush=False,
                    load=False,
                )
                indexed_now = int(result.get("indexed", 0))
                indexed += indexed_now
                log_event("pcsp.batch.milvus.done", feed_id=feed_id, period=period, batch=batch_id, indexed=indexed_now)
                if args.milvus_flush_every_batches and batch_id % args.milvus_flush_every_batches == 0:
                    log_event(
                        "pcsp.batch.milvus.flush.start",
                        feed_id=feed_id,
                        period=period,
                        batch=batch_id,
                        indexed=indexed,
                    )
                    client.flush(milvus_collection, timeout=args.milvus_timeout)
                    log_event(
                        "pcsp.batch.milvus.flush.done",
                        feed_id=feed_id,
                        period=period,
                        batch=batch_id,
                        indexed=indexed,
                    )
            except Exception as exc:
                index_error = str(exc)[:1000]
                milvus_runtime_client = None
                milvus_collection_ready = False
                index_errors.append(index_error)
                log_event("pcsp.batch.milvus.error", feed_id=feed_id, period=period, batch=batch_id, error=index_error)

        update_month_progress(
            connection,
            feed_id=feed_id,
            period=period,
            counts=totals,
            metadata={
                "last_batch": batch_id,
                "last_fragment_path": str(fragment.relative_to(runtime_dir)),
                "indexed_chunks": indexed,
            },
        )
        tenders = []
        documents = []
        chunks = []

    candidate_entries: list[dict[str, Any]] = []
    candidate_document_ids: list[str] = []
    for entry in entries:
        record = entry["record"]
        tender_id = stable_tender_id(record)
        if args.max_tenders_per_month and len(seen_tenders) >= args.max_tenders_per_month and tender_id not in seen_tenders:
            continue
        if tender_id not in seen_tenders:
            tenders.append(tender_payload(entry))
            seen_tenders.add(tender_id)
            flush_batch("tender-threshold")
        entry_document_ids = document_ids_for_entry(entry, args.document_types)
        if not entry_document_ids:
            continue
        candidate_entries.append(entry)
        candidate_document_ids.extend(entry_document_ids)
        if args.max_documents_per_month and len(candidate_document_ids) >= args.max_documents_per_month:
            break

    known_document_ids = set() if args.force else existing_document_ids(connection, candidate_document_ids)
    log_event(
        "pcsp.month.documents.queued",
        feed_id=feed_id,
        period=period,
        candidates=len(candidate_document_ids),
        existing=len(known_document_ids),
        workers=args.document_workers,
    )

    def handle_document_result(result: tuple[list[dict[str, Any]], list[dict[str, Any]], int, list[dict[str, Any]]]) -> None:
        nonlocal skipped_existing
        new_documents, new_chunks, existing, errors = result
        skipped_existing += existing
        for error in errors:
            record_ingest_error(connection, **error)
        documents.extend(new_documents)
        chunks.extend(new_chunks)
        flush_batch("threshold")

    def build_entry_documents(entry: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], int, list[dict[str, Any]]]:
        return build_document_payloads(
            worker_session(),
            storage,
            storage_lock,
            entry,
            feed_id=feed_id,
            period=period,
            runtime_dir=runtime_dir,
            args=args,
            known_document_ids=known_document_ids,
        )

    if args.document_workers <= 1 or len(candidate_entries) <= 1:
        for entry in candidate_entries:
            handle_document_result(
                build_document_payloads(
                    session,
                    storage,
                    storage_lock,
                    entry,
                    feed_id=feed_id,
                    period=period,
                    runtime_dir=runtime_dir,
                    args=args,
                    known_document_ids=known_document_ids,
                )
            )
    else:
        with ThreadPoolExecutor(max_workers=args.document_workers) as executor:
            futures = [executor.submit(build_entry_documents, entry) for entry in candidate_entries]
            for future in as_completed(futures):
                try:
                    handle_document_result(future.result())
                except Exception as exc:
                    log_event("pcsp.document.worker.error", feed_id=feed_id, period=period, error=str(exc)[:1000])

    flush_batch("month-end", force=True)

    if args.index_milvus and indexed:
        try:
            client = get_milvus_runtime_client()
            log_event("pcsp.month.milvus.flush.start", feed_id=feed_id, period=period, indexed=indexed)
            client.flush(milvus_collection)
            if args.milvus_load_after_month:
                client.load_collection(milvus_collection)
            log_event(
                "pcsp.month.milvus.flush.done",
                feed_id=feed_id,
                period=period,
                indexed=indexed,
                loaded=args.milvus_load_after_month,
            )
        except Exception as exc:
            index_error = str(exc)[:1000]
            index_errors.append(index_error)
            log_event("pcsp.month.milvus.flush.error", feed_id=feed_id, period=period, error=index_error)

    metadata = {
        "zip_path": str(zip_path.relative_to(runtime_dir)),
        "fragment_count": len(fragment_paths),
        "last_fragment_path": fragment_paths[-1] if fragment_paths else None,
        "skipped_existing_documents": skipped_existing,
        "indexed_chunks": indexed,
    }
    if index_errors:
        metadata["milvus_index_errors"] = index_errors[-5:]
    mark_month(connection, feed_id=feed_id, period=period, status="done", counts=totals, metadata=metadata)
    log_event("pcsp.month.done", feed_id=feed_id, period=period, **totals)
    return totals


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dsn", default=os.environ.get("POSTGRES_DSN") or DEFAULT_DSN)
    parser.add_argument("--loop", action="store_true")
    parser.add_argument("--runtime-dir", default=env_text("PCSP_RUNTIME_DIR", "/app/data/kb/runtime"))
    parser.add_argument("--feed-ids", default=env_text("PCSP_FEEDS", "s643,s1044"))
    parser.add_argument("--start-period", default=env_text("PCSP_BACKFILL_START", "2019-01"))
    parser.add_argument("--end-period", default=env_text("PCSP_BACKFILL_END", current_period()))
    parser.add_argument("--order", choices=["asc", "desc"], default=env_text("PCSP_BACKFILL_ORDER", "desc"))
    parser.add_argument("--months-per-cycle", type=int, default=env_int("PCSP_MONTHS_PER_CYCLE", 4))
    parser.add_argument("--sleep-seconds", type=int, default=env_int("PCSP_WORKER_INTERVAL_SECONDS", 300))
    parser.add_argument("--retry-after-seconds", type=int, default=env_int("PCSP_RETRY_AFTER_SECONDS", 86400))
    parser.add_argument("--running-stale-seconds", type=int, default=env_int("PCSP_RUNNING_STALE_SECONDS", 900))
    parser.add_argument("--timeout", type=int, default=env_int("PCSP_HTTP_TIMEOUT_SECONDS", 120))
    parser.add_argument("--download-sleep-seconds", type=float, default=env_float("PCSP_DOWNLOAD_SLEEP_SECONDS", 0.0))
    parser.add_argument("--max-doc-pages", type=int, default=env_int("PCSP_MAX_DOC_PAGES", 80))
    parser.add_argument("--min-chars", type=int, default=env_int("PCSP_MIN_MARKDOWN_CHARS", 1000))
    parser.add_argument("--max-tenders-per-month", type=int, default=env_int("PCSP_MAX_TENDERS_PER_MONTH", 0))
    parser.add_argument("--max-documents-per-month", type=int, default=env_int("PCSP_MAX_DOCUMENTS_PER_MONTH", 0))
    parser.add_argument("--flush-tenders", type=int, default=env_int("PCSP_FLUSH_TENDERS", 250))
    parser.add_argument("--flush-documents", type=int, default=env_int("PCSP_FLUSH_DOCUMENTS", 32))
    parser.add_argument("--flush-chunks", type=int, default=env_int("PCSP_FLUSH_CHUNKS", 512))
    parser.add_argument("--chunk-target-tokens", type=int, default=env_int("PCSP_CHUNK_TARGET_TOKENS", 1400))
    parser.add_argument("--chunk-max-tokens", type=int, default=env_int("PCSP_CHUNK_MAX_TOKENS", 7600))
    parser.add_argument("--chunk-overlap-tokens", type=int, default=env_int("PCSP_CHUNK_OVERLAP_TOKENS", 96))
    parser.add_argument("--document-types", default=env_text("PCSP_DOCUMENT_TYPES", "ppt,pcap"))
    parser.add_argument("--document-workers", type=int, default=env_int("PCSP_DOCUMENT_WORKERS", 4))
    parser.add_argument("--milvus-batch-size", type=int, default=env_int("PCSP_MILVUS_BATCH_SIZE", 64))
    parser.add_argument("--milvus-timeout", type=int, default=env_int("PCSP_MILVUS_TIMEOUT_SECONDS", 240))
    parser.add_argument(
        "--milvus-flush-every-batches",
        type=int,
        default=env_int("PCSP_MILVUS_FLUSH_EVERY_BATCHES", 20),
        help="Sella los segmentos crecientes de Milvus cada N lotes; 0 lo desactiva.",
    )
    parser.add_argument(
        "--milvus-load-after-month",
        action=argparse.BooleanOptionalAction,
        default=env_bool("PCSP_MILVUS_LOAD_AFTER_MONTH", False),
        help="Carga el corpus completo al terminar cada mes; desactivado por defecto para evitar presión de memoria.",
    )
    parser.add_argument("--index-milvus", action=argparse.BooleanOptionalAction, default=env_bool("PCSP_INDEX_MILVUS", True))
    parser.add_argument("--upload-seaweed", action=argparse.BooleanOptionalAction, default=env_bool("PCSP_UPLOAD_SEAWEED", True))
    parser.add_argument("--force", action="store_true", default=env_bool("PCSP_FORCE_REDOWNLOAD", False))
    args = parser.parse_args()
    args.feed_ids = [item.strip() for item in str(args.feed_ids).split(",") if item.strip()]
    args.document_types = [item.strip().lower() for item in str(args.document_types).split(",") if item.strip()]
    unknown_feeds = [feed_id for feed_id in args.feed_ids if feed_id not in FEED_ARCHIVES]
    if unknown_feeds:
        raise SystemExit(f"feeds no soportados: {', '.join(unknown_feeds)}")
    if args.chunk_max_tokens > BGE_M3_MAX_TOKENS:
        raise SystemExit(f"PCSP_CHUNK_MAX_TOKENS debe ser <= {BGE_M3_MAX_TOKENS}")
    args.flush_tenders = max(1, args.flush_tenders)
    args.flush_documents = max(1, args.flush_documents)
    args.flush_chunks = max(1, args.flush_chunks)
    args.milvus_flush_every_batches = max(0, args.milvus_flush_every_batches)
    args.document_workers = max(1, args.document_workers)
    return args


def run_once(args: argparse.Namespace) -> list[dict[str, Any]]:
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})
    results: list[dict[str, Any]] = []
    with psycopg2.connect(args.dsn) as connection:
        apply_schema(connection)
        storage = ObjectStore(args.upload_seaweed)
        for feed_id, period in pending_months(connection, args):
            if not acquire_lock(connection, feed_id, period):
                continue
            try:
                counts = process_month(connection, session, storage, feed_id, period, args)
                results.append({"feed_id": feed_id, "period": period, **counts})
            except Exception as exc:
                mark_month(
                    connection,
                    feed_id=feed_id,
                    period=period,
                    status="error",
                    error=str(exc)[:2000],
                )
                results.append({"feed_id": feed_id, "period": period, "error": str(exc)[:500]})
            finally:
                release_lock(connection, feed_id, period)
    return results


def main() -> None:
    args = parse_args()
    while True:
        results = run_once(args)
        print(json.dumps({"at": utcnow().isoformat(), "results": results}, ensure_ascii=False), flush=True)
        if not args.loop:
            break
        time.sleep(args.sleep_seconds)


if __name__ == "__main__":
    main()
