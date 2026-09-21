from __future__ import annotations

import os
import json

import pytest


# The legacy compatibility tests exercise one explicit demo workspace. Runtime
# deployments never enable this flag by default.
os.environ.setdefault("PROCUREAI_ENABLE_DEMO_SEED", "1")


@pytest.fixture(scope="session", autouse=True)
def synthetic_knowledge_base(tmp_path_factory):
    """Exercise retrieval without distributing or reading real tender documents."""
    from procureai_api import kb

    root = tmp_path_factory.mktemp("synthetic-kb")
    tenders, documents, chunks = [], [], []
    headings = ["Objecte", "Abast", "Requisits", "Lliurables", "Terminis", "Qualitat", "Seguiment"]
    for index in range(1, 5):
        tender_id = f"synthetic-{index:03d}"
        tenders.append({
            "id": tender_id, "atom_id": tender_id, "expediente": tender_id,
            "title": f"Procediment fictici {index}", "contracting_body": "Entitat de prova",
            "cpv": "90711500", "updated_at": "2026-01-01", "currency": "EUR",
        })
        for kind in ["ppt", "pcap"]:
            document_id = f"{tender_id}-{kind}"
            source_url = f"https://example.invalid/synthetic/{document_id}"
            title = f"Document sintètic {kind.upper()} {index}"
            documents.append({
                "document_id": document_id, "tender_id": tender_id, "title": title,
                "document_type": kind, "language": "ca", "source_url": source_url,
                "markdown_path": f"{document_id}.md", "extraction_quality": 1.0,
                "page_count": 7, "indexed_pages": 7,
            })
            sections = []
            for order in range(14):
                heading = headings[order % len(headings)]
                text = f"# {heading}\n\nExemple inventat {index}-{order}: plec clausules tecniques contractacio. Servei de suport amb intel·ligencia artificial, requisits verificables, lliurables i revisió humana. No correspon a cap expedient real."
                sections.append(text)
                chunks.append({
                    "chunk_id": f"{document_id}-{order}", "document_id": document_id,
                    "tender_id": tender_id, "title": title, "chunk_text": text,
                    "document_type": kind, "language": "ca", "source_url": source_url,
                    "cpv_codes": ["90711500"], "heading_path": [title, heading],
                    "page_start": order // 2 + 1, "page_end": order // 2 + 1,
                    "chunk_order": order, "token_count_estimate": 80,
                    "embedding_model_max_tokens": 8192, "chunk_strategy": "synthetic-test",
                })
            (root / f"{document_id}.md").write_text("\n\n".join(sections), encoding="utf-8")
    path = root / "kb.json"
    path.write_text(json.dumps({"source": "synthetic-test-fixture", "source_urls": [], "tenders": tenders, "documents": documents, "chunks": chunks}), encoding="utf-8")
    with pytest.MonkeyPatch.context() as patch:
        patch.setattr(kb, "kb_path", lambda: path)
        patch.setattr(kb, "markdown_for_document", lambda document_id: (root / f"{document_id}.md").read_text(encoding="utf-8"))
        kb.load_kb.cache_clear()
        yield
        kb.load_kb.cache_clear()
