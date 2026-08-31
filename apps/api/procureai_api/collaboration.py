from __future__ import annotations

import hashlib
import re
import uuid
from datetime import date, datetime, timezone
from typing import Any

from psycopg2.extras import Json

from . import kb, runtime
from .document_specs import normalize_document_kind
from .models import (
    ClauseCatalogRequest,
    CommentResolutionRequest,
    DocumentCommentRequest,
    DocumentSharingRequest,
    PrintProfileRequest,
    SavedSearchRequest,
    UserContext,
    WorkspaceTaskRequest,
)
from .services import trace_id


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _workspace(user: UserContext, workspace_id: str) -> dict[str, Any]:
    workspace = runtime.get_workspace(user, workspace_id)
    if not workspace:
        raise KeyError(workspace_id)
    return workspace


def _date(value: str | None, field: str) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(f"invalid_date:{field}") from exc


def _notify(user: UserContext, user_id: str, title: str, body: str, *, workspace_id: str | None = None, notification_type: str = "activity", target: dict[str, Any] | None = None) -> str:
    notification_id = f"notice-{uuid.uuid4().hex[:12]}"
    record = {
        "id": notification_id,
        "tenant_id": user.tenant_id,
        "user_id": user_id,
        "workspace_id": workspace_id,
        "notification_type": notification_type,
        "title": title,
        "body": body,
        "target": target or {},
        "read_at": None,
        "created_at": _now(),
    }
    if runtime._db_available():
        with kb.db_connection() as connection, connection.cursor() as cursor:
            cursor.execute(
                "INSERT INTO user_notifications(id, tenant_id, user_id, workspace_id, notification_type, title, body, target) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                (notification_id, user.tenant_id, user_id, workspace_id, notification_type, title, body, Json(target or {})),
            )
            connection.commit()
    else:
        runtime._MEMORY["notifications"][notification_id] = record
    return notification_id


def list_notifications(user: UserContext, *, unread_only: bool = False, limit: int = 100) -> dict[str, Any]:
    if runtime._db_available():
        unread = "AND read_at IS NULL" if unread_only else ""
        rows = kb.db_fetch_all(
            f"SELECT * FROM user_notifications WHERE tenant_id = %s AND user_id = %s {unread} ORDER BY created_at DESC LIMIT %s",
            (user.tenant_id, user.user_id, max(1, min(limit, 200))),
        )
        items = [runtime._json_safe(row) for row in rows]
    else:
        items = [item for item in runtime._MEMORY["notifications"].values() if item["tenant_id"] == user.tenant_id and item["user_id"] == user.user_id and (not unread_only or not item.get("read_at"))]
        items.sort(key=lambda item: item["created_at"], reverse=True)
        items = [dict(item) for item in items[:limit]]
    return {"trace_id": trace_id("notice"), "items": items, "unread": sum(1 for item in items if not item.get("read_at"))}


def mark_notification(user: UserContext, notification_id: str, *, read: bool) -> dict[str, Any]:
    value = datetime.now(timezone.utc) if read else None
    if runtime._db_available():
        with kb.db_connection() as connection, connection.cursor() as cursor:
            cursor.execute(
                "UPDATE user_notifications SET read_at = %s WHERE id = %s AND tenant_id = %s AND user_id = %s RETURNING id",
                (value, notification_id, user.tenant_id, user.user_id),
            )
            row = cursor.fetchone()
            connection.commit()
        if not row:
            raise KeyError(notification_id)
    else:
        item = runtime._MEMORY["notifications"].get(notification_id)
        if not item or item["tenant_id"] != user.tenant_id or item["user_id"] != user.user_id:
            raise KeyError(notification_id)
        item["read_at"] = _now() if read else None
    return {"trace_id": trace_id("notice"), "notification_id": notification_id, "read": read}


def save_saved_search(user: UserContext, request: SavedSearchRequest, search_id: str | None = None) -> dict[str, Any]:
    runtime._ensure_identity(user)
    search_id = search_id or f"search-{uuid.uuid4().hex[:12]}"
    record = {
        "id": search_id,
        "tenant_id": user.tenant_id,
        "user_id": user.user_id,
        **request.model_dump(),
        "last_checked_at": None,
        "last_result_ids": [],
        "new_result_count": 0,
        "created_at": _now(),
        "updated_at": _now(),
    }
    if runtime._db_available():
        with kb.db_connection() as connection, connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO saved_searches(id, tenant_id, user_id, name, search_kind, query, filters, alert_frequency, active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, search_kind = EXCLUDED.search_kind,
                  query = EXCLUDED.query, filters = EXCLUDED.filters, alert_frequency = EXCLUDED.alert_frequency,
                  active = EXCLUDED.active, updated_at = now()
                WHERE saved_searches.tenant_id = EXCLUDED.tenant_id AND saved_searches.user_id = EXCLUDED.user_id
                """,
                (search_id, user.tenant_id, user.user_id, request.name, request.search_kind, request.query, Json(request.filters), request.alert_frequency, request.active),
            )
            if cursor.rowcount != 1:
                raise KeyError(search_id)
            connection.commit()
    else:
        previous = runtime._MEMORY["saved_searches"].get(search_id)
        if previous and (previous["tenant_id"] != user.tenant_id or previous["user_id"] != user.user_id):
            raise KeyError(search_id)
        if previous:
            record.update({key: previous.get(key) for key in ["last_checked_at", "last_result_ids", "new_result_count", "created_at"]})
        runtime._MEMORY["saved_searches"][search_id] = record
    runtime._audit(user, "preparation.saved_search_saved", None, {"search_id": search_id, "kind": request.search_kind, "frequency": request.alert_frequency})
    return {"trace_id": trace_id("search"), "search": record}


def list_saved_searches(user: UserContext) -> dict[str, Any]:
    if runtime._db_available():
        rows = kb.db_fetch_all("SELECT * FROM saved_searches WHERE tenant_id = %s AND user_id = %s ORDER BY updated_at DESC", (user.tenant_id, user.user_id))
        items = [runtime._json_safe(row) for row in rows]
    else:
        items = [dict(item) for item in runtime._MEMORY["saved_searches"].values() if item["tenant_id"] == user.tenant_id and item["user_id"] == user.user_id]
        items.sort(key=lambda item: item["updated_at"], reverse=True)
    return {"trace_id": trace_id("search"), "items": items}


def run_saved_search(user: UserContext, search_id: str) -> dict[str, Any]:
    if runtime._db_available():
        saved = kb.db_fetch_one("SELECT * FROM saved_searches WHERE id = %s AND tenant_id = %s AND user_id = %s", (search_id, user.tenant_id, user.user_id))
    else:
        candidate = runtime._MEMORY["saved_searches"].get(search_id)
        saved = candidate if candidate and candidate["tenant_id"] == user.tenant_id and candidate["user_id"] == user.user_id else None
    if not saved:
        raise KeyError(search_id)
    from . import category1

    filters = saved.get("filters") or {}
    if saved["search_kind"] == "licitaciones":
        response = category1.search_tender_explorer(
            user,
            saved["query"],
            cpv=filters.get("cpv"),
            document_type=filters.get("document_type"),
            language=filters.get("language"),
            limit=int(filters.get("limit") or 50),
        )
        result_ids = [str(item["chunk_id"]) for item in response["items"]]
    else:
        response = category1.search_legal_sources(user, saved["query"], source_kind=saved["search_kind"].rstrip("s"), limit=int(filters.get("limit") or 50))
        result_ids = [str(item["id"]) for item in response["items"]]
    previous_ids = set(saved.get("last_result_ids") or [])
    new_ids = [item for item in result_ids if item not in previous_ids]
    checked_at = _now()
    if runtime._db_available():
        with kb.db_connection() as connection, connection.cursor() as cursor:
            cursor.execute("UPDATE saved_searches SET last_checked_at = now(), last_result_ids = %s, new_result_count = %s, updated_at = now() WHERE id = %s AND tenant_id = %s AND user_id = %s", (Json(result_ids), len(new_ids), search_id, user.tenant_id, user.user_id))
            connection.commit()
    else:
        runtime._MEMORY["saved_searches"][search_id].update({"last_checked_at": checked_at, "last_result_ids": result_ids, "new_result_count": len(new_ids), "updated_at": checked_at})
    if new_ids and previous_ids:
        _notify(user, user.user_id, f"{len(new_ids)} novedades en «{saved['name']}»", "La búsqueda guardada tiene nuevos resultados trazables.", notification_type="saved_search", target={"search_id": search_id, "new_result_ids": new_ids[:50]})
    runtime._audit(user, "preparation.saved_search_run", None, {"search_id": search_id, "results": len(result_ids), "new": len(new_ids)})
    return {"trace_id": trace_id("search"), "search_id": search_id, "checked_at": checked_at, "new_result_ids": new_ids, "result": response}


def list_tasks(user: UserContext, workspace_id: str) -> dict[str, Any]:
    _workspace(user, workspace_id)
    if runtime._db_available():
        rows = kb.db_fetch_all("SELECT * FROM workspace_tasks WHERE tenant_id = %s AND workspace_id = %s ORDER BY CASE priority WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END, due_date NULLS LAST, created_at", (user.tenant_id, workspace_id))
        items = [runtime._json_safe(row) for row in rows]
    else:
        items = [dict(item) for item in runtime._MEMORY["workspace_tasks"].values() if item["tenant_id"] == user.tenant_id and item["workspace_id"] == workspace_id]
        priority_order = {"critica": 1, "alta": 2, "media": 3, "baja": 4}
        items.sort(key=lambda item: (priority_order[item["priority"]], item.get("due_date") or "9999-12-31", item["created_at"]))
    today = date.today().isoformat()
    for item in items:
        item["overdue"] = bool(item.get("due_date") and str(item["due_date"]) < today and item["status"] not in {"completada", "cancelada"})
    return {"trace_id": trace_id("task"), "workspace_id": workspace_id, "items": items, "summary": {"open": sum(1 for item in items if item["status"] not in {"completada", "cancelada"}), "overdue": sum(1 for item in items if item["overdue"]), "completed": sum(1 for item in items if item["status"] == "completada")}}


def save_task(user: UserContext, workspace_id: str, request: WorkspaceTaskRequest, task_id: str | None = None) -> dict[str, Any]:
    _workspace(user, workspace_id)
    runtime._ensure_identity(user)
    due_date = _date(request.due_date, "due_date")
    assignee = request.assignee_user_id or user.user_id
    if runtime._db_available() and assignee != user.user_id:
        row = kb.db_fetch_one("SELECT id FROM users WHERE id = %s AND tenant_id = %s", (assignee, user.tenant_id))
        if not row:
            raise ValueError("assignee_not_in_organization")
    task_id = task_id or f"task-{uuid.uuid4().hex[:12]}"
    record = {
        "id": task_id,
        "tenant_id": user.tenant_id,
        "workspace_id": workspace_id,
        **request.model_dump(),
        "assignee_user_id": assignee,
        "due_date": due_date.isoformat() if due_date else None,
        "created_by": user.user_id,
        "completed_by": user.user_id if request.status == "completada" else None,
        "completed_at": _now() if request.status == "completada" else None,
        "created_at": _now(),
        "updated_at": _now(),
    }
    if runtime._db_available():
        with kb.db_connection() as connection, connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO workspace_tasks(id, tenant_id, workspace_id, phase_id, title, description, assignee_user_id, due_date, priority, status, depends_on, source_refs, created_by, completed_by, completed_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET phase_id = EXCLUDED.phase_id, title = EXCLUDED.title,
                  description = EXCLUDED.description, assignee_user_id = EXCLUDED.assignee_user_id,
                  due_date = EXCLUDED.due_date, priority = EXCLUDED.priority, status = EXCLUDED.status,
                  depends_on = EXCLUDED.depends_on, source_refs = EXCLUDED.source_refs,
                  completed_by = EXCLUDED.completed_by, completed_at = EXCLUDED.completed_at, updated_at = now()
                WHERE workspace_tasks.tenant_id = EXCLUDED.tenant_id AND workspace_tasks.workspace_id = EXCLUDED.workspace_id
                """,
                (task_id, user.tenant_id, workspace_id, request.phase_id, request.title, request.description, assignee, due_date, request.priority, request.status, Json(request.depends_on), Json(request.source_refs), user.user_id, record["completed_by"], datetime.now(timezone.utc) if record["completed_by"] else None),
            )
            if cursor.rowcount != 1:
                raise KeyError(task_id)
            connection.commit()
    else:
        previous = runtime._MEMORY["workspace_tasks"].get(task_id)
        if previous and (previous["tenant_id"] != user.tenant_id or previous["workspace_id"] != workspace_id):
            raise KeyError(task_id)
        if previous:
            record["created_at"] = previous["created_at"]
            record["created_by"] = previous["created_by"]
        runtime._MEMORY["workspace_tasks"][task_id] = record
    if assignee != user.user_id:
        _notify(user, assignee, f"Tarea asignada: {request.title}", request.description or "Nueva tarea del expediente.", workspace_id=workspace_id, notification_type="task", target={"task_id": task_id})
    runtime._audit(user, "preparation.task_saved", workspace_id, {"task_id": task_id, "status": request.status, "assignee": assignee})
    return {"trace_id": trace_id("task"), "task": record}


def _chapter_content(user: UserContext, workspace_id: str, document_type: str, chapter_id: str) -> dict[str, Any]:
    chapters = runtime.latest_chapters(user, workspace_id, document_type=normalize_document_kind(document_type))["chapters"]
    chapter = next((item for item in chapters if item["chapter_id"] == chapter_id), None)
    if not chapter:
        raise KeyError(chapter_id)
    return chapter


def add_comment(user: UserContext, workspace_id: str, request: DocumentCommentRequest) -> dict[str, Any]:
    _workspace(user, workspace_id)
    chapter = _chapter_content(user, workspace_id, request.document_type, request.chapter_id)
    runtime._ensure_identity(user)
    content = str(chapter.get("content") or "")
    if request.anchor_start is not None or request.anchor_end is not None:
        if request.anchor_start is None or request.anchor_end is None or request.anchor_end < request.anchor_start or request.anchor_end > len(content):
            raise ValueError("invalid_comment_anchor")
        if request.anchor_text is not None and content[request.anchor_start:request.anchor_end] != request.anchor_text:
            raise ValueError("comment_anchor_stale")
    if request.parent_id:
        parent = _comment_by_id(user, workspace_id, request.parent_id)
        if not parent or parent["chapter_id"] != request.chapter_id:
            raise KeyError(request.parent_id)
    comment_id = f"comment-{uuid.uuid4().hex[:12]}"
    mentions = list(dict.fromkeys(item for item in request.mentions if item != user.user_id))
    record = {
        "id": comment_id,
        "tenant_id": user.tenant_id,
        "workspace_id": workspace_id,
        **request.model_dump(),
        "mentions": mentions,
        "version_id": request.version_id or chapter.get("version_id"),
        "status": "abierto",
        "created_by": user.user_id,
        "resolved_by": None,
        "resolved_at": None,
        "created_at": _now(),
        "updated_at": _now(),
    }
    if runtime._db_available():
        with kb.db_connection() as connection, connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO document_comments(id, tenant_id, workspace_id, document_type, chapter_id, version_id, parent_id, anchor_text, anchor_start, anchor_end, comment_text, mentions, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (comment_id, user.tenant_id, workspace_id, request.document_type, request.chapter_id, record["version_id"], request.parent_id, request.anchor_text, request.anchor_start, request.anchor_end, request.comment_text, Json(mentions), user.user_id),
            )
            connection.commit()
    else:
        runtime._MEMORY["document_comments"][comment_id] = record
    for mentioned_user in mentions:
        if runtime._db_available() and not kb.db_fetch_one("SELECT id FROM users WHERE id = %s AND tenant_id = %s", (mentioned_user, user.tenant_id)):
            continue
        _notify(user, mentioned_user, f"Te han mencionado en {chapter['title']}", request.comment_text[:500], workspace_id=workspace_id, notification_type="comment", target={"comment_id": comment_id, "chapter_id": request.chapter_id})
    runtime._audit(user, "preparation.document_comment_added", workspace_id, {"comment_id": comment_id, "chapter_id": request.chapter_id, "mentions": mentions})
    return {"trace_id": trace_id("comment"), "comment": record}


def _comment_by_id(user: UserContext, workspace_id: str, comment_id: str) -> dict[str, Any] | None:
    if runtime._db_available():
        row = kb.db_fetch_one("SELECT * FROM document_comments WHERE id = %s AND tenant_id = %s AND workspace_id = %s", (comment_id, user.tenant_id, workspace_id))
        return runtime._json_safe(row) if row else None
    item = runtime._MEMORY["document_comments"].get(comment_id)
    return dict(item) if item and item["tenant_id"] == user.tenant_id and item["workspace_id"] == workspace_id else None


def list_comments(user: UserContext, workspace_id: str, *, chapter_id: str | None = None, include_resolved: bool = False) -> dict[str, Any]:
    _workspace(user, workspace_id)
    if runtime._db_available():
        resolved = "" if include_resolved else "AND status = 'abierto'"
        rows = kb.db_fetch_all(f"SELECT * FROM document_comments WHERE tenant_id = %s AND workspace_id = %s AND (%s::text IS NULL OR chapter_id = %s) {resolved} ORDER BY created_at", (user.tenant_id, workspace_id, chapter_id, chapter_id))
        items = [runtime._json_safe(row) for row in rows]
    else:
        items = [dict(item) for item in runtime._MEMORY["document_comments"].values() if item["tenant_id"] == user.tenant_id and item["workspace_id"] == workspace_id and (not chapter_id or item["chapter_id"] == chapter_id) and (include_resolved or item["status"] == "abierto")]
        items.sort(key=lambda item: item["created_at"])
    return {"trace_id": trace_id("comment"), "workspace_id": workspace_id, "items": items, "open": sum(1 for item in items if item["status"] == "abierto")}


def resolve_comment(user: UserContext, workspace_id: str, comment_id: str, request: CommentResolutionRequest) -> dict[str, Any]:
    if not _comment_by_id(user, workspace_id, comment_id):
        raise KeyError(comment_id)
    resolved_by = user.user_id if request.status == "resuelto" else None
    resolved_at = datetime.now(timezone.utc) if resolved_by else None
    if runtime._db_available():
        with kb.db_connection() as connection, connection.cursor() as cursor:
            cursor.execute("UPDATE document_comments SET status = %s, resolved_by = %s, resolved_at = %s, updated_at = now() WHERE id = %s AND tenant_id = %s AND workspace_id = %s", (request.status, resolved_by, resolved_at, comment_id, user.tenant_id, workspace_id))
            connection.commit()
    else:
        runtime._MEMORY["document_comments"][comment_id].update({"status": request.status, "resolved_by": resolved_by, "resolved_at": resolved_at.isoformat() if resolved_at else None, "updated_at": _now()})
    runtime._audit(user, "preparation.document_comment_resolved", workspace_id, {"comment_id": comment_id, "status": request.status})
    return {"trace_id": trace_id("comment"), "comment_id": comment_id, "status": request.status}


def save_clause(user: UserContext, request: ClauseCatalogRequest, clause_id: str | None = None) -> dict[str, Any]:
    runtime._ensure_identity(user)
    clause_id = clause_id or f"clause-{uuid.uuid4().hex[:12]}"
    detected_variables = sorted(set(re.findall(r"\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}", request.content_text)))
    variables = sorted(set(request.variables) | set(detected_variables))
    if request.status == "aprobada" and not request.change_summary:
        raise ValueError("approved_clause_requires_review_summary")
    if runtime._db_available():
        existing = kb.db_fetch_one("SELECT * FROM clause_catalog_entries WHERE id = %s AND tenant_id = %s", (clause_id, user.tenant_id))
        row = kb.db_fetch_one("SELECT COALESCE(max(version_number), 0) + 1 AS version FROM clause_catalog_versions WHERE clause_id = %s", (clause_id,))
        version_number = int((row or {}).get("version") or 1)
    else:
        existing = runtime._MEMORY["clause_catalog_entries"].get(clause_id)
        if existing and existing["tenant_id"] != user.tenant_id:
            raise KeyError(clause_id)
        version_number = 1 + max([item["version_number"] for item in runtime._MEMORY["clause_catalog_versions"].values() if item["clause_id"] == clause_id] or [0])
    version_id = f"clausever-{uuid.uuid4().hex[:12]}"
    content_hash = hashlib.sha256(request.content_text.encode("utf-8")).hexdigest()
    entry = {"id": clause_id, "tenant_id": user.tenant_id, "title": request.title, "document_types": request.document_types, "contract_types": request.contract_types, "procedure_types": request.procedure_types, "tags": request.tags, "visibility": request.visibility, "status": request.status, "active_version_id": version_id, "created_by": (existing or {}).get("created_by") or user.user_id, "reviewed_by": user.user_id if request.status == "aprobada" else None, "reviewed_at": _now() if request.status == "aprobada" else None, "created_at": runtime._json_safe((existing or {}).get("created_at")) or _now(), "updated_at": _now()}
    version = {"id": version_id, "clause_id": clause_id, "version_number": version_number, "content_text": request.content_text, "variables": variables, "legal_source_ids": request.legal_source_ids, "source_clause_ids": request.source_clause_ids, "change_summary": request.change_summary, "content_hash": content_hash, "created_by": user.user_id, "created_at": _now()}
    if runtime._db_available():
        with kb.db_connection() as connection, connection.cursor() as cursor:
            cursor.execute("SET CONSTRAINTS clause_catalog_active_version_fk DEFERRED")
            cursor.execute(
                """
                INSERT INTO clause_catalog_entries(id, tenant_id, title, document_types, contract_types, procedure_types, tags, visibility, status, created_by, reviewed_by, reviewed_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, document_types = EXCLUDED.document_types,
                  contract_types = EXCLUDED.contract_types, procedure_types = EXCLUDED.procedure_types,
                  tags = EXCLUDED.tags, visibility = EXCLUDED.visibility, status = EXCLUDED.status,
                  reviewed_by = EXCLUDED.reviewed_by, reviewed_at = EXCLUDED.reviewed_at, updated_at = now()
                WHERE clause_catalog_entries.tenant_id = EXCLUDED.tenant_id
                """,
                (clause_id, user.tenant_id, request.title, Json(request.document_types), Json(request.contract_types), Json(request.procedure_types), Json(request.tags), request.visibility, request.status, user.user_id, entry["reviewed_by"], datetime.now(timezone.utc) if entry["reviewed_by"] else None),
            )
            if cursor.rowcount != 1:
                raise KeyError(clause_id)
            cursor.execute("INSERT INTO clause_catalog_versions(id, clause_id, version_number, content_text, variables, legal_source_ids, source_clause_ids, change_summary, content_hash, created_by) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)", (version_id, clause_id, version_number, request.content_text, Json(variables), Json(request.legal_source_ids), Json(request.source_clause_ids), request.change_summary, content_hash, user.user_id))
            cursor.execute("UPDATE clause_catalog_entries SET active_version_id = %s WHERE id = %s AND tenant_id = %s", (version_id, clause_id, user.tenant_id))
            connection.commit()
    else:
        runtime._MEMORY["clause_catalog_entries"][clause_id] = entry
        runtime._MEMORY["clause_catalog_versions"][version_id] = version
    runtime._audit(user, "preparation.clause_saved", None, {"clause_id": clause_id, "version_id": version_id, "status": request.status})
    return {"trace_id": trace_id("clause"), "clause": entry, "version": version}


def list_clauses(user: UserContext, *, query: str | None = None, document_type: str | None = None, status: str | None = None) -> dict[str, Any]:
    if runtime._db_available():
        rows = kb.db_fetch_all(
            """
            SELECT e.*, v.version_number, v.content_text, v.variables, v.legal_source_ids,
                   v.source_clause_ids, v.change_summary, v.content_hash
            FROM clause_catalog_entries e
            JOIN clause_catalog_versions v ON v.id = e.active_version_id
            WHERE e.tenant_id = %s AND e.archived_at IS NULL
              AND (%s::text IS NULL OR e.status = %s)
              AND (%s::text IS NULL OR e.document_types @> %s::jsonb)
              AND (%s::text IS NULL OR e.title ILIKE ('%%' || %s || '%%') OR v.content_text ILIKE ('%%' || %s || '%%'))
            ORDER BY CASE e.status WHEN 'aprobada' THEN 1 WHEN 'en_revision' THEN 2 ELSE 3 END, e.updated_at DESC
            """,
            (user.tenant_id, status, status, document_type, Json([document_type]) if document_type else None, query, query, query),
        )
        items = [runtime._json_safe(row) for row in rows]
    else:
        items = []
        for entry in runtime._MEMORY["clause_catalog_entries"].values():
            if entry["tenant_id"] != user.tenant_id or entry.get("archived_at") or (status and entry["status"] != status) or (document_type and document_type not in entry["document_types"]):
                continue
            version = runtime._MEMORY["clause_catalog_versions"].get(entry.get("active_version_id"), {})
            if query and query.lower() not in f"{entry['title']} {version.get('content_text','')}".lower():
                continue
            items.append({**entry, **{key: value for key, value in version.items() if key not in {"id", "clause_id"}}})
        items.sort(key=lambda item: (0 if item["status"] == "aprobada" else 1, item["updated_at"]), reverse=True)
    return {"trace_id": trace_id("clause"), "items": items}


def render_clause(user: UserContext, workspace_id: str, clause_id: str) -> dict[str, Any]:
    workspace = _workspace(user, workspace_id)
    clauses = list_clauses(user)["items"]
    clause = next((item for item in clauses if item["id"] == clause_id), None)
    if not clause:
        raise KeyError(clause_id)
    content = str(clause.get("content_text") or "")
    variables = list(clause.get("variables") or [])
    unresolved = []
    rendered = content
    for variable in variables:
        value: Any = workspace
        for part in variable.split("."):
            value = value.get(part) if isinstance(value, dict) else None
        if value is None or value == "" or value == []:
            unresolved.append(variable)
            replacement = f"[PENDIENTE: {variable}]"
        elif isinstance(value, (dict, list)):
            replacement = str(value)
        else:
            replacement = str(value)
        rendered = re.sub(r"\{\{\s*" + re.escape(variable) + r"\s*\}\}", replacement, rendered)
    runtime._audit(user, "preparation.clause_rendered", workspace_id, {"clause_id": clause_id, "version": clause.get("version_number"), "unresolved": unresolved})
    return {"trace_id": trace_id("clause"), "clause_id": clause_id, "source_version": clause.get("version_number"), "proposal": rendered, "unresolved_variables": unresolved, "requires_human_acceptance": True, "legal_source_ids": clause.get("legal_source_ids") or []}


DEFAULT_PRINT_CONFIGURATION = {
    "font_family": "Arial",
    "font_size": 10.5,
    "heading_color": "#17324d",
    "margins_mm": {"top": 22, "right": 22, "bottom": 22, "left": 25},
    "header_text": "{{ contracting_body }}",
    "footer_text": "{{ file_number }} · {{ title }}",
    "show_ai_review_notice": True,
}


def get_print_profile(user: UserContext) -> dict[str, Any]:
    if runtime._db_available():
        row = kb.db_fetch_one("SELECT * FROM print_profiles WHERE tenant_id = %s", (user.tenant_id,))
    else:
        row = runtime._MEMORY["print_profiles"].get(user.tenant_id)
    configuration = {**DEFAULT_PRINT_CONFIGURATION, **((row or {}).get("configuration") or {})}
    return {"trace_id": trace_id("print"), "configuration": configuration, "updated_at": runtime._json_safe((row or {}).get("updated_at"))}


def update_print_profile(user: UserContext, request: PrintProfileRequest) -> dict[str, Any]:
    allowed = set(DEFAULT_PRINT_CONFIGURATION)
    unknown = set(request.configuration) - allowed
    if unknown:
        raise ValueError(f"unknown_print_fields:{','.join(sorted(unknown))}")
    configuration = {**get_print_profile(user)["configuration"], **request.configuration}
    margins = configuration.get("margins_mm") or {}
    if any(float(value) < 5 or float(value) > 60 for value in margins.values()):
        raise ValueError("invalid_print_margins")
    runtime._ensure_identity(user)
    if runtime._db_available():
        with kb.db_connection() as connection, connection.cursor() as cursor:
            cursor.execute("INSERT INTO print_profiles(tenant_id, configuration, updated_by) VALUES (%s, %s, %s) ON CONFLICT (tenant_id) DO UPDATE SET configuration = EXCLUDED.configuration, updated_by = EXCLUDED.updated_by, updated_at = now()", (user.tenant_id, Json(configuration), user.user_id))
            connection.commit()
    else:
        runtime._MEMORY["print_profiles"][user.tenant_id] = {"tenant_id": user.tenant_id, "configuration": configuration, "updated_by": user.user_id, "updated_at": _now()}
    runtime._audit(user, "preparation.print_profile_updated", None, {"fields": sorted(request.configuration)})
    return get_print_profile(user)


def update_document_sharing(user: UserContext, workspace_id: str, document_type: str, request: DocumentSharingRequest) -> dict[str, Any]:
    workspace = _workspace(user, workspace_id)
    kind = normalize_document_kind(document_type)
    if kind not in (workspace.get("document_indexes") or {}):
        raise KeyError(f"document_not_initialized:{kind}")
    if runtime._db_available():
        with kb.db_connection() as connection, connection.cursor() as cursor:
            cursor.execute("UPDATE workspace_documents SET visibility = %s, owner_user_id = COALESCE(owner_user_id, %s), updated_at = now() WHERE tenant_id = %s AND workspace_id = %s AND document_type = %s RETURNING id", (request.visibility, user.user_id, user.tenant_id, workspace_id, kind))
            row = cursor.fetchone()
            connection.commit()
        if not row:
            raise KeyError(kind)
    else:
        sharing = dict(workspace.get("document_sharing") or {})
        sharing[kind] = {"visibility": request.visibility, "owner_user_id": user.user_id, "updated_at": _now()}
        workspace["document_sharing"] = sharing
        runtime._persist_workspace(user, workspace)
    runtime._audit(user, "preparation.document_sharing_updated", workspace_id, {"document_type": kind, "visibility": request.visibility})
    return {"trace_id": trace_id("share"), "workspace_id": workspace_id, "document_type": kind, "visibility": request.visibility}
