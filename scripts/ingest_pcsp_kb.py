#!/usr/bin/env python3
"""Build a small real knowledge base from PCSP tender feeds.

This script reuses the same public data shape as the old SILIA ETL:
ATOM feeds from Plataforma de Contratacion del Sector Publico, extracting
technical/legal document references, downloading PDFs, converting them to
Markdown/text, and writing a compact JSON KB consumed by the API.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import tempfile
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

import fitz
import pymupdf4llm
import requests
from lxml import etree


ATOM_NS = "http://www.w3.org/2005/Atom"
BGE_M3_MAX_TOKENS = 8192
FEEDS = {
    "perfiles_643": "https://contrataciondelestado.es/sindicacion/sindicacion_643/licitacionesPerfilesContratanteCompleto3.atom",
    "agregadas_1044": "https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_1044/PlataformasAgregadasSinMenores.atom",
}
USER_AGENT = "xTender real KB builder/1.0 (+https://www.techfriendly.es)"


@dataclass(frozen=True)
class TenderRecord:
    atom_id: str
    title: str
    updated_at: str | None
    expediente: str | None
    status: str | None
    cpv: str | None
    contracting_body: str | None
    contract_uri: str | None
    technical_uri: str | None
    legal_uri: str | None
    estimated_value: float | None
    budget_without_tax: float | None
    budget_with_tax: float | None
    currency: str | None
    province: str | None
    locality: str | None
    source_feed: str


def normalize(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def first_text(node: etree._Element | None, xpath: str) -> str | None:
    if node is None:
        return None
    for item in node.xpath(xpath):
        text = normalize(item.text if isinstance(item, etree._Element) else item)
        if text:
            return text
    return None


def first_float(node: etree._Element | None, xpath: str) -> tuple[float | None, str | None]:
    if node is None:
        return None, None
    for item in node.xpath(xpath):
        if not isinstance(item, etree._Element):
            continue
        text = normalize(item.text)
        if not text:
            continue
        try:
            return float(text), normalize(item.get("currencyID"))
        except ValueError:
            return None, normalize(item.get("currencyID"))
    return None, None


def alternate_link(entry: etree._Element) -> str | None:
    link = entry.xpath("./atom:link[@rel='alternate']", namespaces={"atom": ATOM_NS})
    if not link:
        link = entry.xpath("./atom:link", namespaces={"atom": ATOM_NS})
    return normalize(link[0].get("href")) if link else None


def document_uri(cfs: etree._Element | None, document_name: str) -> str | None:
    return first_text(cfs, f".//*[local-name()='{document_name}']//*[local-name()='URI']")


def parse_entry(entry: etree._Element, source_feed: str) -> TenderRecord | None:
    atom_id = first_text(entry, "./*[local-name()='id']/text()")
    if not atom_id:
        return None
    cfs_nodes = entry.xpath(".//*[local-name()='ContractFolderStatus']")
    cfs = cfs_nodes[0] if cfs_nodes else None
    estimated_value, estimated_currency = first_float(
        cfs,
        ".//*[local-name()='ProcurementProject']/*[local-name()='BudgetAmount']/*[local-name()='EstimatedOverallContractAmount']",
    )
    budget_without_tax, budget_without_tax_currency = first_float(
        cfs,
        ".//*[local-name()='ProcurementProject']/*[local-name()='BudgetAmount']/*[local-name()='TaxExclusiveAmount']",
    )
    budget_with_tax, budget_with_tax_currency = first_float(
        cfs,
        ".//*[local-name()='ProcurementProject']/*[local-name()='BudgetAmount']/*[local-name()='TotalAmount']",
    )
    location_nodes = cfs.xpath(".//*[local-name()='ProcurementProject']/*[local-name()='RealizedLocation']") if cfs is not None else []
    location = location_nodes[0] if location_nodes else None
    return TenderRecord(
        atom_id=atom_id,
        title=first_text(entry, "./*[local-name()='title']/text()") or first_text(cfs, ".//*[local-name()='ProcurementProject']/*[local-name()='Name']/text()") or atom_id,
        updated_at=first_text(entry, "./*[local-name()='updated']/text()"),
        expediente=first_text(cfs, ".//*[local-name()='ContractFolderID']/text()"),
        status=(first_text(cfs, ".//*[local-name()='ContractFolderStatusCode']/text()") or "").upper() or None,
        cpv=first_text(
            cfs,
            ".//*[local-name()='ProcurementProject']/*[local-name()='RequiredCommodityClassification']/*[local-name()='ItemClassificationCode']/text()",
        ),
        contracting_body=first_text(
            cfs,
            ".//*[local-name()='LocatedContractingParty']/*[local-name()='Party']/*[local-name()='PartyName']/*[local-name()='Name']/text()",
        ),
        contract_uri=alternate_link(entry),
        technical_uri=document_uri(cfs, "TechnicalDocumentReference"),
        legal_uri=document_uri(cfs, "LegalDocumentReference"),
        estimated_value=estimated_value,
        budget_without_tax=budget_without_tax,
        budget_with_tax=budget_with_tax,
        currency=budget_with_tax_currency or budget_without_tax_currency or estimated_currency,
        province=first_text(location, "./*[local-name()='CountrySubentity']/text()"),
        locality=first_text(location, ".//*[local-name()='CityName']/text()"),
        source_feed=source_feed,
    )


def parse_feed(xml_bytes: bytes, source_feed: str) -> tuple[list[TenderRecord], str | None]:
    root = etree.fromstring(xml_bytes, etree.XMLParser(recover=True, huge_tree=True))
    records = [
        record
        for record in (parse_entry(entry, source_feed) for entry in root.xpath(".//atom:entry", namespaces={"atom": ATOM_NS}))
        if record and (record.technical_uri or record.legal_uri)
    ]
    next_links = root.xpath(".//atom:link[@rel='next']", namespaces={"atom": ATOM_NS})
    return records, normalize(next_links[0].get("href")) if next_links else None


def collect_records(max_pages: int, timeout: int) -> list[TenderRecord]:
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})
    all_records: list[TenderRecord] = []
    for source_feed, feed_url in FEEDS.items():
        url = feed_url
        seen: set[str] = set()
        page = 0
        while url and url not in seen and page < max_pages:
            seen.add(url)
            page += 1
            response = session.get(url, timeout=timeout)
            response.raise_for_status()
            records, next_url = parse_feed(response.content, source_feed)
            all_records.extend(records)
            url = urljoin(url, next_url) if next_url else None
    return all_records


def slugify(value: str) -> str:
    text = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")
    return text[:80] or "document"


def download_pdf(url: str, timeout: int) -> bytes:
    response = requests.get(url, timeout=timeout, headers={"User-Agent": USER_AGENT})
    response.raise_for_status()
    content = response.content
    if not content.startswith(b"%PDF"):
        raise ValueError(f"not a PDF response: {response.headers.get('content-type')}")
    return content


def pdf_to_markdown(pdf_bytes: bytes, max_pages: int) -> tuple[str, int]:
    with tempfile.NamedTemporaryFile(suffix=".pdf") as handle:
        handle.write(pdf_bytes)
        handle.flush()
        with fitz.open(handle.name) as document:
            page_count = document.page_count
        pages = list(range(min(page_count, max_pages)))
        try:
            markdown = pymupdf4llm.to_markdown(handle.name, pages=pages)
        except TypeError:
            # Older pymupdf4llm versions use `page_chunks`; plain PyMuPDF fallback is enough for a searchable KB.
            markdown = ""
        if not markdown:
            with fitz.open(handle.name) as document:
                markdown = "\n\n".join(document.load_page(index).get_text("text") for index in pages)
    return markdown.strip(), page_count


def estimate_bge_m3_tokens(text: str) -> int:
    """Conservative tokenizer-free estimate for BGE-M3's 8192-token limit."""
    lexical_tokens = re.findall(r"\w+|[^\w\s]", text, flags=re.UNICODE)
    char_estimate = int(len(text) / 3.0) + 1
    return max(len(lexical_tokens), char_estimate)


def clean_heading(text: str) -> str:
    cleaned = re.sub(r"[*_`#|]+", " ", text).strip()
    return re.sub(r"\s+", " ", cleaned)


def split_markdown_sections(markdown: str, fallback_title: str) -> list[dict[str, Any]]:
    sections: list[dict[str, Any]] = []
    heading_stack: list[tuple[int, str]] = []
    buffer: list[str] = []
    current_path = [fallback_title]

    def flush() -> None:
        text = "\n".join(buffer).strip()
        if text:
            sections.append({"text": text, "heading_path": list(current_path)})
        buffer.clear()

    for line in markdown.splitlines():
        match = re.match(r"^(#{1,6})\s+(.+?)\s*$", line)
        if match:
            flush()
            level = len(match.group(1))
            title = clean_heading(match.group(2))
            heading_stack[:] = [(item_level, item_title) for item_level, item_title in heading_stack if item_level < level]
            heading_stack.append((level, title))
            current_path = [item_title for _, item_title in heading_stack] or [fallback_title]
        buffer.append(line)
    flush()
    return sections


def paragraph_blocks(text: str) -> list[str]:
    blocks = [block.strip() for block in re.split(r"\n{2,}", text) if block.strip()]
    expanded: list[str] = []
    for block in blocks:
        if estimate_bge_m3_tokens(block) <= BGE_M3_MAX_TOKENS:
            expanded.append(block)
            continue
        expanded.extend(piece.strip() for piece in re.split(r"(?<=[.!?。])\s+", block) if piece.strip())
    return expanded


def split_hard(text: str, max_tokens: int) -> list[str]:
    approx_chars = max(900, int(max_tokens * 2.6))
    pieces = []
    start = 0
    while start < len(text):
        end = min(len(text), start + approx_chars)
        if end < len(text):
            newline = text.rfind("\n", start, end)
            space = text.rfind(" ", start, end)
            end = max(newline, space, start + approx_chars // 2)
        pieces.append(text[start:end].strip())
        start = end
    return [piece for piece in pieces if piece]


def heading_context(path: list[str]) -> str:
    return "\n".join(f"{'#' * min(index + 1, 6)} {heading}" for index, heading in enumerate(path))


def ensure_heading_context(text: str, path: list[str]) -> str:
    stripped = text.lstrip()
    if stripped.startswith("#"):
        return text.strip()
    return f"{heading_context(path)}\n\n{text}".strip()


def page_range_for_text(text: str) -> tuple[int | None, int | None]:
    pages = [int(match) for match in re.findall(r"P[àa]gina\s+(\d+)\s+de\b", text, flags=re.IGNORECASE)]
    if not pages:
        pages = [int(match) for match in re.findall(r"\bPage\s+(\d+)\s+of\b", text, flags=re.IGNORECASE)]
    return (min(pages), max(pages)) if pages else (None, None)


def split_long_section(
    text: str,
    heading_path: list[str],
    target_tokens: int,
    max_tokens: int,
    overlap_tokens: int,
) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []
    buffer: list[str] = []
    overlap_text = ""

    def flush() -> None:
        nonlocal overlap_text
        chunk_text = "\n\n".join(buffer).strip()
        if not chunk_text:
            return
        chunk_text = ensure_heading_context(chunk_text, heading_path)
        page_start, page_end = page_range_for_text(chunk_text)
        chunks.append(
            {
                "text": chunk_text,
                "heading_path": heading_path,
                "page_start": page_start,
                "page_end": page_end,
                "token_count": estimate_bge_m3_tokens(chunk_text),
                "chunk_strategy": "markdown_section_split",
            }
        )
        words = re.findall(r"\S+", chunk_text)
        overlap_text = " ".join(words[-overlap_tokens:]) if overlap_tokens > 0 else ""
        buffer.clear()

    for block in paragraph_blocks(text):
        pieces = [block]
        if estimate_bge_m3_tokens(block) > max_tokens:
            pieces = split_hard(block, max_tokens)
        for piece in pieces:
            current = "\n\n".join([part for part in [overlap_text, *buffer, piece] if part]).strip()
            if buffer and estimate_bge_m3_tokens(ensure_heading_context(current, heading_path)) > target_tokens:
                flush()
                if overlap_text:
                    buffer.append(overlap_text)
            buffer.append(piece)
    flush()
    return chunks


def chunk_markdown(
    markdown: str,
    fallback_title: str,
    target_tokens: int = 1400,
    max_tokens: int = 7600,
    overlap_tokens: int = 96,
) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []
    for section in split_markdown_sections(markdown, fallback_title):
        text = section["text"]
        heading_path = section["heading_path"]
        token_count = estimate_bge_m3_tokens(text)
        if token_count <= max_tokens and token_count <= target_tokens:
            chunk_text = ensure_heading_context(text, heading_path)
            page_start, page_end = page_range_for_text(text)
            chunks.append(
                {
                    "text": chunk_text,
                    "heading_path": heading_path,
                    "page_start": page_start,
                    "page_end": page_end,
                    "token_count": estimate_bge_m3_tokens(chunk_text),
                    "chunk_strategy": "markdown_section",
                }
            )
            continue
        chunks.extend(split_long_section(text, heading_path, target_tokens, max_tokens, overlap_tokens))
    return [chunk for chunk in chunks if estimate_bge_m3_tokens(chunk["text"]) <= max_tokens]


def detect_language(text: str) -> str:
    sample = text[:20000].lower()
    signals = {
        "eu": ["kontratua", "baldintza", "udal", "zerbitzu", "espedientea", "lizitazio"],
        "gl": ["contratación", "concello", "pregos", "orzamento", "licitación", "servizo"],
        "ca": ["contractació", "licitació", "plec", "clàusula", "servei", "ajuntament", "pàgina", "pressupost"],
        "es": ["contratación", "licitación", "pliego", "cláusula", "servicio", "ayuntamiento", "página", "presupuesto"],
    }
    scores = {language: sum(sample.count(signal) for signal in words) for language, words in signals.items()}
    return max(scores, key=scores.get) if max(scores.values() or [0]) else "es"


def heading_path_for_chunk(chunk_text: str, fallback: str) -> list[str]:
    for line in chunk_text.splitlines():
        clean = re.sub(r"[*_`#|]+", " ", line).strip()
        clean = re.sub(r"\s+", " ", clean)
        if len(clean) < 8 or len(clean) > 140:
            continue
        if any(token in clean.lower() for token in ["clàusula", "cláusula", "plec", "objecte", "objeto", "pressupost", "presupuesto", "solvencia", "índex", "indice"]):
            return [clean]
    return [fallback]


def build_kb(args: argparse.Namespace) -> dict[str, Any]:
    output_dir = Path(args.output_dir)
    markdown_dir = output_dir / "markdown"
    raw_dir = output_dir / "raw"
    markdown_dir.mkdir(parents=True, exist_ok=True)
    if args.keep_pdfs:
        raw_dir.mkdir(parents=True, exist_ok=True)

    records = collect_records(max_pages=args.max_pages, timeout=args.timeout)
    priority = sorted(
        records,
        key=lambda record: (
            0 if record.technical_uri else 1,
            0 if record.legal_uri else 1,
            record.updated_at or "",
        ),
        reverse=False,
    )

    tenders: list[dict[str, Any]] = []
    documents: list[dict[str, Any]] = []
    chunks: list[dict[str, Any]] = []
    seen_tenders: set[str] = set()

    for record in priority:
        tender_key = record.expediente or record.atom_id
        if tender_key in seen_tenders:
            continue
        docs_to_try = [("ppt", record.technical_uri), ("pcap", record.legal_uri)]
        created_for_tender = 0
        for document_type, url in docs_to_try:
            if not url:
                continue
            try:
                pdf = download_pdf(url, timeout=args.timeout)
                markdown, page_count = pdf_to_markdown(pdf, max_pages=args.max_doc_pages)
            except Exception as exc:
                print(f"skip {record.expediente or record.atom_id} {document_type}: {exc}")
                continue
            if len(markdown) < args.min_chars:
                print(f"skip {record.expediente or record.atom_id} {document_type}: short extraction")
                continue
            tender_slug = slugify(record.expediente or record.title)
            document_id = f"{tender_slug}-{document_type}"
            markdown_path = markdown_dir / f"{document_id}.md"
            markdown_path.write_text(markdown, encoding="utf-8")
            if args.keep_pdfs:
                (raw_dir / f"{document_id}.pdf").write_bytes(pdf)
            content_hash = hashlib.sha256(markdown.encode("utf-8")).hexdigest()
            language = detect_language(markdown)
            document = {
                "document_id": document_id,
                "tender_id": tender_key,
                "document_type": document_type,
                "title": f"{document_type.upper()} - {record.title}",
                "source_url": url,
                "markdown_path": str(markdown_path.relative_to(output_dir)),
                "content_hash": content_hash,
                "page_count": page_count,
                "indexed_pages": min(page_count, args.max_doc_pages),
                "extraction_quality": round(min(1.0, max(0.35, len(markdown) / 50000)), 3),
                "language": language,
            }
            documents.append(document)
            for index, chunk in enumerate(
                chunk_markdown(
                    markdown,
                    document["title"],
                    target_tokens=args.chunk_target_tokens,
                    max_tokens=args.chunk_max_tokens,
                    overlap_tokens=args.chunk_overlap_tokens,
                ),
                start=1,
            ):
                chunk_id = f"{document_id}-chunk-{index:03d}"
                chunks.append(
                    {
                        "chunk_id": chunk_id,
                        "document_id": document_id,
                        "tender_id": tender_key,
                        "document_type": document_type,
                        "title": document["title"],
                        "chunk_text": chunk["text"],
                        "source_url": url,
                        "heading_path": chunk["heading_path"],
                        "page_start": chunk["page_start"],
                        "page_end": chunk["page_end"],
                        "cpv_codes": [record.cpv] if record.cpv else [],
                        "contracting_body": record.contracting_body,
                        "publication_date": record.updated_at,
                        "language": language,
                        "content_hash": hashlib.sha256(chunk["text"].encode("utf-8")).hexdigest(),
                        "token_count_estimate": chunk["token_count"],
                        "chunk_strategy": chunk["chunk_strategy"],
                        "embedding_model_max_tokens": BGE_M3_MAX_TOKENS,
                    }
                )
            created_for_tender += 1
            if len(documents) >= args.max_documents:
                break
        if created_for_tender:
            tenders.append(asdict(record))
            seen_tenders.add(tender_key)
        if len(tenders) >= args.max_tenders or len(documents) >= args.max_documents:
            break

    kb = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "Plataforma de Contratacion del Sector Publico ATOM feeds",
        "source_urls": FEEDS,
        "builder": "scripts/ingest_pcsp_kb.py",
        "tenders": tenders,
        "documents": documents,
        "chunks": chunks,
    }
    (output_dir / "kb.json").write_text(json.dumps(kb, ensure_ascii=False, indent=2), encoding="utf-8")
    return kb


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", default="data/kb")
    parser.add_argument("--max-pages", type=int, default=1)
    parser.add_argument("--max-tenders", type=int, default=4)
    parser.add_argument("--max-documents", type=int, default=8)
    parser.add_argument("--max-doc-pages", type=int, default=8)
    parser.add_argument("--min-chars", type=int, default=1200)
    parser.add_argument("--chunk-target-tokens", type=int, default=1400)
    parser.add_argument("--chunk-max-tokens", type=int, default=7600)
    parser.add_argument("--chunk-overlap-tokens", type=int, default=96)
    parser.add_argument("--timeout", type=int, default=45)
    parser.add_argument("--keep-pdfs", action="store_true")
    args = parser.parse_args()
    if args.chunk_max_tokens > BGE_M3_MAX_TOKENS:
        raise SystemExit(f"--chunk-max-tokens must be <= {BGE_M3_MAX_TOKENS} for BGE-M3")
    if args.chunk_target_tokens >= args.chunk_max_tokens:
        raise SystemExit("--chunk-target-tokens must be lower than --chunk-max-tokens")
    kb = build_kb(args)
    print(
        json.dumps(
            {
                "tenders": len(kb["tenders"]),
                "documents": len(kb["documents"]),
                "chunks": len(kb["chunks"]),
                "output": str(Path(args.output_dir) / "kb.json"),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
