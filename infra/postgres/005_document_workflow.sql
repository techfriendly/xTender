CREATE TABLE IF NOT EXISTS workspace_documents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  workspace_id TEXT NOT NULL REFERENCES procurement_workspaces(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'borrador',
  index_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  shared_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT REFERENCES users(id),
  finalized_by TEXT REFERENCES users(id),
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, document_type),
  CHECK (status IN ('borrador', 'en_revision', 'final'))
);

ALTER TABLE draft_documents ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE draft_documents ADD COLUMN IF NOT EXISTS workspace_document_id TEXT REFERENCES workspace_documents(id) ON DELETE CASCADE;
ALTER TABLE draft_documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE draft_documents d
SET tenant_id = w.tenant_id
FROM procurement_workspaces w
WHERE d.workspace_id = w.id AND d.tenant_id IS NULL;

ALTER TABLE draft_document_versions ADD COLUMN IF NOT EXISTS parent_version_id TEXT REFERENCES draft_document_versions(id);
ALTER TABLE draft_document_versions ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE draft_document_versions ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'generated';
ALTER TABLE draft_document_versions ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES users(id);
ALTER TABLE draft_document_versions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'borrador';
ALTER TABLE draft_document_versions ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS chapter_regeneration_proposals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  workspace_id TEXT NOT NULL REFERENCES procurement_workspaces(id) ON DELETE CASCADE,
  draft_document_id TEXT NOT NULL REFERENCES draft_documents(id) ON DELETE CASCADE,
  base_version_id TEXT REFERENCES draft_document_versions(id),
  proposed_content TEXT NOT NULL,
  diff_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  prompt_trace JSONB NOT NULL DEFAULT '{}'::jsonb,
  model TEXT,
  status TEXT NOT NULL DEFAULT 'pendiente',
  created_by TEXT REFERENCES users(id),
  resolved_by TEXT REFERENCES users(id),
  resolution_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  CHECK (status IN ('pendiente', 'aceptada', 'rechazada'))
);

CREATE TABLE IF NOT EXISTS workspace_change_proposals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  workspace_id TEXT NOT NULL REFERENCES procurement_workspaces(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  previous_value JSONB,
  proposed_value JSONB,
  impacted_sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pendiente',
  created_by TEXT REFERENCES users(id),
  resolved_by TEXT REFERENCES users(id),
  resolution_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  CHECK (status IN ('pendiente', 'aceptada', 'rechazada'))
);

CREATE TABLE IF NOT EXISTS workspace_sources (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  workspace_id TEXT NOT NULL REFERENCES procurement_workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'aportada',
  source_url TEXT,
  original_filename TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  content_hash TEXT NOT NULL,
  object_key TEXT,
  extracted_text TEXT,
  extraction_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'procesada',
  included_in_generation BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status IN ('procesando', 'procesada', 'error', 'excluida'))
);

ALTER TABLE validation_issues ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE validation_issues ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE validation_issues ADD COLUMN IF NOT EXISTS explanation TEXT;
ALTER TABLE validation_issues ADD COLUMN IF NOT EXISTS locations JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE validation_issues ADD COLUMN IF NOT EXISTS document_types JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE validation_issues ADD COLUMN IF NOT EXISTS resolution_comment TEXT;
ALTER TABLE validation_issues ADD COLUMN IF NOT EXISTS resolved_by TEXT REFERENCES users(id);
ALTER TABLE validation_issues ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE validation_issues ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS document_export_records (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  workspace_id TEXT NOT NULL REFERENCES procurement_workspaces(id) ON DELETE CASCADE,
  document_type TEXT,
  export_type TEXT NOT NULL,
  object_key TEXT,
  filename TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  included_versions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id TEXT NOT NULL REFERENCES procurement_workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL DEFAULT 'edit',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id),
  CHECK (access_level IN ('read', 'edit', 'validate', 'manage'))
);

CREATE INDEX IF NOT EXISTS idx_workspace_documents_workspace ON workspace_documents(tenant_id, workspace_id, document_type);
CREATE INDEX IF NOT EXISTS idx_draft_documents_tenant_workspace ON draft_documents(tenant_id, workspace_id, document_type);
CREATE INDEX IF NOT EXISTS idx_draft_versions_parent ON draft_document_versions(draft_document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_regeneration_workspace_status ON chapter_regeneration_proposals(tenant_id, workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_change_proposals_workspace_status ON workspace_change_proposals(tenant_id, workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_workspace_sources_workspace ON workspace_sources(tenant_id, workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_validation_tenant_workspace_status ON validation_issues(workspace_id, status, severity);
CREATE INDEX IF NOT EXISTS idx_exports_workspace_created ON document_export_records(tenant_id, workspace_id, created_at DESC);
