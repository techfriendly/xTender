CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS corpora (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  corpus_id TEXT REFERENCES corpora(id),
  source_type TEXT NOT NULL,
  title TEXT NOT NULL,
  source_url TEXT,
  fetched_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS crawl_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  source_id TEXT REFERENCES sources(id),
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  log JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  source_id TEXT REFERENCES sources(id),
  title TEXT NOT NULL,
  document_type TEXT NOT NULL,
  language TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS document_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id),
  version_label TEXT NOT NULL,
  raw_pdf_key TEXT,
  markdown_key TEXT,
  json_key TEXT,
  pdf_hash TEXT,
  markdown_hash TEXT,
  extraction_quality NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chunks_catalog (
  id TEXT PRIMARY KEY,
  document_version_id TEXT NOT NULL REFERENCES document_versions(id),
  milvus_collection TEXT NOT NULL,
  page_start INTEGER,
  page_end INTEGER,
  heading_path JSONB NOT NULL DEFAULT '[]'::jsonb,
  content_hash TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS embedding_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  document_version_id TEXT REFERENCES document_versions(id),
  status TEXT NOT NULL,
  model TEXT NOT NULL,
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS model_versions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  version_label TEXT,
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS procurement_workspaces (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  title TEXT NOT NULL,
  unit TEXT,
  owner_user_id TEXT REFERENCES users(id),
  language TEXT NOT NULL DEFAULT 'es',
  status TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assistant_sessions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES procurement_workspaces(id),
  user_id TEXT REFERENCES users(id),
  language TEXT NOT NULL,
  status TEXT NOT NULL,
  context_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assistant_answers (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES assistant_sessions(id),
  model_version_id TEXT REFERENCES model_versions(id),
  prompt_hash TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  confidence TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS answer_citations (
  id TEXT PRIMARY KEY,
  answer_id TEXT NOT NULL REFERENCES assistant_answers(id),
  source_id TEXT REFERENCES sources(id),
  chunk_id TEXT,
  document_version_id TEXT REFERENCES document_versions(id),
  page INTEGER,
  section TEXT,
  quote_hash TEXT
);

CREATE TABLE IF NOT EXISTS draft_documents (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES procurement_workspaces(id),
  document_type TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS draft_document_versions (
  id TEXT PRIMARY KEY,
  draft_document_id TEXT NOT NULL REFERENCES draft_documents(id),
  version_label TEXT NOT NULL,
  content_key TEXT,
  content_text TEXT,
  generated_by TEXT NOT NULL,
  validated_by TEXT REFERENCES users(id),
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS validation_issues (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES procurement_workspaces(id),
  draft_document_id TEXT REFERENCES draft_documents(id),
  severity TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  fragment TEXT NOT NULL,
  proposal TEXT,
  status TEXT NOT NULL,
  owner_user_id TEXT REFERENCES users(id),
  source_id TEXT REFERENCES sources(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES procurement_workspaces(id),
  user_id TEXT REFERENCES users(id),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  workspace_id TEXT REFERENCES procurement_workspaces(id),
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS system_settings (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  setting_key TEXT NOT NULL,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_documents_tenant_type ON documents(tenant_id, document_type);
CREATE INDEX IF NOT EXISTS idx_workspaces_tenant_status ON procurement_workspaces(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_validation_workspace_status ON validation_issues(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_workspace_created ON audit_events(workspace_id, created_at DESC);
