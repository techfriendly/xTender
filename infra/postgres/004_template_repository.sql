CREATE TABLE IF NOT EXISTS document_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  document_type TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'es',
  status TEXT NOT NULL DEFAULT 'activa',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  active_version_id TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS document_template_versions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  version_label TEXT NOT NULL,
  source_filename TEXT,
  source_mime TEXT,
  original_key TEXT,
  markdown_key TEXT,
  manifest_key TEXT,
  markdown_text TEXT,
  markdown_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'activa',
  error TEXT,
  page_count INTEGER,
  extraction_quality NUMERIC,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS document_template_sections (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  version_id TEXT NOT NULL REFERENCES document_template_versions(id) ON DELETE CASCADE,
  section_order INTEGER NOT NULL,
  heading_path JSONB NOT NULL DEFAULT '[]'::jsonb,
  title TEXT NOT NULL,
  content_text TEXT NOT NULL,
  token_count_estimate INTEGER,
  content_hash TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS workspace_template_links (
  workspace_id TEXT NOT NULL REFERENCES procurement_workspaces(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  usage TEXT NOT NULL DEFAULT 'estructura',
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, template_id, usage)
);

CREATE INDEX IF NOT EXISTS idx_document_templates_tenant_status ON document_templates(tenant_id, status, document_type);
CREATE INDEX IF NOT EXISTS idx_document_template_sections_template ON document_template_sections(template_id, version_id, section_order);
CREATE INDEX IF NOT EXISTS idx_workspace_template_links_workspace ON workspace_template_links(workspace_id);
