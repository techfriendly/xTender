export type KbSummary = {
  generated_at?: string | null;
  source?: string | null;
  tenders: number;
  documents: number;
  chunks: number;
  languages: string[];
  document_types: string[];
  backend?: "postgres" | "json_fallback";
};

export type KbDocument = {
  document_id: string;
  id?: string;
  tender_id: string;
  document_type: string;
  title: string;
  source_url: string;
  markdown_path: string;
  page_count?: number;
  indexed_pages?: number;
  extraction_quality?: number;
  language?: string;
};

export type KbTender = {
  id?: string;
  atom_id?: string;
  expediente?: string | null;
  title: string;
  updated_at?: string | null;
  status?: string | null;
  cpv?: string | null;
  contracting_body?: string | null;
  budget_without_tax?: number | null;
  budget_with_tax?: number | null;
  estimated_value?: number | null;
  currency?: string | null;
  province?: string | null;
  locality?: string | null;
  technical_uri?: string | null;
  legal_uri?: string | null;
  contract_uri?: string | null;
};

export type SourceRow = {
  source_id: string;
  title: string;
  url: string;
  type: string;
  date?: string | null;
  usedIn: string;
  trust: "alta" | "media" | "baja";
  status: string;
  tender_id?: string;
  contracting_body?: string;
  cpv?: string;
  page_count?: number;
  indexed_pages?: number;
};

export type SearchHit = {
  chunk_id: string;
  document_id: string;
  title: string;
  text: string;
  score: number;
  metadata: {
    tender_id?: string;
    document_type?: string;
    language?: string;
    cpv_codes?: string[];
    contracting_body?: string;
    publication_date?: string;
    page_start?: number | null;
    page_end?: number | null;
    heading_path?: string[];
    token_count_estimate?: number | null;
    chunk_strategy?: string | null;
    embedding_model_max_tokens?: number | null;
    budget_with_tax?: number | null;
    budget_without_tax?: number | null;
    currency?: string | null;
    ranking_scope?: string;
    ranking_mode?: string;
    cpv_filter?: string | null;
    language_filter?: string | null;
    matched_chunk_count?: number;
    matched_chunk_ids?: string[];
    matched_chunks?: Array<{
      chunk_id: string;
      score: number;
      heading_path?: string[];
      page_start?: number | null;
      page_end?: number | null;
      token_count_estimate?: number | null;
      chunk_strategy?: string | null;
      text_preview?: string;
    }>;
    retrieval_note?: string;
  };
  source: {
    source_id: string;
    title: string;
    url: string;
    page?: number | null;
    section?: string | null;
    trust: "alta" | "media" | "baja";
  };
  why_similar: string[];
};

export type WorkspaceStatus = "borrador" | "en_preparacion" | "en_revision" | "validado" | "exportado" | "archivado";
export type DocumentKind = "informe_necesidad" | "ppt" | "pcap" | "informe_juridico";
export type DocumentWorkflowStatus = "no_iniciado" | "borrador" | "en_revision" | "final";

export type Workspace = {
  id: string;
  tenant_id?: string;
  file_number?: string | null;
  title: string;
  unit?: string | null;
  owner?: string | null;
  language: string;
  status: WorkspaceStatus;
  target_document?: DocumentKind | "memoria" | "juridico";
  object?: string | null;
  need?: string | null;
  budget?: number | null;
  estimated_value?: number | null;
  cpv?: string | null;
  cpv_codes?: string[] | null;
  contract_type?: string | null;
  duration?: string | null;
  procedure?: string | null;
  publication_date?: string | null;
  submission_deadline?: string | null;
  award_date?: string | null;
  formalization_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  lots?: string | null;
  contracting_body?: string | null;
  promoting_unit?: string | null;
  tax_rate?: number | null;
  funding?: string | null;
  extensions?: string | null;
  milestones?: Array<Record<string, unknown>> | null;
  lot_structure?: Array<Record<string, unknown>> | null;
  solvency?: Record<string, unknown> | null;
  award_criteria?: Array<Record<string, unknown>> | null;
  special_execution_conditions?: Array<Record<string, unknown>> | null;
  contract_manager?: string | null;
  data_protection?: string | null;
  confidentiality?: string | null;
  intellectual_property?: string | null;
  shared_data?: Record<string, unknown> | null;
  template?: string | null;
  template_links?: WorkspaceTemplateLink[];
  completeness?: number;
  archived_at?: string | null;
  elicit?: {
    answers?: Array<{ field: string; answer: string; at?: string; user_id?: string }>;
    current_field?: string | null;
  };
  references?: {
    proposed?: ReferenceCandidate[];
    accepted?: string[];
    manual_selection?: boolean;
  };
  references_by_document?: Partial<Record<DocumentKind, {
    proposed?: ReferenceCandidate[];
    accepted?: string[];
    manual_selection?: boolean;
  }>>;
  draft_index?: DraftIndex;
  document_indexes?: Partial<Record<DocumentKind, DraftIndex>>;
  document_states?: Partial<Record<DocumentKind, {
    document_type: DocumentKind;
    status: DocumentWorkflowStatus;
    updated_at?: string;
    finalized_by?: string;
    finalized_at?: string;
    shared_snapshot?: Record<string, unknown>;
  }>>;
  pending_document_updates?: Array<Record<string, unknown>>;
  created_at?: string | null;
  updated_at?: string | null;
};

export type DocumentTemplate = {
  id: string;
  template_id?: string;
  name: string;
  document_type: "ppt" | "pcap" | "informe_necesidad" | "otros" | string;
  language: string;
  status: "activa" | "procesando" | "error" | "archivada" | string;
  tags?: string[];
  active_version_id?: string | null;
  version_label?: string | null;
  source_filename?: string | null;
  source_mime?: string | null;
  markdown_hash?: string | null;
  version_status?: string | null;
  error?: string | null;
  section_count?: number;
  created_at?: string | null;
  updated_at?: string | null;
  archived_at?: string | null;
  metadata?: Record<string, unknown>;
};

export type DocumentTemplateSection = {
  id: string;
  section_id?: string;
  template_id?: string;
  version_id?: string;
  section_order: number;
  heading_path: string[];
  title: string;
  content_text: string;
  token_count_estimate?: number;
  content_hash?: string;
  metadata?: Record<string, unknown>;
};

export type WorkspaceTemplateLink = {
  workspace_id?: string;
  template_id: string;
  usage: "estructura" | "estilo" | "contenido_referencial";
  notes?: string;
  name?: string;
  document_type?: string;
  language?: string;
  status?: string;
  active_version_id?: string | null;
  section_count?: number;
  template?: DocumentTemplate;
};

export type ReferenceCandidate = {
  reference_id: string;
  chunk_id?: string;
  title: string;
  score: number;
  source: SearchHit["source"];
  why: string[];
  metadata: SearchHit["metadata"];
  status: string;
};

export type DraftChapter = {
  chapter_id: string;
  order: number;
  title: string;
  required: boolean;
  depends_on: string[];
  document_type?: string;
  pending?: string[];
  sources?: string[];
  structural_sources?: string[];
  derived_from_similar?: boolean;
  recommended?: boolean;
  review_role?: string;
  content_mode?: string;
  requirement_taxonomy?: boolean;
};

export type DraftIndex = {
  index_id?: string;
  document_type?: string;
  validated?: boolean;
  validated_by?: string;
  validated_at?: string;
  chapters: DraftChapter[];
  created_at?: string;
  updated_at?: string;
  origin?: "template" | "similar_documents" | "document_spec" | string;
  template_sources?: string[];
  reference_structure_sources?: string[];
  validation_invalidated_reason?: string;
};

export type ChapterVersion = {
  document_id: string;
  chapter_id: string;
  title: string;
  status: string;
  version_id?: string;
  version_label?: string;
  content?: string;
  generated_by?: string;
  origin?: "human" | "generated" | string;
  created_by?: string;
  manual_protected?: boolean;
  content_hash?: string;
  parent_version_id?: string | null;
  created_at?: string;
  summary?: string | null;
  citations?: Array<ReferenceCandidate | ChapterCitation>;
  context_budget?: Record<string, unknown>;
};

export type ChapterCitation = {
  reference_id: string;
  chunk_id?: string;
  title: string;
  document_type?: string | null;
  language?: string | null;
  source_url?: string | null;
  heading_path?: string[];
  page_start?: number | null;
  page_end?: number | null;
  score?: number;
  source_origin?: "uploaded" | "template" | string;
  content_hash?: string;
};

export type DocumentSpec = {
  document_type: DocumentKind;
  title: string;
  short_title: string;
  purpose: string;
  review_notice: string;
  chapters: DraftChapter[];
};

export type DocumentOverview = {
  document_type: DocumentKind;
  title: string;
  short_title: string;
  purpose: string;
  exists: boolean;
  status: DocumentWorkflowStatus;
  index_validated: boolean;
  chapters_total: number;
  chapters_completed: number;
  required_total: number;
  required_completed: number;
  updated_at?: string | null;
};

export type RegenerationProposal = {
  id: string;
  workspace_id: string;
  chapter_id: string;
  document_type: DocumentKind;
  base_version_id?: string | null;
  base_content: string;
  proposed_content: string;
  diff_summary: { additions?: number; deletions?: number; changed_lines?: number; preview?: string } | Record<string, unknown>;
  citations?: ChapterCitation[];
  status: "pendiente" | "aceptada" | "rechazada";
  model?: string;
  created_by?: string;
  created_at?: string;
};

export type ChangeProposal = {
  id: string;
  workspace_id: string;
  field_name: string;
  previous_value: unknown;
  proposed_value: unknown;
  impacted_sections: Array<{ document_type: DocumentKind; chapter_id: string; title: string; manually_edited: boolean }>;
  status: "pendiente" | "aceptada" | "rechazada";
  created_at?: string;
  resolution_comment?: string;
};

export type ValidationIssue = {
  id: string;
  code: string;
  severity: "error" | "advertencia" | "recomendacion";
  title: string;
  explanation: string;
  proposal: string;
  locations: Array<{ document_type?: DocumentKind; chapter_id?: string; title?: string; scope?: string; field?: string; value?: unknown }>;
  document_types: DocumentKind[];
  status: "abierta" | "en_revision" | "corregida" | "descartada" | "cerrada";
  resolution_comment?: string;
  created_at?: string;
};

export type WorkspaceSource = {
  id: string;
  workspace_id: string;
  title: string;
  source_type: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  content_hash: string;
  status: string;
  included_in_generation: boolean;
  extraction_metadata?: Record<string, unknown>;
  created_at?: string;
};

export type ImpactProposal = {
  target_chapter_id: string;
  target_title: string;
  reason: string;
  proposal: string;
  status: string;
};

export type AuditEvent = {
  id: string;
  workspace_id?: string | null;
  user_id?: string | null;
  action: string;
  trace_id: string;
  payload?: Record<string, unknown>;
  created_at?: string | null;
};

export type Category1Capability = {
  id: string;
  group: "planificacion" | "redaccion" | "validacion" | string;
  label: string;
  status: "operativo" | "parcial" | "bloqueado" | string;
  evidence?: string[];
  limitation?: string | null;
};

export type AnnualPlanItem = {
  id: string;
  workspace_id?: string | null;
  plan_year: number;
  title: string;
  need?: string | null;
  contracting_body?: string | null;
  promoting_unit?: string | null;
  cpv_codes?: string[];
  contract_type?: string | null;
  procedure?: string | null;
  estimated_value?: number | null;
  planned_quarter?: number | null;
  planned_publication_date?: string | null;
  owner?: string | null;
  status: string;
  risk_level: string;
  notes?: string | null;
};

export type ProcurementRisk = {
  id: string;
  workspace_id: string;
  category: string;
  description: string;
  probability: number;
  impact: number;
  score: number;
  level: string;
  mitigation?: string | null;
  contingency?: string | null;
  owner?: string | null;
  status: string;
  source_refs?: string[];
};

export type ProcurementSchedule = {
  id: string;
  workspace_id: string;
  procedure?: string | null;
  start_date: string;
  target_date?: string | null;
  phases: Array<{ id?: string; name?: string; label?: string; start_date?: string; end_date?: string; days?: number; duration_days?: number }>;
  alerts: Array<{ type?: string; date?: string; label?: string; status?: string }>;
  assumptions: string[];
  status: string;
};

export type MarketStudy = {
  id: string;
  workspace_id: string;
  version: number;
  status: string;
  scope: string;
  search_query?: string | null;
  reference_ids: string[];
  statistics: Record<string, unknown>;
  scenarios: Array<Record<string, unknown>>;
  economic_operators: Array<Record<string, unknown>>;
  risks: Array<Record<string, unknown>>;
  conclusions?: string | null;
  limitations: string[];
};

export type EconomicCalculation = {
  id: string;
  workspace_id: string;
  version: number;
  currency: string;
  line_items: Array<{ description: string; quantity: number; unit_price: number; periods?: number; total?: number }>;
  base_without_tax: number;
  tax_rate: number;
  tax_amount: number;
  base_with_tax: number;
  extensions_amount: number;
  options_amount: number;
  modifications_amount: number;
  estimated_value: number;
  assumptions: string[];
  status: string;
};

export type OfficialConnector = {
  id: string;
  name: string;
  source_kind: string;
  automation: string;
  default_frequency?: string | null;
  official_url: string;
  conditions: string;
  requires_credentials: boolean;
  enabled: boolean;
};

export type LegalKnowledgeSource = {
  id: string;
  source_kind: "normativa" | "doctrina" | "jurisprudencia";
  title: string;
  publisher?: string | null;
  jurisdiction?: string | null;
  source_url: string;
  reference_number?: string | null;
  publication_date?: string | null;
  status: string;
  metadata?: Record<string, unknown>;
};

export type SavedSearch = {
  id: string;
  name: string;
  search_kind: "licitaciones" | "normativa" | "doctrina" | "jurisprudencia";
  query: string;
  filters: Record<string, unknown>;
  alert_frequency: "sin_alerta" | "diaria" | "semanal";
  active: boolean;
  last_checked_at?: string | null;
  new_result_count?: number;
};

export type WorkspaceTask = {
  id: string;
  workspace_id: string;
  phase_id?: string | null;
  title: string;
  description?: string | null;
  assignee_user_id?: string | null;
  due_date?: string | null;
  priority: string;
  status: string;
  overdue?: boolean;
};

export type LiteracyModule = {
  id: string;
  version: string;
  title: string;
  objective: string;
  duration_minutes?: number;
  topics?: string[];
  completed: boolean;
  completion?: Record<string, unknown> | null;
};

export type ComplianceControl = {
  id: string;
  requirement: string;
  status: "satisfecho" | "pendiente" | string;
  evidence: string;
};

export type ClauseCatalogEntry = {
  id: string;
  title: string;
  document_types: DocumentKind[];
  tags: string[];
  visibility: string;
  status: string;
  version_number?: number;
  content_text?: string;
  variables?: string[];
  legal_source_ids?: string[];
};

export type AiOutputReview = {
  id: string;
  workspace_id: string;
  target_type: string;
  target_id: string;
  target_version_id?: string | null;
  decision: "aceptado" | "rechazado" | "modificado";
  comment?: string | null;
  reviewer_user_id: string;
  created_at?: string;
};

export type DocumentComment = {
  id: string;
  workspace_id: string;
  document_type: DocumentKind;
  chapter_id: string;
  version_id?: string | null;
  parent_id?: string | null;
  anchor_text?: string | null;
  comment_text: string;
  mentions?: string[];
  status: "abierto" | "resuelto";
  created_by: string;
  resolved_by?: string | null;
  created_at?: string;
};

export type Llm2Health = {
  trace_id?: string;
  reachable: boolean;
  status: "ok" | "error" | "checking";
  model?: string;
  base_url?: string;
  models_url?: string;
  model_available?: boolean | null;
  latency_ms?: number;
  checked_at?: string;
  detail?: string;
};

export type CpvItem = {
  code: string;
  code8?: string;
  label: string;
  label_es?: string;
  label_en?: string;
  level?: string;
  source?: string;
  score?: number;
  reason?: string;
};

export type CpvContext = {
  trace_id: string;
  mode: string;
  query: string;
  contract_type?: string;
  confidence?: number;
  fallback_query?: string;
  detail?: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function responseError(response: Response) {
  let detail = response.statusText || "Error de API";
  try {
    const payload = await response.clone().json() as { detail?: unknown };
    if (typeof payload.detail === "string" && payload.detail.trim()) detail = payload.detail;
    else if (payload.detail) detail = JSON.stringify(payload.detail);
  } catch {
    try {
      const text = (await response.clone().text()).trim();
      if (text) detail = text.slice(0, 500);
    } catch {
      // The status code and status text still provide a safe fallback.
    }
  }
  return new Error(`${response.status} ${detail}`);
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store" });
  if (!response.ok) {
    throw await responseError(response);
  }
  return response.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  if (!response.ok) {
    throw await responseError(response);
  }
  return response.json() as Promise<T>;
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  if (!response.ok) {
    throw await responseError(response);
  }
  return response.json() as Promise<T>;
}

async function putJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  if (!response.ok) {
    throw await responseError(response);
  }
  return response.json() as Promise<T>;
}

export async function fetchKbSummary() {
  return getJson<{ summary: KbSummary }>("/kb/summary");
}

export async function searchCpvs(query: string, language = "es", limit = 30) {
  const params = new URLSearchParams({ language, limit: String(limit) });
  if (query.trim()) params.set("q", query.trim());
  return getJson<{ trace_id: string; mode: string; source_url: string; count: number; items: CpvItem[] }>(`/cpv?${params.toString()}`);
}

export async function suggestCpvs(payload: {
  query?: string | null;
  title?: string | null;
  object?: string | null;
  need?: string | null;
  language?: string;
  top_k?: number;
  selected_codes?: string[];
}) {
  return postJson<{ trace_id: string; mode: string; source_url: string; items: CpvItem[] }>("/cpv/suggest", payload);
}

export async function extractCpvContext(payload: {
  title?: string | null;
  object?: string | null;
  need?: string | null;
  language?: string;
}) {
  return postJson<CpvContext>("/cpv/context", payload);
}

export async function fetchLlm2Health() {
  return getJson<Llm2Health>("/llm2/health");
}

export async function fetchDocuments() {
  return getJson<{ items: KbDocument[]; summary: KbSummary }>("/documents");
}

export async function fetchSources() {
  return getJson<{ items: SourceRow[]; summary: KbSummary }>("/sources");
}

export async function fetchTenders() {
  return getJson<{ items: KbTender[]; trace_id: string }>("/kb/tenders");
}

export async function searchKb(
  query: string,
  options: { tender_id?: string; cpv?: string; document_type?: string; language?: string; top_k?: number }
) {
  return postJson<{ trace_id: string; mode: string; hits: SearchHit[]; applied_filters: Record<string, unknown> }>("/search", {
    query,
    top_k: options.top_k ?? 12,
    tender_id: options.tender_id || null,
    cpv: options.cpv || null,
    document_type: options.document_type || null,
    language: options.language || null
  });
}

export async function fetchDocumentMarkdown(documentId: string) {
  return getJson<{ markdown: string; document_id: string }>(`/documents/${encodeURIComponent(documentId)}/markdown`);
}

export type WorkspaceListResponse = {
  trace_id: string;
  active_workspace_id?: string | null;
  items: Workspace[];
  total?: number;
  page?: number;
  page_size?: number;
  pages?: number;
  search_mode?: string;
};

export async function fetchWorkspaces(
  includeArchived = false,
  options: { query?: string; page?: number; page_size?: number } = {}
) {
  const params = new URLSearchParams();
  if (includeArchived) params.set("include_archived", "true");
  if (options.query?.trim()) params.set("q", options.query.trim());
  if (options.page) params.set("page", String(options.page));
  if (options.page_size) params.set("page_size", String(options.page_size));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getJson<WorkspaceListResponse>(`/workspaces${suffix}`);
}

export async function createWorkspace(body: Partial<Workspace>) {
  return postJson<{ trace_id: string; workspace: Workspace }>("/workspaces", body);
}

export async function updateWorkspace(id: string, body: Partial<Workspace>) {
  return patchJson<{ trace_id: string; workspace: Workspace }>(`/workspaces/${encodeURIComponent(id)}`, body);
}

export async function activateWorkspace(id: string) {
  return postJson<{ trace_id: string; active_workspace_id: string; workspace: Workspace }>(`/workspaces/${encodeURIComponent(id)}/activate`, {});
}

export async function archiveWorkspace(id: string) {
  return postJson<{ trace_id: string; workspace: Workspace }>(`/workspaces/${encodeURIComponent(id)}/archive`, {});
}

export async function restoreWorkspace(id: string) {
  return postJson<{ trace_id: string; active_workspace_id: string; workspace: Workspace }>(`/workspaces/${encodeURIComponent(id)}/restore`, {});
}

export type TemplateListResponse = {
  trace_id: string;
  items: DocumentTemplate[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
};

export async function fetchTemplates(options: { status?: string; document_type?: string; query?: string; page?: number; page_size?: number } = {}) {
  const params = new URLSearchParams();
  if (options.status) params.set("status", options.status);
  if (options.document_type) params.set("document_type", options.document_type);
  if (options.query?.trim()) params.set("q", options.query.trim());
  if (options.page) params.set("page", String(options.page));
  if (options.page_size) params.set("page_size", String(options.page_size));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getJson<TemplateListResponse>(`/templates${suffix}`);
}

export async function createTemplate(body: {
  workspace_id?: string | null;
  name: string;
  document_type: string;
  language: string;
  markdown: string;
  tags?: string[];
}) {
  return postJson<{ trace_id: string; template: DocumentTemplate; sections?: DocumentTemplateSection[]; milvus_indexed?: boolean }>("/templates", body);
}

export async function uploadTemplate(payload: {
  file: File;
  name: string;
  document_type: string;
  language: string;
  tags?: string[];
  workspace_id?: string | null;
}) {
  const form = new FormData();
  form.set("file", payload.file);
  form.set("name", payload.name);
  form.set("document_type", payload.document_type);
  form.set("language", payload.language);
  form.set("tags", (payload.tags ?? []).join(","));
  if (payload.workspace_id) form.set("workspace_id", payload.workspace_id);
  const response = await fetch(`${API_BASE_URL}/templates/upload`, {
    method: "POST",
    body: form,
    cache: "no-store"
  });
  if (!response.ok) {
    throw await responseError(response);
  }
  return response.json() as Promise<{ trace_id: string; template: DocumentTemplate; sections?: DocumentTemplateSection[]; milvus_indexed?: boolean }>;
}

export async function archiveTemplate(id: string) {
  return postJson<{ trace_id: string; template: DocumentTemplate }>(`/templates/${encodeURIComponent(id)}/archive`, {});
}

export async function restoreTemplate(id: string) {
  return postJson<{ trace_id: string; template: DocumentTemplate }>(`/templates/${encodeURIComponent(id)}/restore`, {});
}

export async function processTemplate(id: string) {
  return postJson<{ trace_id: string; template: DocumentTemplate; sections: number; milvus_indexed?: boolean }>(`/templates/${encodeURIComponent(id)}/process`, {});
}

export async function fetchTemplateSections(id: string) {
  return getJson<{ trace_id: string; template_id: string; sections: DocumentTemplateSection[] }>(`/templates/${encodeURIComponent(id)}/sections`);
}

export async function fetchWorkspaceTemplates(workspaceId: string) {
  return getJson<{ trace_id: string; workspace_id: string; templates: WorkspaceTemplateLink[] }>(`/workspaces/${encodeURIComponent(workspaceId)}/templates`);
}

export async function updateWorkspaceTemplates(workspaceId: string, templates: WorkspaceTemplateLink[]) {
  return putJson<{ trace_id: string; workspace_id: string; templates: WorkspaceTemplateLink[]; workspace: Workspace }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/templates`,
    { templates }
  );
}

export async function startGuidedSession(workspaceId: string, language = "es", documentType: DocumentKind = "ppt") {
  return postJson<{ trace_id: string; session_id: string; document_type: DocumentKind; next_field: string; next_question: string; questions: Array<[string, string]> }>("/elicit/sessions", {
    workspace_id: workspaceId,
    language,
    target_document: documentType
  });
}

export async function sendGuidedMessage(sessionId: string, workspaceId: string, field: string, message: string, language = "es") {
  return postJson<{
    trace_id: string;
    session_id: string;
    workspace: Workspace;
    next_field?: string | null;
    next_question?: string | null;
    missing_fields: string[];
  }>(`/elicit/sessions/${encodeURIComponent(sessionId)}/message`, {
    workspace_id: workspaceId,
    field,
    message,
    language
  });
}

export async function suggestGuidedAnswer(
  workspaceId: string,
  field: string,
  options: { language?: string; currentValue?: string; objectHint?: string; mode?: "suggest" | "expand" } = {}
) {
  return postJson<{
    trace_id: string;
    workspace_id: string;
    field: string;
    blocked: boolean;
    reason?: string;
    suggestion: string;
    model?: string;
    llm?: Record<string, unknown>;
  }>(`/workspaces/${encodeURIComponent(workspaceId)}/guided-suggestion`, {
    workspace_id: workspaceId,
    field,
    language: options.language ?? "es",
    current_value: options.currentValue ?? "",
    object_hint: options.objectHint ?? "",
    mode: options.mode ?? "suggest"
  });
}

export type GuidedSuggestionStreamEvent =
  | { type: "meta"; trace_id?: string; workspace_id?: string; field?: string; mode?: "suggest" | "expand"; minimum_tokens?: number; model?: string }
  | { type: "token"; delta: string }
  | { type: "replace"; content: string }
  | { type: "blocked"; reason?: string }
  | { type: "final"; trace_id?: string; workspace_id?: string; field?: string; mode?: "suggest" | "expand"; suggestion: string; llm?: Record<string, unknown> }
  | { type: "error"; detail: string }
  | { type: "done" };

export async function suggestGuidedAnswerStream(
  workspaceId: string,
  field: string,
  options: { language?: string; currentValue?: string; objectHint?: string; mode?: "suggest" | "expand" } = {},
  onEvent: (event: GuidedSuggestionStreamEvent) => void
) {
  const response = await fetch(`${API_BASE_URL}/workspaces/${encodeURIComponent(workspaceId)}/guided-suggestion/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({
      workspace_id: workspaceId,
      field,
      language: options.language ?? "es",
      current_value: options.currentValue ?? "",
      object_hint: options.objectHint ?? "",
      mode: options.mode ?? "suggest"
    }),
    cache: "no-store"
  });
  if (!response.ok) throw await responseError(response);
  if (!response.body) throw new Error("La respuesta de IA no contiene un flujo de datos.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split(/\n\n/);
    buffer = events.pop() ?? "";
    for (const rawEvent of events) {
      const parsed = parseSseEvent<GuidedSuggestionStreamEvent>(rawEvent);
      if (parsed) onEvent(parsed);
    }
  }
  const trailing = parseSseEvent<GuidedSuggestionStreamEvent>(buffer);
  if (trailing) onEvent(trailing);
}

export async function fetchDocumentSpecs() {
  return getJson<{ trace_id: string; items: DocumentSpec[] }>("/document-specs");
}

export async function fetchWorkspaceDocuments(workspaceId: string) {
  return getJson<{ trace_id: string; workspace_id: string; items: DocumentOverview[] }>(`/workspaces/${encodeURIComponent(workspaceId)}/documents`);
}

export async function autoSelectReferences(workspaceId: string, query?: string, documentType: DocumentKind = "ppt") {
  return postJson<{ trace_id: string; workspace_id: string; strategy: string; language?: string | null; references: ReferenceCandidate[] }>("/references/auto-select", {
    workspace_id: workspaceId,
    query,
    document_type: documentType,
    top_k: 15
  });
}

export async function updateAcceptedReferences(workspaceId: string, references: string[], documentType: DocumentKind = "ppt") {
  return patchJson<{ trace_id: string; workspace_id: string; accepted: string[]; references: ReferenceCandidate[]; workspace: Workspace }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/references`,
    { references, document_type: documentType }
  );
}

export async function proposeDraftIndex(workspaceId: string, language = "es", documentType: DocumentKind = "ppt") {
  return postJson<{ trace_id: string; workspace_id: string; requires_human_validation: boolean; index: DraftIndex }>("/draft-index", {
    workspace_id: workspaceId,
    document_type: documentType,
    language
  });
}

export async function updateDocumentIndex(workspaceId: string, documentType: DocumentKind, chapters: DraftChapter[]) {
  return putJson<{ trace_id: string; workspace_id: string; document_type: DocumentKind; index: DraftIndex }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/documents/${documentType}/index`,
    { workspace_id: workspaceId, document_type: documentType, chapters }
  );
}

export async function validateDraftIndex(indexId: string) {
  return postJson<{ trace_id: string; workspace_id: string; index: DraftIndex }>(`/draft-index/${encodeURIComponent(indexId)}/validate`, {});
}

export async function fetchChapters(workspaceId: string, documentType?: DocumentKind) {
  const params = documentType ? `?document_type=${documentType}` : "";
  return getJson<{ trace_id: string; workspace_id: string; document_type?: DocumentKind; chapters: ChapterVersion[] }>(`/workspaces/${encodeURIComponent(workspaceId)}/chapters${params}`);
}

export async function draftChapter(workspaceId: string, chapterId: string, language = "es") {
  return postJson<{
    trace_id: string;
    blocked: boolean;
    reason?: string;
    content?: string;
    chapter?: DraftChapter;
    version?: { document_id: string; version_id: string; generated_by: string; created_at: string };
    citations?: ReferenceCandidate[];
    context_budget?: Record<string, unknown>;
    pending_decisions?: string[];
  }>(`/chapters/${encodeURIComponent(chapterId)}/draft`, { workspace_id: workspaceId, language });
}

export type DraftStreamEvent =
  | { type: "meta"; trace_id?: string; workspace_id?: string; chapter?: DraftChapter; context_budget?: Record<string, unknown>; reference_sections?: number; template_sections?: number }
  | { type: "token"; delta: string }
  | { type: "replace"; content: string }
  | { type: "blocked"; reason?: string; context_budget?: Record<string, unknown> }
  | { type: "saved"; trace_id?: string; workspace_id?: string; version?: { document_id: string; version_id: string; generated_by: string; created_at: string }; context_budget?: Record<string, unknown> }
  | { type: "error"; detail: string }
  | { type: "done" };

export async function draftChapterStream(
  workspaceId: string,
  chapterId: string,
  language: string,
  onEvent: (event: DraftStreamEvent) => void,
  documentType: DocumentKind = "ppt"
) {
  const response = await fetch(`${API_BASE_URL}/chapters/${encodeURIComponent(chapterId)}/draft/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ workspace_id: workspaceId, language, document_type: documentType }),
    cache: "no-store"
  });
  if (!response.ok) throw await responseError(response);
  if (!response.body) throw new Error("La respuesta de redacción no contiene un flujo de datos.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split(/\n\n/);
    buffer = events.pop() ?? "";
    for (const rawEvent of events) {
      const parsed = parseSseEvent<DraftStreamEvent>(rawEvent);
      if (parsed) onEvent(parsed);
    }
  }
  const trailing = parseSseEvent<DraftStreamEvent>(buffer);
  if (trailing) onEvent(trailing);
}

function parseSseEvent<T extends { type: string }>(rawEvent: string): T | null {
  const lines = rawEvent.split(/\n/);
  const typeLine = lines.find((line) => line.startsWith("event:"));
  const dataLines = lines.filter((line) => line.startsWith("data:"));
  if (!typeLine) return null;
  const type = typeLine.replace("event:", "").trim();
  const rawData = dataLines.map((line) => line.replace("data:", "").trimStart()).join("\n") || "{}";
  try {
    return { type, ...JSON.parse(rawData) } as T;
  } catch {
    return { type: "error", detail: `stream_parse_error:${type}` } as unknown as T;
  }
}

export async function updateChapter(
  workspaceId: string,
  chapterId: string,
  content: string,
  summary?: string,
  options: { expectedVersionId?: string; autosave?: boolean; comment?: string } = {}
) {
  return patchJson<{ trace_id: string; workspace_id: string; chapter: DraftChapter; version: ChapterVersion; unchanged?: boolean; impact_required: boolean }>(
    `/chapters/${encodeURIComponent(chapterId)}`,
    {
      workspace_id: workspaceId,
      content,
      summary,
      expected_version_id: options.expectedVersionId,
      autosave: options.autosave ?? false,
      comment: options.comment
    }
  );
}

export async function improveChapterText(
  workspaceId: string,
  chapterId: string,
  content: string,
  options: { selectedText?: string; instruction?: string; language?: string } = {}
) {
  return postJson<{
    trace_id: string;
    workspace_id: string;
    chapter_id: string;
    blocked: boolean;
    reason?: string;
    mode: "selection" | "chapter";
    improved_text: string;
    llm?: Record<string, unknown>;
  }>(`/chapters/${encodeURIComponent(chapterId)}/improve`, {
    workspace_id: workspaceId,
    content,
    selected_text: options.selectedText ?? "",
    instruction: options.instruction ?? "Añadir más detalle",
    language: options.language ?? "es"
  });
}

export type ImproveStreamEvent =
  | { type: "meta"; trace_id?: string; workspace_id?: string; chapter_id?: string; mode?: "selection" | "chapter" }
  | { type: "token"; delta: string }
  | { type: "replace"; content: string }
  | { type: "blocked"; reason?: string; improved_text?: string; mode?: "selection" | "chapter" }
  | { type: "final"; trace_id?: string; workspace_id?: string; chapter_id?: string; mode?: "selection" | "chapter"; improved_text: string; llm?: Record<string, unknown> }
  | { type: "error"; detail: string }
  | { type: "done" };

export async function improveChapterTextStream(
  workspaceId: string,
  chapterId: string,
  content: string,
  options: { selectedText?: string; instruction?: string; language?: string } = {},
  onEvent: (event: ImproveStreamEvent) => void
) {
  const response = await fetch(`${API_BASE_URL}/chapters/${encodeURIComponent(chapterId)}/improve/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({
      workspace_id: workspaceId,
      content,
      selected_text: options.selectedText ?? "",
      instruction: options.instruction ?? "Añadir más detalle",
      language: options.language ?? "es"
    }),
    cache: "no-store"
  });
  if (!response.ok) throw await responseError(response);
  if (!response.body) throw new Error("La respuesta de mejora no contiene un flujo de datos.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split(/\n\n/);
    buffer = events.pop() ?? "";
    for (const rawEvent of events) {
      const parsed = parseSseEvent<ImproveStreamEvent>(rawEvent);
      if (parsed) onEvent(parsed);
    }
  }
  const trailing = parseSseEvent<ImproveStreamEvent>(buffer);
  if (trailing) onEvent(trailing);
}

export async function fetchImpactProposals(workspaceId: string, chapterId: string, content: string) {
  return postJson<{ trace_id: string; workspace_id: string; chapter_id: string; proposals: ImpactProposal[] }>(
    `/chapters/${encodeURIComponent(chapterId)}/impact-proposals`,
    { workspace_id: workspaceId, content }
  );
}

export async function fetchChapterVersions(workspaceId: string, chapterId: string) {
  return getJson<{ trace_id: string; workspace_id: string; chapter_id: string; items: ChapterVersion[] }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/chapters/${encodeURIComponent(chapterId)}/versions`
  );
}

export async function compareChapterVersions(workspaceId: string, chapterId: string, left: string, right: string) {
  const params = new URLSearchParams({ left, right });
  return getJson<{ trace_id: string; chapter_id: string; left: ChapterVersion; right: ChapterVersion; diff: string }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/chapters/${encodeURIComponent(chapterId)}/versions/compare?${params}`
  );
}

export async function restoreChapterVersion(workspaceId: string, chapterId: string, versionId: string, comment: string) {
  return postJson<{ trace_id: string; workspace_id: string; chapter_id: string; version: ChapterVersion }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/chapters/${encodeURIComponent(chapterId)}/versions/${encodeURIComponent(versionId)}/restore`,
    { comment }
  );
}

export async function createRegenerationProposal(
  workspaceId: string,
  chapterId: string,
  documentType: DocumentKind,
  language: string,
  instruction?: string
) {
  return postJson<{ trace_id: string; proposal: RegenerationProposal }>(
    `/chapters/${encodeURIComponent(chapterId)}/regeneration-proposals`,
    { workspace_id: workspaceId, document_type: documentType, language, instruction }
  );
}

export async function fetchRegenerationProposals(workspaceId: string, chapterId?: string) {
  const params = chapterId ? `?chapter_id=${encodeURIComponent(chapterId)}` : "";
  return getJson<{ trace_id: string; workspace_id: string; items: RegenerationProposal[] }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/regeneration-proposals${params}`
  );
}

export async function resolveRegenerationProposal(proposalId: string, decision: "aceptar" | "rechazar", comment: string) {
  return patchJson<{ trace_id: string; proposal_id: string; status: string; version?: ChapterVersion | null }>(
    `/regeneration-proposals/${encodeURIComponent(proposalId)}`,
    { decision, comment }
  );
}

export async function fetchChangeProposals(workspaceId: string) {
  return getJson<{ trace_id: string; workspace_id: string; items: ChangeProposal[] }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/change-proposals`
  );
}

export async function resolveChangeProposal(proposalId: string, decision: "aceptar" | "rechazar", comment: string) {
  return patchJson<{ trace_id: string; proposal_id: string; status: string; safe_propagation: string }>(
    `/change-proposals/${encodeURIComponent(proposalId)}`,
    { decision, comment }
  );
}

export async function runCoherenceReview(workspaceId: string, documentTypes: DocumentKind[] = ["informe_necesidad", "ppt", "pcap"]) {
  return postJson<{
    trace_id: string;
    workspace_id: string;
    document_types: DocumentKind[];
    summary: { error: number; advertencia: number; recomendacion: number; open: number };
    items: ValidationIssue[];
  }>("/validate/documents", { workspace_id: workspaceId, documents: documentTypes, modes: ["coherencia"] });
}

export async function fetchValidationIssues(workspaceId: string, includeResolved = false) {
  return getJson<{ trace_id: string; workspace_id: string; items: ValidationIssue[] }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/validation-issues?include_resolved=${includeResolved}`
  );
}

export async function resolveValidationIssue(
  issueId: string,
  status: ValidationIssue["status"],
  comment: string
) {
  return patchJson<{ trace_id: string; issue_id: string; status: ValidationIssue["status"] }>(
    `/validation-issues/${encodeURIComponent(issueId)}`,
    { status, comment }
  );
}

export async function fetchWorkspaceSources(workspaceId: string) {
  return getJson<{ trace_id: string; workspace_id: string; items: WorkspaceSource[] }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/sources`
  );
}

export async function uploadWorkspaceSource(workspaceId: string, file: File, title?: string) {
  const body = new FormData();
  body.append("file", file);
  if (title?.trim()) body.append("title", title.trim());
  const response = await fetch(`${API_BASE_URL}/workspaces/${encodeURIComponent(workspaceId)}/sources/upload`, {
    method: "POST",
    body,
    cache: "no-store"
  });
  if (!response.ok) throw await responseError(response);
  return response.json() as Promise<{ trace_id: string; source: WorkspaceSource }>;
}

export async function updateWorkspaceSource(workspaceId: string, sourceId: string, includedInGeneration: boolean) {
  return patchJson<{ trace_id: string; source: WorkspaceSource }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/sources/${encodeURIComponent(sourceId)}`,
    { included_in_generation: includedInGeneration }
  );
}

export async function updateDocumentStatus(workspaceId: string, documentType: DocumentKind, status: Exclude<DocumentWorkflowStatus, "no_iniciado">, comment?: string) {
  return patchJson<{ trace_id: string; workspace_id: string; document_type: DocumentKind; state: Record<string, unknown> }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/documents/${documentType}/status`,
    { status, comment }
  );
}

export async function exportDocx(workspaceId: string, documentType: DocumentKind = "ppt") {
  return postJson<{ trace_id: string; object_key: string; filename?: string; download_url?: string; stored_in_seaweedfs: boolean; bytes: number }>("/exports/docx", {
    workspace_id: workspaceId,
    document_type: documentType,
    only_validated: false
  });
}

export async function downloadDocx(workspaceId: string, filenameHint?: string, documentType: DocumentKind = "ppt") {
  const response = await fetch(`${API_BASE_URL}/exports/docx/download?workspace_id=${encodeURIComponent(workspaceId)}&document_type=${documentType}&only_validated=false`, { cache: "no-store" });
  if (!response.ok) {
    throw await responseError(response);
  }
  const disposition = response.headers.get("content-disposition") ?? "";
  const filenameMatch = /filename="?([^"]+)"?/i.exec(disposition);
  return {
    blob: await response.blob(),
    filename: filenameMatch?.[1] ?? filenameHint ?? `xtender-${workspaceId}.docx`
  };
}

export async function exportDossier(workspaceId: string, documentTypes: DocumentKind[] = ["informe_necesidad", "ppt", "pcap", "informe_juridico"]) {
  return postJson<{
    trace_id: string;
    workspace_id: string;
    object_key: string;
    filename: string;
    download_url: string;
    stored_in_seaweedfs: boolean;
    bytes: number;
    documents: Array<{ document_type: DocumentKind; filename: string; content_hash: string; bytes: number }>;
  }>("/exports/dossier", { workspace_id: workspaceId, document_types: documentTypes, only_final: false });
}

export async function downloadDossier(workspaceId: string, filenameHint?: string, documentTypes: DocumentKind[] = ["informe_necesidad", "ppt", "pcap", "informe_juridico"]) {
  const types = encodeURIComponent(documentTypes.join(","));
  const response = await fetch(`${API_BASE_URL}/exports/dossier/download?workspace_id=${encodeURIComponent(workspaceId)}&only_final=false&document_types=${types}`, { cache: "no-store" });
  if (!response.ok) throw await responseError(response);
  const disposition = response.headers.get("content-disposition") ?? "";
  const filenameMatch = /filename="?([^"]+)"?/i.exec(disposition);
  return {
    blob: await response.blob(),
    filename: filenameMatch?.[1] ?? filenameHint ?? `xtender-${workspaceId}-expediente.zip`
  };
}

export async function fetchAudit(workspaceId?: string) {
  return getJson<{ trace_id: string; events: AuditEvent[] }>(`/audit${workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : ""}`);
}

export async function fetchCategory1Capabilities() {
  return getJson<{ trace_id: string; items: Category1Capability[]; summary: Record<string, number> }>("/preparation/capabilities");
}

export async function fetchAnnualPlan(year: number) {
  return getJson<{ trace_id: string; year: number; items: AnnualPlanItem[]; summary: Record<string, number> }>(`/preparation/annual-plan?year=${year}`);
}

export async function saveAnnualPlanItem(payload: Omit<AnnualPlanItem, "id" | "risk_level">) {
  return postJson<{ trace_id: string; item: AnnualPlanItem }>("/preparation/annual-plan", payload);
}

export async function fetchMarketStudies(workspaceId: string) {
  return getJson<{ trace_id: string; items: MarketStudy[] }>(`/workspaces/${encodeURIComponent(workspaceId)}/market-studies`);
}

export async function createMarketStudy(payload: {
  workspace_id: string;
  scope: string;
  search_query?: string;
  cpv_codes?: string[];
  reference_ids?: string[];
  scenarios?: Array<Record<string, unknown>>;
  economic_operators?: Array<Record<string, unknown>>;
  risks?: Array<Record<string, unknown>>;
  conclusions?: string;
  status?: "borrador" | "en_revision" | "validado";
}) {
  return postJson<{ trace_id: string; study: MarketStudy }>(`/workspaces/${encodeURIComponent(payload.workspace_id)}/market-studies`, payload);
}

export async function fetchProcurementRisks(workspaceId: string) {
  return getJson<{ trace_id: string; items: ProcurementRisk[]; summary: Record<string, number> }>(`/workspaces/${encodeURIComponent(workspaceId)}/risks`);
}

export async function createProcurementRisk(payload: {
  workspace_id: string;
  category: string;
  description: string;
  probability: number;
  impact: number;
  mitigation?: string;
  contingency?: string;
  owner?: string;
  status?: "abierto" | "mitigando" | "aceptado" | "cerrado";
  source_refs?: string[];
}) {
  return postJson<{ trace_id: string; risk: ProcurementRisk }>(`/workspaces/${encodeURIComponent(payload.workspace_id)}/risks`, payload);
}

export async function fetchProcurementSchedules(workspaceId: string) {
  return getJson<{ trace_id: string; items: ProcurementSchedule[] }>(`/workspaces/${encodeURIComponent(workspaceId)}/schedules`);
}

export async function createProcurementSchedule(payload: {
  workspace_id: string;
  procedure?: string;
  start_date: string;
  phases?: Array<Record<string, unknown>>;
  assumptions?: string[];
  status?: "borrador" | "validado";
}) {
  return postJson<{ trace_id: string; schedule: ProcurementSchedule }>(`/workspaces/${encodeURIComponent(payload.workspace_id)}/schedules`, payload);
}

export async function fetchEconomicCalculations(workspaceId: string) {
  return getJson<{ trace_id: string; items: EconomicCalculation[] }>(`/workspaces/${encodeURIComponent(workspaceId)}/economic-calculations`);
}

export async function createEconomicCalculation(payload: {
  workspace_id: string;
  currency?: string;
  line_items: Array<{ description: string; quantity: number; unit_price: number; periods?: number }>;
  other_costs?: number;
  contingency?: number;
  tax_rate?: number;
  extensions_amount?: number;
  options_amount?: number;
  modification_percent?: number;
  assumptions?: string[];
  status?: "borrador" | "validado";
}) {
  return postJson<{ trace_id: string; calculation: EconomicCalculation }>(`/workspaces/${encodeURIComponent(payload.workspace_id)}/economic-calculations`, payload);
}

export async function applyEconomicCalculation(workspaceId: string, calculationId: string) {
  return postJson<{ trace_id: string; calculation: EconomicCalculation; workspace: Workspace }>(`/workspaces/${encodeURIComponent(workspaceId)}/economic-calculations/${encodeURIComponent(calculationId)}/apply`, {});
}

export async function exploreTenders(query: string, options: { cpv?: string; documentType?: string; language?: string; limit?: number } = {}) {
  const params = new URLSearchParams({ q: query, limit: String(options.limit ?? 30) });
  if (options.cpv) params.set("cpv", options.cpv);
  if (options.documentType) params.set("document_type", options.documentType);
  if (options.language) params.set("language", options.language);
  return getJson<{ trace_id: string; items: SearchHit[]; total: number; relaxed_filters?: string[] }>(`/preparation/explorer/tenders?${params}`);
}

export async function exploreLegalSources(query: string, sourceKind?: string) {
  const params = new URLSearchParams({ q: query, limit: "30" });
  if (sourceKind) params.set("source_kind", sourceKind);
  return getJson<{ trace_id: string; items: LegalKnowledgeSource[]; total: number }>(`/preparation/explorer/legal?${params}`);
}

export async function fetchOfficialConnectors() {
  return getJson<{ trace_id: string; items: OfficialConnector[] }>("/preparation/official-sources");
}

export async function syncOfficialSources(connectors: string[], queryTerms: string[]) {
  return postJson<{ trace_id: string; items: Array<Record<string, unknown>>; summary: Record<string, number> }>("/preparation/official-sources/sync", {
    connectors,
    limit_per_connector: 100,
    include_text: true,
    query_terms: queryTerms
  });
}

export async function fetchSavedSearches() {
  return getJson<{ trace_id: string; items: SavedSearch[] }>("/preparation/saved-searches");
}

export async function createSavedSearch(payload: Omit<SavedSearch, "id" | "last_checked_at" | "new_result_count">) {
  return postJson<{ trace_id: string; search: SavedSearch }>("/preparation/saved-searches", payload);
}

export async function runSavedSearch(searchId: string) {
  return postJson<{ trace_id: string; search_id: string; new_result_ids: string[]; result: Record<string, unknown> }>(`/preparation/saved-searches/${encodeURIComponent(searchId)}/run`, {});
}

export async function fetchWorkspaceTasks(workspaceId: string) {
  return getJson<{ trace_id: string; items: WorkspaceTask[]; summary: Record<string, number> }>(`/workspaces/${encodeURIComponent(workspaceId)}/tasks`);
}

export async function createWorkspaceTask(workspaceId: string, payload: {
  title: string;
  description?: string;
  phase_id?: string;
  due_date?: string;
  priority?: "baja" | "media" | "alta" | "critica";
  status?: "pendiente" | "en_curso" | "bloqueada" | "completada" | "cancelada";
}) {
  return postJson<{ trace_id: string; task: WorkspaceTask }>(`/workspaces/${encodeURIComponent(workspaceId)}/tasks`, payload);
}

export async function fetchLiteracyStatus() {
  return getJson<{ trace_id: string; items: LiteracyModule[]; summary: { completed: number; total: number } }>("/preparation/literacy");
}

export async function completeLiteracyModule(moduleId: string, version: string, score: number, attested: boolean) {
  return postJson<{ trace_id: string; completion: Record<string, unknown> }>(`/preparation/literacy/${encodeURIComponent(moduleId)}/complete`, {
    module_version: version,
    quiz_score: score,
    attested
  });
}

export async function fetchComplianceProfile() {
  return getJson<{ trace_id: string; profile: Record<string, unknown>; evidence: Array<Record<string, unknown>>; controls: ComplianceControl[]; summary: Record<string, number> }>("/preparation/compliance");
}

export async function fetchClauseCatalog(query = "", documentType?: DocumentKind) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (documentType) params.set("document_type", documentType);
  return getJson<{ trace_id: string; items: ClauseCatalogEntry[] }>(`/preparation/clauses${params.toString() ? `?${params}` : ""}`);
}

export async function createClauseCatalogEntry(payload: {
  title: string;
  content_text: string;
  document_types: DocumentKind[];
  contract_types?: string[];
  procedure_types?: string[];
  tags?: string[];
  visibility?: "privada" | "organizacion" | "publica";
  status?: "borrador" | "en_revision" | "aprobada";
  variables?: string[];
  legal_source_ids?: string[];
  source_clause_ids?: string[];
  change_summary?: string;
}) {
  return postJson<{ trace_id: string; clause: ClauseCatalogEntry; version: Record<string, unknown> }>("/preparation/clauses", payload);
}

export async function renderClauseForWorkspace(workspaceId: string, clauseId: string) {
  return postJson<{ trace_id: string; proposal: string; unresolved_variables: string[]; requires_human_acceptance: boolean }>(`/workspaces/${encodeURIComponent(workspaceId)}/clauses/${encodeURIComponent(clauseId)}/render`, {});
}

export async function reviewAiChapter(workspaceId: string, chapterId: string, versionId: string, decision: "aceptado" | "rechazado", comment?: string) {
  return postJson<{ trace_id: string; review: Record<string, unknown> }>("/preparation/ai-reviews", {
    workspace_id: workspaceId,
    target_type: "chapter",
    target_id: chapterId,
    target_version_id: versionId,
    decision,
    comment
  });
}

export async function fetchAiOutputReviews(workspaceId: string, targetId?: string) {
  const params = new URLSearchParams({ workspace_id: workspaceId });
  if (targetId) params.set("target_id", targetId);
  return getJson<{ trace_id: string; items: AiOutputReview[] }>(`/preparation/ai-reviews?${params}`);
}

export async function runAdvancedValidation(workspaceId: string) {
  return postJson<{ trace_id: string; items: ValidationIssue[]; summary: Record<string, number> }>(`/preparation/validation/${encodeURIComponent(workspaceId)}`, {
    modes: ["redundancia", "ambiguedad", "restriccion", "normativa"]
  });
}

export async function fetchDocumentComments(workspaceId: string, chapterId?: string, includeResolved = true) {
  const params = new URLSearchParams({ include_resolved: String(includeResolved) });
  if (chapterId) params.set("chapter_id", chapterId);
  return getJson<{ trace_id: string; items: DocumentComment[]; open: number }>(`/workspaces/${encodeURIComponent(workspaceId)}/comments?${params}`);
}

export async function createDocumentComment(workspaceId: string, payload: {
  document_type: DocumentKind;
  chapter_id: string;
  version_id?: string;
  parent_id?: string;
  anchor_text?: string;
  comment_text: string;
  mentions?: string[];
}) {
  return postJson<{ trace_id: string; comment: DocumentComment }>(`/workspaces/${encodeURIComponent(workspaceId)}/comments`, payload);
}

export async function resolveDocumentComment(workspaceId: string, commentId: string, status: "abierto" | "resuelto") {
  return patchJson<{ trace_id: string; comment_id: string; status: string }>(`/workspaces/${encodeURIComponent(workspaceId)}/comments/${encodeURIComponent(commentId)}`, { status });
}
