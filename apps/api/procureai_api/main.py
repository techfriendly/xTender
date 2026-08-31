from __future__ import annotations

import io
import hashlib
import json
import secrets
from typing import Any

from fastapi import Body, Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse

from .config import load_runtime_config, sanitized_config
from . import cpv, kb
from .models import (
    AssistantMessageRequest,
    AssistantSessionRequest,
    AdvancedValidationRequest,
    AiOutputReviewRequest,
    AnnualPlanItemRequest,
    ChapterDraftRequest,
    ChapterImproveRequest,
    ChapterUpdateRequest,
    CpvContextRequest,
    CpvSuggestRequest,
    DraftIndexRequest,
    DraftIndexUpdateRequest,
    DocumentStatusRequest,
    EconomicCalculationRequest,
    GuidedMessageRequest,
    GuidedSuggestionRequest,
    GuidedSessionRequest,
    ExportDocxRequest,
    ExportDossierRequest,
    FeedbackRequest,
    ImpactProposalRequest,
    IssueResolutionRequest,
    LegalKnowledgeSourceRequest,
    LiteracyCompletionRequest,
    ComplianceProfileRequest,
    ClauseCatalogRequest,
    CommentResolutionRequest,
    DocumentCommentRequest,
    DocumentSharingRequest,
    MarketStudyRequest,
    ProcurementRiskRequest,
    ProcurementScheduleRequest,
    OfficialSourceSyncRequest,
    PrintProfileRequest,
    ProposalResolutionRequest,
    ReferenceAcceptRequest,
    ReferenceSelectRequest,
    RegenerationProposalRequest,
    SearchRequest,
    SearchResponse,
    SavedSearchRequest,
    TemplateRequest,
    UserContext,
    ValidationRequest,
    WorkspacePayload,
    WorkspaceCreate,
    WorkspaceTemplateLinksRequest,
    WorkspaceUpdate,
    WorkspaceTaskRequest,
    WorkspaceSourceUpdateRequest,
)
from . import category1, collaboration, document_workflow, official_sources, runtime
from .services import search_chunks, trace_id

app = FastAPI(
    title="xTender API",
    version="0.1.0",
    description="API-first platform for assisted public procurement preparation with traceability.",
)

_startup_config = load_runtime_config()

app.add_middleware(
    CORSMiddleware,
    allow_origins=_startup_config.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


ROLE_PERMISSIONS: dict[str, set[str]] = {
    "administrador": {"read", "edit", "validate", "export"},
    "admin": {"read", "edit", "validate", "export"},
    "responsable_contratacion": {"read", "edit", "validate", "export"},
    "tecnico_promotor": {"read", "edit"},
    "editor": {"read", "edit"},
    "juridico": {"read", "edit", "validate", "export"},
    "control_economico": {"read", "validate", "export"},
    "revisor": {"read", "validate", "export"},
    "consulta": {"read"},
    "lector": {"read"},
}


def _required_permission(request: Request) -> str:
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return "read"
    path = request.url.path
    if path.startswith("/exports/"):
        return "export"
    if (
        path.startswith("/validate/")
        or path.startswith("/validation-issues/")
        or path.startswith("/preparation/validation")
        or path.startswith("/preparation/ai-reviews")
        or path.endswith("/validate")
        or path.endswith("/status")
        or (request.method == "PATCH" and (path.startswith("/regeneration-proposals/") or path.startswith("/change-proposals/")))
    ):
        return "validate"
    return "edit"


def normalize_assistant_target(target_documents: list[str]) -> str:
    aliases = {
        "memoria": "informe_necesidad",
        "informe": "informe_necesidad",
        "informe_necesidad": "informe_necesidad",
        "ppt": "ppt",
        "pcap": "pcap",
        "juridico": "informe_juridico",
        "informe_juridico": "informe_juridico",
    }
    for target in target_documents:
        normalized = aliases.get(str(target).lower())
        if normalized:
            return normalized
    return "ppt"


def current_user(
    request: Request,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None),
    x_tenant_id: str | None = Header(default=None),
    x_roles: str | None = Header(default=None),
) -> UserContext:
    config = load_runtime_config()
    environment = config.app_env.strip().lower()
    local_environment = environment in {"local", "development", "dev", "test"}
    if config.auth_mode == "development_headers" and local_environment:
        user_id = x_user_id or "demo-user"
        tenant_id = x_tenant_id or "tenant-demo"
        role_header = x_roles or "responsable_contratacion"
    elif config.auth_mode == "bearer":
        if not config.auth_bearer_token:
            raise HTTPException(status_code=503, detail="authentication_not_configured")
        scheme, _, token = (authorization or "").partition(" ")
        if scheme.lower() != "bearer" or not secrets.compare_digest(token, config.auth_bearer_token):
            raise HTTPException(status_code=401, detail="invalid_or_missing_bearer_token", headers={"WWW-Authenticate": "Bearer"})
        if not x_user_id or not x_tenant_id:
            raise HTTPException(status_code=401, detail="trusted_identity_headers_required")
        user_id = x_user_id
        tenant_id = x_tenant_id
        role_header = x_roles or "consulta"
    else:
        raise HTTPException(status_code=503, detail="insecure_or_unknown_auth_mode")

    roles = [role.strip().lower() for role in role_header.split(",") if role.strip()]
    permissions = set().union(*(ROLE_PERMISSIONS.get(role, set()) for role in roles))
    required = _required_permission(request)
    if required not in permissions:
        raise HTTPException(status_code=403, detail=f"permission_required:{required}")
    return UserContext(user_id=user_id, tenant_id=tenant_id, roles=roles)


@app.get("/health")
def health() -> dict[str, Any]:
    config = load_runtime_config()
    return {
        "status": "ok",
        "service": "xtender-api",
        "kb_backend": kb.summary().get("backend"),
        "milvus_collection": config.milvus_collection,
        "embedding_model": config.embedding_model,
        "object_storage": "SeaweedFS S3-compatible",
    }


@app.get("/llm2/health")
def llm2_health(_: UserContext = Depends(current_user)) -> dict[str, Any]:
    return runtime.llm2_health()


@app.get("/config/runtime")
def runtime_config(_: UserContext = Depends(current_user)) -> dict[str, Any]:
    config = load_runtime_config()
    return {"trace_id": trace_id("cfg"), "config": sanitized_config(config), "context_budget": config.reserved_context_budget}


@app.post("/sources")
def create_source(payload: dict[str, Any] = Body(default_factory=dict), _: UserContext = Depends(current_user)) -> dict[str, Any]:
    raise HTTPException(status_code=410, detail="use_workspace_sources_upload_with_a_real_file")


@app.post("/crawl-jobs")
def create_crawl_job(payload: dict[str, Any] = Body(default_factory=dict), _: UserContext = Depends(current_user)) -> dict[str, Any]:
    raise HTTPException(status_code=501, detail="crawl_worker_not_configured")


@app.get("/documents")
def list_documents(_: UserContext = Depends(current_user)) -> dict[str, Any]:
    return {"trace_id": trace_id("doc"), "items": kb.documents(), "summary": kb.summary()}


@app.get("/documents/{document_id}")
def get_document(document_id: str, _: UserContext = Depends(current_user)) -> dict[str, Any]:
    document = kb.document_by_id(document_id)
    if not document:
        raise HTTPException(status_code=404, detail="document_not_found")
    return {"trace_id": trace_id("doc"), "document": document}


@app.get("/documents/{document_id}/versions")
def get_document_versions(document_id: str, _: UserContext = Depends(current_user)) -> dict[str, Any]:
    document = kb.document_by_id(document_id)
    if not document:
        raise HTTPException(status_code=404, detail="document_not_found")
    try:
        source_hash = hashlib.sha256(kb.markdown_for_document(document_id).encode("utf-8")).hexdigest()
    except (KeyError, FileNotFoundError):
        source_hash = None
    return {
        "trace_id": trace_id("ver"),
        "document_id": document_id,
        "versions": [{
            "version_id": f"{document_id}:source",
            "version_label": "fuente_indexada",
            "content_hash": source_hash,
            "source_url": document.get("source_url"),
            "immutable_reference": True,
        }],
    }


@app.get("/documents/{document_id}/markdown")
def get_document_markdown(document_id: str, _: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        markdown = kb.markdown_for_document(document_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="document_not_found")
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="markdown_not_found") from exc
    return {"trace_id": trace_id("md"), "document_id": document_id, "markdown": markdown}


@app.get("/documents/{document_id}/pdf")
def get_document_pdf(document_id: str, _: UserContext = Depends(current_user)) -> dict[str, Any]:
    document = kb.document_by_id(document_id)
    if not document:
        raise HTTPException(status_code=404, detail="document_not_found")
    return {"trace_id": trace_id("pdf"), "document_id": document_id, "source_url": document["source_url"]}


@app.post("/ingest")
@app.post("/extract")
@app.post("/chunk")
@app.post("/embed")
@app.post("/index")
def create_pipeline_job(payload: dict[str, Any] = Body(default_factory=dict), _: UserContext = Depends(current_user)) -> dict[str, Any]:
    raise HTTPException(status_code=501, detail="asynchronous_ingestion_worker_not_configured")


@app.post("/search", response_model=SearchResponse)
def search(request: SearchRequest, user: UserContext = Depends(current_user)) -> SearchResponse:
    hits = search_chunks(
        request.query,
        tender_id=request.tender_id,
        cpv=request.cpv,
        document_type=request.document_type,
        language=request.language,
        top_k=request.top_k,
    )
    return SearchResponse(
        trace_id=trace_id("search"),
        mode=f"real_pcsp_{kb.summary().get('backend', 'json_fallback')}_hybrid_ready",
        hits=hits,
        applied_filters={
            "tenant_id": user.tenant_id,
            "tender_id": request.tender_id,
            "cpv": request.cpv,
            "document_type": request.document_type,
            "language": request.language,
        },
    )


@app.get("/cpv")
def search_cpv(q: str | None = None, language: str = "es", limit: int = 30, _: UserContext = Depends(current_user)) -> dict[str, Any]:
    return {"trace_id": trace_id("cpv"), **cpv.search(q, language=language, limit=max(1, min(limit, 100)))}


@app.post("/cpv/suggest")
def suggest_cpv(request: CpvSuggestRequest, _: UserContext = Depends(current_user)) -> dict[str, Any]:
    return {
        "trace_id": trace_id("cpv"),
        **cpv.suggest(
            query_text=request.query,
            title=request.title,
            object_text=request.object,
            need=request.need,
            language=request.language,
            top_k=request.top_k,
            selected_codes=request.selected_codes,
        ),
    }


@app.post("/cpv/context")
def cpv_context(request: CpvContextRequest, _: UserContext = Depends(current_user)) -> dict[str, Any]:
    return {"trace_id": trace_id("cpvctx"), **runtime.extract_cpv_context(request)}


@app.get("/workspaces")
def list_workspaces(
    include_archived: bool = False,
    q: str | None = None,
    page: int | None = None,
    page_size: int | None = None,
    user: UserContext = Depends(current_user),
) -> dict[str, Any]:
    return runtime.list_workspaces(user, include_archived=include_archived, query=q, page=page, page_size=page_size)


@app.post("/workspaces")
def create_workspace(payload: WorkspaceCreate, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    return runtime.create_workspace(user, payload)


@app.get("/workspaces/{workspace_id}")
def get_workspace(workspace_id: str, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    workspace = runtime.get_workspace(user, workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="workspace_not_found")
    return {"trace_id": trace_id("ws"), "workspace": workspace}


@app.get("/document-specs")
def get_document_specs(_: UserContext = Depends(current_user)) -> dict[str, Any]:
    return document_workflow.specs()


@app.get("/workspaces/{workspace_id}/documents")
def get_workspace_documents(workspace_id: str, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return document_workflow.document_overview(user, workspace_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc


@app.patch("/workspaces/{workspace_id}")
def update_workspace(workspace_id: str, payload: WorkspaceUpdate, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return runtime.update_workspace(user, workspace_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc


@app.post("/workspaces/{workspace_id}/activate")
def activate_workspace(workspace_id: str, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return runtime.activate_workspace(user, workspace_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc


@app.post("/workspaces/{workspace_id}/archive")
def archive_workspace(workspace_id: str, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return runtime.archive_workspace(user, workspace_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc


@app.post("/workspaces/{workspace_id}/restore")
def restore_workspace(workspace_id: str, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return runtime.restore_workspace(user, workspace_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc


@app.get("/templates")
def list_templates(
    status: str | None = None,
    document_type: str | None = None,
    q: str | None = None,
    page: int = 1,
    page_size: int = 10,
    user: UserContext = Depends(current_user),
) -> dict[str, Any]:
    return runtime.list_templates(user, status=status, document_type=document_type, query=q, page=page, page_size=page_size)


@app.post("/templates/upload")
async def upload_template(
    file: UploadFile = File(...),
    name: str = Form(...),
    document_type: str = Form("ppt"),
    language: str = Form("es"),
    tags: str = Form(""),
    workspace_id: str | None = Form(None),
    user: UserContext = Depends(current_user),
) -> dict[str, Any]:
    content = await file.read(runtime.MAX_TEMPLATE_BYTES + 1)
    tag_items = [item.strip() for item in tags.split(",") if item.strip()]
    try:
        return runtime.register_template_upload(
            user,
            name=name,
            document_type=document_type,
            language=language,
            tags=tag_items,
            source_filename=file.filename or name,
            source_mime=file.content_type or "application/octet-stream",
            content=content,
            workspace_id=workspace_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/templates")
def register_template(request: TemplateRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return runtime.register_template(user, request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/templates/{template_id}")
def get_template(template_id: str, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return runtime.get_template(user, template_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="template_not_found") from exc


@app.post("/templates/{template_id}/archive")
def archive_template(template_id: str, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return runtime.archive_template(user, template_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="template_not_found") from exc


@app.post("/templates/{template_id}/restore")
def restore_template(template_id: str, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return runtime.restore_template(user, template_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="template_not_found") from exc


@app.post("/templates/{template_id}/process")
def process_template(template_id: str, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return runtime.process_template(user, template_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="template_not_found") from exc


@app.get("/templates/{template_id}/sections")
def get_template_sections(template_id: str, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return runtime.get_template_sections(user, template_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="template_not_found") from exc


@app.get("/workspaces/{workspace_id}/templates")
def get_workspace_templates(workspace_id: str, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return runtime.workspace_templates(user, workspace_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc


@app.put("/workspaces/{workspace_id}/templates")
def put_workspace_templates(workspace_id: str, request: WorkspaceTemplateLinksRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return runtime.update_workspace_templates(user, workspace_id, request.templates)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc


@app.post("/elicit/sessions")
def create_guided_session(request: GuidedSessionRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return runtime.create_guided_session(user, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc


@app.post("/elicit/sessions/{session_id}/message")
def guided_message(session_id: str, request: GuidedMessageRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return runtime.guided_message(user, session_id, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/workspaces/{workspace_id}/guided-suggestion")
def guided_suggestion(workspace_id: str, request: GuidedSuggestionRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        request.workspace_id = workspace_id
        return runtime.suggest_guided_field(user, workspace_id, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/workspaces/{workspace_id}/guided-suggestion/stream")
def stream_guided_suggestion(workspace_id: str, request: GuidedSuggestionRequest, user: UserContext = Depends(current_user)) -> StreamingResponse:
    request.workspace_id = workspace_id

    def events():
        for event in runtime.stream_guided_suggestion_events(user, workspace_id, request):
            event_type = event.get("type", "message")
            payload = {key: value for key, value in event.items() if key != "type"}
            yield f"event: {event_type}\n"
            yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")


@app.post("/references/auto-select")
def auto_select_references(request: ReferenceSelectRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return runtime.auto_select_references(user, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc


@app.patch("/workspaces/{workspace_id}/references")
def update_accepted_references(workspace_id: str, request: ReferenceAcceptRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return runtime.update_accepted_references(user, workspace_id, request.references, request.document_type)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc


@app.post("/draft-index")
def draft_index(request: DraftIndexRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return runtime.propose_draft_index(user, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc


@app.post("/draft-index/{index_id}/validate")
def validate_draft_index(index_id: str, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return runtime.validate_draft_index(user, index_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="index_not_found") from exc


@app.put("/workspaces/{workspace_id}/documents/{document_type}/index")
def put_document_index(
    workspace_id: str,
    document_type: str,
    request: DraftIndexUpdateRequest,
    user: UserContext = Depends(current_user),
) -> dict[str, Any]:
    if request.workspace_id != workspace_id or request.document_type != document_type:
        raise HTTPException(status_code=400, detail="document_request_mismatch")
    try:
        return document_workflow.update_index(user, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.patch("/workspaces/{workspace_id}/documents/{document_type}/status")
def patch_document_status(
    workspace_id: str,
    document_type: str,
    request: DocumentStatusRequest,
    user: UserContext = Depends(current_user),
) -> dict[str, Any]:
    try:
        return document_workflow.set_document_status(user, workspace_id, document_type, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.get("/workspaces/{workspace_id}/chapters")
def list_chapters(workspace_id: str, document_type: str | None = None, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return runtime.latest_chapters(user, workspace_id, document_type=document_type)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc


@app.post("/chapters/{chapter_id}/draft")
def draft_runtime_chapter(chapter_id: str, request: ChapterDraftRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        request.chapter_id = chapter_id
        return runtime.draft_chapter_runtime(user, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="chapter_not_found") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/chapters/{chapter_id}/draft/stream")
def stream_runtime_chapter(chapter_id: str, request: ChapterDraftRequest, user: UserContext = Depends(current_user)) -> StreamingResponse:
    request.chapter_id = chapter_id

    def events():
        for event in runtime.stream_chapter_draft_events(user, request):
            event_type = event.get("type", "message")
            payload = {key: value for key, value in event.items() if key != "type"}
            yield f"event: {event_type}\n"
            yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")


@app.patch("/chapters/{chapter_id}")
def update_chapter(chapter_id: str, request: ChapterUpdateRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return runtime.update_chapter(user, chapter_id, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="chapter_not_found") from exc
    except RuntimeError as exc:
        if str(exc) == "chapter_version_conflict":
            raise HTTPException(status_code=409, detail="chapter_version_conflict") from exc
        raise


@app.get("/workspaces/{workspace_id}/chapters/{chapter_id}/versions")
def get_chapter_versions(workspace_id: str, chapter_id: str, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return document_workflow.chapter_versions(user, workspace_id, chapter_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="chapter_not_found") from exc


@app.get("/workspaces/{workspace_id}/chapters/{chapter_id}/versions/compare")
def compare_chapter_versions(
    workspace_id: str,
    chapter_id: str,
    left: str,
    right: str,
    user: UserContext = Depends(current_user),
) -> dict[str, Any]:
    try:
        return document_workflow.compare_versions(user, workspace_id, chapter_id, left, right)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="version_not_found") from exc


@app.post("/workspaces/{workspace_id}/chapters/{chapter_id}/versions/{version_id}/restore")
def restore_chapter_version(
    workspace_id: str,
    chapter_id: str,
    version_id: str,
    payload: dict[str, Any] = Body(default_factory=dict),
    user: UserContext = Depends(current_user),
) -> dict[str, Any]:
    comment = str(payload.get("comment") or "Restauración solicitada por la persona usuaria").strip()
    try:
        return document_workflow.restore_version(user, workspace_id, chapter_id, version_id, comment)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="version_not_found") from exc


@app.post("/chapters/{chapter_id}/regeneration-proposals")
def propose_chapter_regeneration(chapter_id: str, request: RegenerationProposalRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return document_workflow.create_regeneration_proposal(user, chapter_id, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="chapter_not_found") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/workspaces/{workspace_id}/regeneration-proposals")
def get_regeneration_proposals(workspace_id: str, chapter_id: str | None = None, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return document_workflow.list_regeneration_proposals(user, workspace_id, chapter_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc


@app.patch("/regeneration-proposals/{proposal_id}")
def patch_regeneration_proposal(proposal_id: str, request: ProposalResolutionRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return document_workflow.resolve_regeneration(user, proposal_id, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="proposal_not_found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.get("/workspaces/{workspace_id}/change-proposals")
def get_change_proposals(workspace_id: str, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return document_workflow.list_change_proposals(user, workspace_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc


@app.patch("/change-proposals/{proposal_id}")
def patch_change_proposal(proposal_id: str, request: ProposalResolutionRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return document_workflow.resolve_change_proposal(user, proposal_id, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="proposal_not_found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/chapters/{chapter_id}/improve")
def improve_chapter(chapter_id: str, request: ChapterImproveRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return runtime.improve_chapter_text(user, chapter_id, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="chapter_not_found") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/chapters/{chapter_id}/improve/stream")
def stream_improve_chapter(chapter_id: str, request: ChapterImproveRequest, user: UserContext = Depends(current_user)) -> StreamingResponse:
    def events():
        for event in runtime.stream_chapter_improve_events(user, chapter_id, request):
            event_type = event.get("type", "message")
            payload = {key: value for key, value in event.items() if key != "type"}
            yield f"event: {event_type}\n"
            yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")


@app.post("/chapters/{chapter_id}/impact-proposals")
def chapter_impact_proposals(chapter_id: str, request: ImpactProposalRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return runtime.impact_proposals(user, chapter_id, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="chapter_not_found") from exc


@app.post("/exports/docx")
def export_docx(request: ExportDocxRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return runtime.export_docx(user, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc


@app.get("/exports/docx/download")
def download_docx(workspace_id: str, document_type: str = "ppt", only_validated: bool = False, user: UserContext = Depends(current_user)) -> StreamingResponse:
    try:
        payload = ExportDocxRequest(workspace_id=workspace_id, document_type=document_type, only_validated=only_validated)
        export = runtime.build_docx_export(user, payload, store=False)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc
    headers = {"Content-Disposition": f'attachment; filename="{export["filename"]}"'}
    return StreamingResponse(io.BytesIO(export["data"]), media_type=export["content_type"], headers=headers)


@app.post("/exports/dossier")
def export_dossier(request: ExportDossierRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return runtime.export_dossier(user, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.get("/exports/dossier/download")
def download_dossier(
    workspace_id: str,
    only_final: bool = False,
    document_types: str | None = None,
    user: UserContext = Depends(current_user),
) -> StreamingResponse:
    selected_types = [item.strip() for item in (document_types or "").split(",") if item.strip()]
    allowed_types = {"informe_necesidad", "ppt", "pcap", "informe_juridico"}
    if any(item not in allowed_types for item in selected_types):
        raise HTTPException(status_code=422, detail="invalid_document_type")
    try:
        export = runtime.build_dossier_export(
            user,
            ExportDossierRequest(
                workspace_id=workspace_id,
                document_types=selected_types or ["informe_necesidad", "ppt", "pcap", "informe_juridico"],
                only_final=only_final,
            ),
            store=False,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    headers = {"Content-Disposition": f'attachment; filename="{export["filename"]}"'}
    return StreamingResponse(io.BytesIO(export["data"]), media_type="application/zip", headers=headers)


@app.post("/assistant/sessions")
def create_assistant_session(request: AssistantSessionRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        response = runtime.create_guided_session(
            user,
            GuidedSessionRequest(
                workspace_id=request.workspace_id,
                language=request.language,
                target_document=normalize_assistant_target(request.target_documents),
            ),
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc
    return {**response, "target_documents": request.target_documents, "compatibility_route": True}


@app.post("/assistant/sessions/{session_id}/message")
def assistant_message(session_id: str, request: AssistantMessageRequest, _: UserContext = Depends(current_user)) -> dict[str, Any]:
    raise HTTPException(status_code=410, detail="use_elicit_session_message_with_explicit_field")


@app.post("/assistant/sessions/{session_id}/retrieve-similar")
def retrieve_similar(session_id: str, request: SearchRequest, _: UserContext = Depends(current_user)) -> dict[str, Any]:
    return {
        "trace_id": trace_id("ret"),
        "session_id": session_id,
        "hits": [
            hit.model_dump()
            for hit in search_chunks(
                request.query,
                tender_id=request.tender_id,
                cpv=request.cpv,
                document_type=request.document_type,
                language=request.language,
                top_k=request.top_k,
            )
        ],
    }


@app.post("/assistant/sessions/{session_id}/propose-index")
def assistant_propose_index(session_id: str, _: UserContext = Depends(current_user)) -> dict[str, Any]:
    raise HTTPException(status_code=410, detail="use_draft_index_with_workspace_and_document_type")


@app.post("/assistant/sessions/{session_id}/draft-chapter")
def assistant_draft_chapter(session_id: str, request: ChapterDraftRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        response = runtime.draft_chapter_runtime(user, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="chapter_not_found") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    response["session_id"] = session_id
    response["compatibility_route"] = True
    return response


@app.post("/draft/ppt")
def create_ppt_draft(request: ChapterDraftRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    request.document_type = "ppt"
    return runtime.draft_chapter_runtime(user, request)


@app.post("/draft/pcap")
def create_pcap_draft(request: ChapterDraftRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    request.document_type = "pcap"
    return runtime.draft_chapter_runtime(user, request)


@app.post("/draft/memoria")
def create_need_report_draft(request: ChapterDraftRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    request.document_type = "informe_necesidad"
    return runtime.draft_chapter_runtime(user, request)


@app.post("/validate/documents")
def validate(request: ValidationRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return document_workflow.run_coherence_review(user, request.workspace_id, request.documents)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc


@app.get("/workspaces/{workspace_id}/validation-issues")
def get_validation_issues(
    workspace_id: str,
    include_resolved: bool = False,
    user: UserContext = Depends(current_user),
) -> dict[str, Any]:
    try:
        return document_workflow.list_validation_issues(user, workspace_id, include_resolved=include_resolved)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc


@app.patch("/validation-issues/{issue_id}")
def patch_validation_issue(issue_id: str, request: IssueResolutionRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return document_workflow.resolve_validation_issue(user, issue_id, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="validation_issue_not_found") from exc


@app.post("/workspaces/{workspace_id}/sources/upload")
async def upload_workspace_source(
    workspace_id: str,
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    user: UserContext = Depends(current_user),
) -> dict[str, Any]:
    content = await file.read(document_workflow.MAX_SOURCE_BYTES + 1)
    try:
        return document_workflow.create_workspace_source(
            user,
            workspace_id,
            filename=file.filename or "documento",
            content_type=file.content_type,
            content=content,
            title=title,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/workspaces/{workspace_id}/sources")
def get_workspace_sources(workspace_id: str, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return document_workflow.list_workspace_sources(user, workspace_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc


@app.patch("/workspaces/{workspace_id}/sources/{source_id}")
def patch_workspace_source(
    workspace_id: str,
    source_id: str,
    request: WorkspaceSourceUpdateRequest,
    user: UserContext = Depends(current_user),
) -> dict[str, Any]:
    try:
        return document_workflow.update_workspace_source(user, workspace_id, source_id, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_source_not_found") from exc


@app.get("/answers/{answer_id}/citations")
def answer_citations(answer_id: str, _: UserContext = Depends(current_user)) -> dict[str, Any]:
    raise HTTPException(status_code=410, detail="answer_resource_removed_use_chapter_version_citations")


@app.get("/preparation/capabilities")
def preparation_capabilities(user: UserContext = Depends(current_user)) -> dict[str, Any]:
    return category1.category1_capabilities(user)


@app.get("/preparation/annual-plan")
def get_annual_plan(
    year: int,
    include_archived: bool = False,
    user: UserContext = Depends(current_user),
) -> dict[str, Any]:
    return category1.list_annual_plan(user, year, include_archived=include_archived)


@app.post("/preparation/annual-plan")
def create_annual_plan_item(request: AnnualPlanItemRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return category1.save_annual_plan_item(user, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.put("/preparation/annual-plan/{item_id}")
def update_annual_plan_item(item_id: str, request: AnnualPlanItemRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return category1.save_annual_plan_item(user, request, item_id=item_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="plan_item_or_workspace_not_found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/preparation/annual-plan/{item_id}/archive")
def archive_annual_plan_item(item_id: str, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return category1.archive_annual_plan_item(user, item_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="plan_item_not_found") from exc


@app.get("/preparation/annual-plan/export.csv")
def export_annual_plan(year: int, user: UserContext = Depends(current_user)) -> Response:
    filename, data = category1.annual_plan_csv(user, year)
    return Response(
        content=data,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/workspaces/{workspace_id}/market-studies")
def get_market_studies(workspace_id: str, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return category1.list_market_studies(user, workspace_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc


@app.post("/workspaces/{workspace_id}/market-studies")
def create_market_study(workspace_id: str, request: MarketStudyRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    if request.workspace_id != workspace_id:
        raise HTTPException(status_code=422, detail="workspace_id_mismatch")
    try:
        return category1.create_market_study(user, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/workspaces/{workspace_id}/risks")
def get_procurement_risks(workspace_id: str, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return category1.list_risks(user, workspace_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc


@app.post("/workspaces/{workspace_id}/risks")
def create_procurement_risk(workspace_id: str, request: ProcurementRiskRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    if request.workspace_id != workspace_id:
        raise HTTPException(status_code=422, detail="workspace_id_mismatch")
    try:
        return category1.save_risk(user, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc


@app.put("/workspaces/{workspace_id}/risks/{risk_id}")
def update_procurement_risk(workspace_id: str, risk_id: str, request: ProcurementRiskRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    if request.workspace_id != workspace_id:
        raise HTTPException(status_code=422, detail="workspace_id_mismatch")
    try:
        return category1.save_risk(user, request, risk_id=risk_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="risk_or_workspace_not_found") from exc


@app.get("/workspaces/{workspace_id}/schedules")
def get_procurement_schedules(workspace_id: str, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return category1.list_schedules(user, workspace_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc


@app.post("/workspaces/{workspace_id}/schedules")
def create_procurement_schedule(workspace_id: str, request: ProcurementScheduleRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    if request.workspace_id != workspace_id:
        raise HTTPException(status_code=422, detail="workspace_id_mismatch")
    try:
        return category1.calculate_schedule(user, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/workspaces/{workspace_id}/economic-calculations")
def get_economic_calculations(workspace_id: str, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return category1.list_economic_calculations(user, workspace_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc


@app.post("/workspaces/{workspace_id}/economic-calculations")
def create_economic_calculation(workspace_id: str, request: EconomicCalculationRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    if request.workspace_id != workspace_id:
        raise HTTPException(status_code=422, detail="workspace_id_mismatch")
    try:
        return category1.calculate_economics(user, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/workspaces/{workspace_id}/economic-calculations/{calculation_id}/apply")
def apply_economic_calculation(workspace_id: str, calculation_id: str, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return category1.apply_economic_calculation(user, workspace_id, calculation_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="calculation_or_workspace_not_found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/preparation/explorer/tenders")
def explore_tenders(
    q: str,
    cpv: str | None = None,
    document_type: str | None = None,
    language: str | None = None,
    limit: int = 30,
    user: UserContext = Depends(current_user),
) -> dict[str, Any]:
    return category1.search_tender_explorer(user, q, cpv=cpv, document_type=document_type, language=language, limit=limit)


@app.get("/preparation/explorer/legal")
def explore_legal_sources(
    q: str,
    source_kind: str | None = None,
    limit: int = 30,
    user: UserContext = Depends(current_user),
) -> dict[str, Any]:
    try:
        return category1.search_legal_sources(user, q, source_kind=source_kind, limit=limit)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/preparation/legal-sources")
def create_legal_source(request: LegalKnowledgeSourceRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return category1.save_legal_source(user, request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/preparation/ai-reviews")
def get_ai_output_reviews(workspace_id: str, target_id: str | None = None, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return category1.list_ai_reviews(user, workspace_id, target_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc


@app.post("/preparation/ai-reviews")
def create_ai_output_review(request: AiOutputReviewRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return category1.review_ai_output(user, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/preparation/literacy")
def get_ai_literacy(user: UserContext = Depends(current_user)) -> dict[str, Any]:
    return category1.literacy_status(user)


@app.post("/preparation/literacy/{module_id}/complete")
def complete_ai_literacy(module_id: str, request: LiteracyCompletionRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return category1.complete_literacy_module(user, module_id, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="literacy_module_not_found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/preparation/compliance")
def get_preparation_compliance(user: UserContext = Depends(current_user)) -> dict[str, Any]:
    return category1.get_compliance_profile(user)


@app.put("/preparation/compliance")
def put_preparation_compliance(request: ComplianceProfileRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return category1.update_compliance_profile(user, request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/preparation/validation/{workspace_id}")
def run_preparation_validation(workspace_id: str, request: AdvancedValidationRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return category1.run_advanced_validation(user, workspace_id, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc


@app.get("/preparation/official-sources")
def get_official_source_connectors(_: UserContext = Depends(current_user)) -> dict[str, Any]:
    return official_sources.connector_catalog()


@app.post("/preparation/official-sources/sync")
def sync_preparation_official_sources(request: OfficialSourceSyncRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    return official_sources.sync_official_sources(user, request)


@app.get("/preparation/official-sources/runs")
def get_official_source_sync_runs(
    connector: str | None = None,
    limit: int = 50,
    user: UserContext = Depends(current_user),
) -> dict[str, Any]:
    return official_sources.list_sync_runs(user, connector, limit=limit)


@app.get("/preparation/saved-searches")
def get_saved_searches(user: UserContext = Depends(current_user)) -> dict[str, Any]:
    return collaboration.list_saved_searches(user)


@app.post("/preparation/saved-searches")
def create_saved_search(request: SavedSearchRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    return collaboration.save_saved_search(user, request)


@app.put("/preparation/saved-searches/{search_id}")
def update_saved_search(search_id: str, request: SavedSearchRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return collaboration.save_saved_search(user, request, search_id=search_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="saved_search_not_found") from exc


@app.post("/preparation/saved-searches/{search_id}/run")
def run_saved_search(search_id: str, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return collaboration.run_saved_search(user, search_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="saved_search_not_found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/notifications")
def get_notifications(
    unread_only: bool = False,
    limit: int = 100,
    user: UserContext = Depends(current_user),
) -> dict[str, Any]:
    return collaboration.list_notifications(user, unread_only=unread_only, limit=limit)


@app.patch("/notifications/{notification_id}")
def update_notification(
    notification_id: str,
    read: bool = Body(embed=True),
    user: UserContext = Depends(current_user),
) -> dict[str, Any]:
    try:
        return collaboration.mark_notification(user, notification_id, read=read)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="notification_not_found") from exc


@app.get("/workspaces/{workspace_id}/tasks")
def get_workspace_tasks(workspace_id: str, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return collaboration.list_tasks(user, workspace_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc


@app.post("/workspaces/{workspace_id}/tasks")
def create_workspace_task(workspace_id: str, request: WorkspaceTaskRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return collaboration.save_task(user, workspace_id, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.put("/workspaces/{workspace_id}/tasks/{task_id}")
def update_workspace_task(workspace_id: str, task_id: str, request: WorkspaceTaskRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return collaboration.save_task(user, workspace_id, request, task_id=task_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="task_or_workspace_not_found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/workspaces/{workspace_id}/comments")
def get_document_comments(
    workspace_id: str,
    chapter_id: str | None = None,
    include_resolved: bool = False,
    user: UserContext = Depends(current_user),
) -> dict[str, Any]:
    try:
        return collaboration.list_comments(user, workspace_id, chapter_id=chapter_id, include_resolved=include_resolved)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_not_found") from exc


@app.post("/workspaces/{workspace_id}/comments")
def create_document_comment(workspace_id: str, request: DocumentCommentRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return collaboration.add_comment(user, workspace_id, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_chapter_or_parent_not_found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.patch("/workspaces/{workspace_id}/comments/{comment_id}")
def resolve_document_comment(
    workspace_id: str,
    comment_id: str,
    request: CommentResolutionRequest,
    user: UserContext = Depends(current_user),
) -> dict[str, Any]:
    try:
        return collaboration.resolve_comment(user, workspace_id, comment_id, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="comment_not_found") from exc


@app.get("/preparation/clauses")
def get_clause_catalog(
    q: str | None = None,
    document_type: str | None = None,
    status: str | None = None,
    user: UserContext = Depends(current_user),
) -> dict[str, Any]:
    return collaboration.list_clauses(user, query=q, document_type=document_type, status=status)


@app.post("/preparation/clauses")
def create_clause(request: ClauseCatalogRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return collaboration.save_clause(user, request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.put("/preparation/clauses/{clause_id}")
def update_clause(clause_id: str, request: ClauseCatalogRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return collaboration.save_clause(user, request, clause_id=clause_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="clause_not_found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/workspaces/{workspace_id}/clauses/{clause_id}/render")
def render_clause(workspace_id: str, clause_id: str, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return collaboration.render_clause(user, workspace_id, clause_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_or_clause_not_found") from exc


@app.get("/preparation/print-profile")
def get_print_profile(user: UserContext = Depends(current_user)) -> dict[str, Any]:
    return collaboration.get_print_profile(user)


@app.put("/preparation/print-profile")
def update_print_profile(request: PrintProfileRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    try:
        return collaboration.update_print_profile(user, request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.patch("/workspaces/{workspace_id}/documents/{document_type}/sharing")
def update_document_sharing(
    workspace_id: str,
    document_type: str,
    request: DocumentSharingRequest,
    user: UserContext = Depends(current_user),
) -> dict[str, Any]:
    try:
        return collaboration.update_document_sharing(user, workspace_id, document_type, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="workspace_or_document_not_found") from exc


@app.post("/feedback")
def feedback(request: FeedbackRequest, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    target_id = request.target_id or request.answer_id or request.issue_id
    if request.workspace_id and target_id and request.decision in {"aceptado", "rechazado", "modificado"}:
        return category1.review_ai_output(
            user,
            AiOutputReviewRequest(
                workspace_id=request.workspace_id,
                target_type="validation" if request.issue_id else "chapter",
                target_id=target_id,
                target_version_id=request.target_version_id,
                decision=request.decision,
                comment=request.comment,
            ),
        )
    event_id = runtime._audit(user, "feedback.recorded", request.workspace_id, request.model_dump())
    return {"trace_id": trace_id("fb"), "event_id": event_id, "user_id": user.user_id, "recorded": request.model_dump()}


@app.get("/audit")
def audit(workspace_id: str | None = None, user: UserContext = Depends(current_user)) -> dict[str, Any]:
    return runtime.audit_events(user, workspace_id)


@app.get("/metrics")
def get_metrics(user: UserContext = Depends(current_user)) -> dict[str, Any]:
    workspaces = runtime.list_workspaces(user, include_archived=True)["items"]
    summary = kb.summary()
    issue_count = sum(len(document_workflow.list_validation_issues(user, item["id"], include_resolved=True)["items"]) for item in workspaces)
    audit_count = len(runtime.audit_events(user)["events"])
    if runtime._db_available():
        export_row = kb.db_fetch_one("SELECT count(*) AS count FROM document_export_records WHERE tenant_id = %s", (user.tenant_id,))
        export_count = int(export_row["count"]) if export_row else 0
    else:
        export_count = sum(1 for item in runtime._MEMORY["export_records"].values() if item.get("tenant_id") == user.tenant_id)
    metrics = {
        "workspaces": len(workspaces),
        "archived_workspaces": sum(1 for item in workspaces if item.get("status") == "archivado"),
        "documents": summary["documents"],
        "chunks": summary["chunks"],
        "sources": len(kb.source_rows()),
        "tenders": summary["tenders"],
        "validation_issues": issue_count,
        "audit_events": audit_count,
        "exports": export_count,
    }
    return {"trace_id": trace_id("met"), "metrics": metrics}


@app.get("/sources")
def list_sources(_: UserContext = Depends(current_user)) -> dict[str, Any]:
    return {"trace_id": trace_id("src"), "items": kb.source_rows(), "summary": kb.summary()}


@app.get("/kb/summary")
def kb_summary(_: UserContext = Depends(current_user)) -> dict[str, Any]:
    return {"trace_id": trace_id("kb"), "summary": kb.summary()}


@app.get("/kb/tenders")
def kb_tenders(_: UserContext = Depends(current_user)) -> dict[str, Any]:
    return {"trace_id": trace_id("kb"), "items": kb.tenders()}


@app.get("/assistant/index")
def index_template(document_type: str = "ppt", _: UserContext = Depends(current_user)) -> dict[str, Any]:
    specs = document_workflow.specs()["items"]
    aliases = {"memoria": "informe_necesidad", "informe": "informe_necesidad"}
    kind = aliases.get(document_type, document_type)
    spec = next((item for item in specs if item["document_type"] == kind), None)
    if not spec:
        raise HTTPException(status_code=404, detail="document_type_not_found")
    return {"trace_id": trace_id("idx"), "document_type": kind, "chapters": spec["chapters"], "workspace_specific": False}
