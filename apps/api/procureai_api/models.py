from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

Locale = Literal["es", "ca", "va", "gl", "eu"]
WorkspaceStatus = Literal["borrador", "en_preparacion", "en_revision", "validado", "exportado", "archivado"]
DocumentKind = Literal["informe_necesidad", "ppt", "pcap", "informe_juridico", "memoria", "juridico"]
CoreDocumentKind = Literal["informe_necesidad", "ppt", "pcap", "informe_juridico"]
TemplateStatus = Literal["activa", "procesando", "error", "archivada"]
TemplateUsage = Literal["estructura", "estilo", "contenido_referencial"]


class UserContext(BaseModel):
    user_id: str
    tenant_id: str
    roles: list[str]


class SearchRequest(BaseModel):
    query: str
    tender_id: str | None = None
    workspace_id: str | None = None
    cpv: str | None = None
    document_type: str | None = None
    language: str | None = None
    top_k: int = Field(default=10, ge=1, le=80)


class SourceRef(BaseModel):
    source_id: str
    title: str
    url: str
    page: int | None = None
    section: str | None = None
    trust: Literal["alta", "media", "baja"] = "media"


class SearchHit(BaseModel):
    chunk_id: str
    document_id: str
    title: str
    text: str
    score: float
    metadata: dict[str, Any]
    source: SourceRef
    why_similar: list[str]


class SearchResponse(BaseModel):
    trace_id: str
    mode: str
    hits: list[SearchHit]
    applied_filters: dict[str, Any]


class WorkspacePayload(BaseModel):
    title: str
    unit: str | None = None
    object: str | None = None
    need: str | None = None
    language: Locale = "es"


class WorkspaceCreate(BaseModel):
    file_number: str | None = None
    title: str = "Nuevo expediente contractual"
    unit: str | None = None
    owner: str | None = None
    object: str | None = None
    need: str | None = None
    language: Locale = "es"
    budget: float | None = None
    estimated_value: float | None = None
    cpv: str | None = None
    cpv_codes: list[str] | None = None
    contract_type: str | None = None
    duration: str | None = None
    procedure: str | None = None
    publication_date: str | None = None
    submission_deadline: str | None = None
    award_date: str | None = None
    formalization_date: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    lots: str | None = None
    contracting_body: str | None = None
    promoting_unit: str | None = None
    tax_rate: float | None = Field(default=None, ge=0, le=100)
    funding: str | None = None
    extensions: str | None = None
    milestones: list[dict[str, Any]] | None = None
    lot_structure: list[dict[str, Any]] | None = None
    solvency: dict[str, Any] | None = None
    award_criteria: list[dict[str, Any]] | None = None
    special_execution_conditions: list[dict[str, Any]] | None = None
    contract_manager: str | None = None
    data_protection: str | None = None
    confidentiality: str | None = None
    intellectual_property: str | None = None
    shared_data: dict[str, Any] | None = None
    target_document: DocumentKind = "ppt"


class WorkspaceUpdate(BaseModel):
    file_number: str | None = None
    title: str | None = None
    unit: str | None = None
    owner: str | None = None
    object: str | None = None
    need: str | None = None
    language: Locale | None = None
    status: WorkspaceStatus | None = None
    budget: float | None = None
    estimated_value: float | None = None
    cpv: str | None = None
    cpv_codes: list[str] | None = None
    contract_type: str | None = None
    duration: str | None = None
    procedure: str | None = None
    publication_date: str | None = None
    submission_deadline: str | None = None
    award_date: str | None = None
    formalization_date: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    lots: str | None = None
    contracting_body: str | None = None
    promoting_unit: str | None = None
    tax_rate: float | None = Field(default=None, ge=0, le=100)
    funding: str | None = None
    extensions: str | None = None
    milestones: list[dict[str, Any]] | None = None
    lot_structure: list[dict[str, Any]] | None = None
    solvency: dict[str, Any] | None = None
    award_criteria: list[dict[str, Any]] | None = None
    special_execution_conditions: list[dict[str, Any]] | None = None
    contract_manager: str | None = None
    data_protection: str | None = None
    confidentiality: str | None = None
    intellectual_property: str | None = None
    shared_data: dict[str, Any] | None = None
    target_document: DocumentKind | None = None


class CpvSuggestRequest(BaseModel):
    query: str | None = None
    title: str | None = None
    object: str | None = None
    need: str | None = None
    language: Locale = "es"
    top_k: int = 3
    selected_codes: list[str] = Field(default_factory=list)


class CpvContextRequest(BaseModel):
    title: str | None = None
    object: str | None = None
    need: str | None = None
    language: Locale = "es"


class TemplateRequest(BaseModel):
    workspace_id: str | None = None
    name: str
    document_type: DocumentKind = "ppt"
    language: Locale = "es"
    source_filename: str | None = None
    markdown: str | None = None
    tags: list[str] = Field(default_factory=list)


class WorkspaceTemplateLink(BaseModel):
    template_id: str
    usage: TemplateUsage = "estructura"
    notes: str | None = None


class WorkspaceTemplateLinksRequest(BaseModel):
    templates: list[WorkspaceTemplateLink] = Field(default_factory=list)


class GuidedSessionRequest(BaseModel):
    workspace_id: str
    language: Locale = "es"
    target_document: DocumentKind = "ppt"


class GuidedMessageRequest(BaseModel):
    workspace_id: str
    message: str
    field: str | None = None
    language: Locale = "es"


class GuidedSuggestionRequest(BaseModel):
    workspace_id: str
    field: str
    language: Locale = "es"
    current_value: str | None = None
    object_hint: str | None = None
    mode: Literal["suggest", "expand"] = "suggest"


class ReferenceSelectRequest(BaseModel):
    workspace_id: str
    query: str | None = None
    cpv: str | None = None
    document_type: str | None = "ppt"
    language: str | None = None
    top_k: int = Field(default=15, ge=1, le=15)


class ReferenceAcceptRequest(BaseModel):
    references: list[str] = Field(default_factory=list)
    document_type: DocumentKind | None = None


class DraftIndexRequest(BaseModel):
    workspace_id: str
    document_type: DocumentKind = "ppt"
    language: Locale = "es"


class ChapterDraftRequest(BaseModel):
    workspace_id: str
    chapter_id: str = ""
    language: Locale = "es"
    approved_index: bool = False
    references: list[str] = Field(default_factory=list)
    document_type: DocumentKind | None = None
    regeneration_mode: bool = False


class AssistantSessionRequest(BaseModel):
    workspace_id: str
    language: Locale = "es"
    target_documents: list[str] = Field(default_factory=lambda: ["memoria", "pcap", "ppt"])


class AssistantMessageRequest(BaseModel):
    message: str
    workspace_context: dict[str, Any] = Field(default_factory=dict)


class ChapterUpdateRequest(BaseModel):
    workspace_id: str
    content: str
    summary: str | None = None
    comment: str | None = None
    expected_version_id: str | None = None
    autosave: bool = False


class ChapterImproveRequest(BaseModel):
    workspace_id: str
    content: str
    selected_text: str | None = None
    instruction: str = "Añadir más detalle"
    language: Locale = "es"


class ImpactProposalRequest(BaseModel):
    workspace_id: str
    content: str | None = None


class ExportDocxRequest(BaseModel):
    workspace_id: str
    document_type: DocumentKind = "ppt"
    only_validated: bool = False


class ExportDossierRequest(BaseModel):
    workspace_id: str
    document_types: list[CoreDocumentKind] = Field(default_factory=lambda: ["informe_necesidad", "ppt", "pcap", "informe_juridico"])
    only_final: bool = False


class DraftIndexUpdateRequest(BaseModel):
    workspace_id: str
    document_type: CoreDocumentKind
    chapters: list[dict[str, Any]] = Field(min_length=1)


class DocumentStatusRequest(BaseModel):
    status: Literal["borrador", "en_revision", "final"]
    comment: str | None = None


class RegenerationProposalRequest(BaseModel):
    workspace_id: str
    document_type: CoreDocumentKind
    language: Locale = "es"
    instruction: str | None = None
    references: list[str] = Field(default_factory=list)


class ProposalResolutionRequest(BaseModel):
    decision: Literal["aceptar", "rechazar"]
    comment: str = Field(min_length=3, max_length=2000)


class IssueResolutionRequest(BaseModel):
    status: Literal["abierta", "en_revision", "corregida", "descartada", "cerrada"]
    comment: str = Field(min_length=3, max_length=2000)


class WorkspaceSourceUpdateRequest(BaseModel):
    included_in_generation: bool


class DocumentReviewRequest(BaseModel):
    document_types: list[CoreDocumentKind] = Field(default_factory=lambda: ["informe_necesidad", "ppt", "pcap", "informe_juridico"])
    include_resolved: bool = False


class ValidationRequest(BaseModel):
    workspace_id: str
    documents: list[str] = Field(default_factory=lambda: ["memoria", "pcap", "ppt"])
    modes: list[Literal["coherencia", "normativa", "concurrencia"]] = Field(
        default_factory=lambda: ["coherencia", "normativa", "concurrencia"]
    )


class FeedbackRequest(BaseModel):
    workspace_id: str | None = None
    answer_id: str | None = None
    issue_id: str | None = None
    target_type: str | None = None
    target_id: str | None = None
    target_version_id: str | None = None
    decision: Literal["aceptado", "rechazado", "modificado", "comentado"]
    comment: str | None = None


class AnnualPlanItemRequest(BaseModel):
    workspace_id: str | None = None
    plan_year: int = Field(ge=2020, le=2100)
    title: str = Field(min_length=3, max_length=300)
    need: str | None = Field(default=None, max_length=8000)
    contracting_body: str | None = Field(default=None, max_length=300)
    promoting_unit: str | None = Field(default=None, max_length=300)
    cpv_codes: list[str] = Field(default_factory=list, max_length=20)
    contract_type: str | None = Field(default=None, max_length=100)
    procedure: str | None = Field(default=None, max_length=200)
    estimated_value: float | None = Field(default=None, ge=0)
    planned_quarter: int | None = Field(default=None, ge=1, le=4)
    planned_publication_date: str | None = None
    owner: str | None = Field(default=None, max_length=300)
    status: Literal["idea", "previsto", "en_preparacion", "publicado", "adjudicado", "cancelado"] = "previsto"
    notes: str | None = Field(default=None, max_length=8000)


class MarketStudyRequest(BaseModel):
    workspace_id: str
    scope: str = Field(min_length=3, max_length=12000)
    search_query: str | None = Field(default=None, max_length=1000)
    cpv_codes: list[str] = Field(default_factory=list, max_length=20)
    reference_ids: list[str] = Field(default_factory=list, max_length=100)
    scenarios: list[dict[str, Any]] = Field(default_factory=list, max_length=20)
    economic_operators: list[dict[str, Any]] = Field(default_factory=list, max_length=200)
    risks: list[dict[str, Any]] = Field(default_factory=list, max_length=100)
    conclusions: str | None = Field(default=None, max_length=20000)
    status: Literal["borrador", "en_revision", "validado"] = "borrador"


class ProcurementRiskRequest(BaseModel):
    workspace_id: str
    category: str = Field(min_length=2, max_length=120)
    description: str = Field(min_length=3, max_length=4000)
    probability: int = Field(ge=1, le=5)
    impact: int = Field(ge=1, le=5)
    mitigation: str | None = Field(default=None, max_length=8000)
    contingency: str | None = Field(default=None, max_length=8000)
    owner: str | None = Field(default=None, max_length=300)
    status: Literal["abierto", "mitigando", "aceptado", "cerrado"] = "abierto"
    source_refs: list[str] = Field(default_factory=list, max_length=100)


class ProcurementScheduleRequest(BaseModel):
    workspace_id: str
    procedure: str | None = Field(default=None, max_length=200)
    start_date: str
    phases: list[dict[str, Any]] = Field(default_factory=list, max_length=50)
    assumptions: list[str] = Field(default_factory=list, max_length=100)
    status: Literal["borrador", "validado"] = "borrador"


class EconomicCalculationRequest(BaseModel):
    workspace_id: str
    currency: str = Field(default="EUR", min_length=3, max_length=3)
    line_items: list[dict[str, Any]] = Field(min_length=1, max_length=500)
    other_costs: float = Field(default=0, ge=0)
    contingency: float = Field(default=0, ge=0)
    tax_rate: float = Field(default=21, ge=0, le=100)
    extensions_amount: float = Field(default=0, ge=0)
    options_amount: float = Field(default=0, ge=0)
    modification_percent: float = Field(default=0, ge=0, le=100)
    assumptions: list[str] = Field(default_factory=list, max_length=100)
    status: Literal["borrador", "validado"] = "borrador"


class LegalKnowledgeSourceRequest(BaseModel):
    source_kind: Literal["normativa", "doctrina", "jurisprudencia"]
    title: str = Field(min_length=3, max_length=500)
    publisher: str | None = Field(default=None, max_length=300)
    jurisdiction: str | None = Field(default=None, max_length=200)
    source_url: str = Field(min_length=8, max_length=2000)
    reference_number: str | None = Field(default=None, max_length=300)
    publication_date: str | None = None
    effective_from: str | None = None
    effective_to: str | None = None
    language: Locale = "es"
    content_text: str | None = Field(default=None, max_length=2_000_000)
    metadata: dict[str, Any] = Field(default_factory=dict)
    status: Literal["vigente", "vigente_sin_verificar", "derogada", "sustituida", "archivada"] = "vigente_sin_verificar"


class AiOutputReviewRequest(BaseModel):
    workspace_id: str
    target_type: Literal["chapter", "index", "market_study", "schedule", "economic_calculation", "validation"]
    target_id: str
    target_version_id: str | None = None
    decision: Literal["aceptado", "rechazado", "modificado"]
    comment: str | None = Field(default=None, max_length=4000)


class LiteracyCompletionRequest(BaseModel):
    module_version: str = Field(default="1.0", max_length=30)
    quiz_score: int = Field(ge=0, le=100)
    attested: bool


class ComplianceProfileRequest(BaseModel):
    profile: dict[str, Any]
    evidence: list[dict[str, Any]] = Field(default_factory=list, max_length=200)


class AdvancedValidationRequest(BaseModel):
    modes: list[Literal["redundancia", "ambiguedad", "restriccion", "normativa"]] = Field(
        default_factory=lambda: ["redundancia", "ambiguedad", "restriccion", "normativa"]
    )


class OfficialSourceSyncRequest(BaseModel):
    connectors: list[Literal["boe", "dogc", "tacrc", "tccsp", "eurlex", "eurlex_jurisprudencia"]] = Field(default_factory=lambda: ["boe", "dogc"])
    since: str | None = None
    limit_per_connector: int = Field(default=100, ge=1, le=1000)
    include_text: bool = True
    query_terms: list[str] = Field(default_factory=lambda: ["contratación", "contratos del sector público", "inteligencia artificial", "protección de datos", "seguridad"], max_length=50)


class SavedSearchRequest(BaseModel):
    name: str = Field(min_length=3, max_length=200)
    search_kind: Literal["licitaciones", "normativa", "doctrina", "jurisprudencia"]
    query: str = Field(min_length=2, max_length=1000)
    filters: dict[str, Any] = Field(default_factory=dict)
    alert_frequency: Literal["sin_alerta", "diaria", "semanal"] = "sin_alerta"
    active: bool = True


class WorkspaceTaskRequest(BaseModel):
    phase_id: str | None = Field(default=None, max_length=120)
    title: str = Field(min_length=3, max_length=300)
    description: str | None = Field(default=None, max_length=8000)
    assignee_user_id: str | None = Field(default=None, max_length=200)
    due_date: str | None = None
    priority: Literal["baja", "media", "alta", "critica"] = "media"
    status: Literal["pendiente", "en_curso", "bloqueada", "completada", "cancelada"] = "pendiente"
    depends_on: list[str] = Field(default_factory=list, max_length=100)
    source_refs: list[str] = Field(default_factory=list, max_length=100)


class DocumentCommentRequest(BaseModel):
    document_type: CoreDocumentKind
    chapter_id: str
    version_id: str | None = None
    parent_id: str | None = None
    anchor_text: str | None = Field(default=None, max_length=2000)
    anchor_start: int | None = Field(default=None, ge=0)
    anchor_end: int | None = Field(default=None, ge=0)
    comment_text: str = Field(min_length=1, max_length=8000)
    mentions: list[str] = Field(default_factory=list, max_length=50)


class CommentResolutionRequest(BaseModel):
    status: Literal["abierto", "resuelto"]


class ClauseCatalogRequest(BaseModel):
    title: str = Field(min_length=3, max_length=300)
    content_text: str = Field(min_length=3, max_length=200_000)
    document_types: list[CoreDocumentKind] = Field(default_factory=list, max_length=10)
    contract_types: list[str] = Field(default_factory=list, max_length=30)
    procedure_types: list[str] = Field(default_factory=list, max_length=30)
    tags: list[str] = Field(default_factory=list, max_length=100)
    visibility: Literal["privada", "organizacion", "publica"] = "organizacion"
    status: Literal["borrador", "en_revision", "aprobada"] = "borrador"
    variables: list[str] = Field(default_factory=list, max_length=100)
    legal_source_ids: list[str] = Field(default_factory=list, max_length=100)
    source_clause_ids: list[str] = Field(default_factory=list, max_length=100)
    change_summary: str | None = Field(default=None, max_length=2000)


class PrintProfileRequest(BaseModel):
    configuration: dict[str, Any]


class DocumentSharingRequest(BaseModel):
    visibility: Literal["private", "workspace", "organization"]
