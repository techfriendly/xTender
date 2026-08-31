from __future__ import annotations

import uuid

from . import kb


def trace_id(prefix: str = "trc") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def search_chunks(
    query: str,
    *,
    tender_id: str | None = None,
    cpv: str | None = None,
    document_type: str | None = None,
    language: str | None = None,
    top_k: int = 10,
):
    return kb.search(
        query,
        tender_id=tender_id,
        cpv=cpv,
        document_type=document_type,
        language=language,
        top_k=top_k,
    )
