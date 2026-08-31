CREATE TABLE IF NOT EXISTS knowledge_sync_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  connector TEXT NOT NULL,
  status TEXT NOT NULL,
  cursor_value TEXT,
  requested JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  started_by TEXT REFERENCES users(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  CHECK (connector IN ('boe', 'dogc', 'tacrc', 'tccsp', 'eurlex', 'eurlex_jurisprudencia')),
  CHECK (status IN ('ejecutando', 'completado', 'parcial', 'error'))
);

CREATE TABLE IF NOT EXISTS saved_searches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  search_kind TEXT NOT NULL,
  query TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  alert_frequency TEXT NOT NULL DEFAULT 'sin_alerta',
  last_checked_at TIMESTAMPTZ,
  last_result_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  new_result_count INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (search_kind IN ('licitaciones', 'normativa', 'doctrina', 'jurisprudencia')),
  CHECK (alert_frequency IN ('sin_alerta', 'diaria', 'semanal'))
);

CREATE TABLE IF NOT EXISTS workspace_tasks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  workspace_id TEXT NOT NULL REFERENCES procurement_workspaces(id) ON DELETE CASCADE,
  phase_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  assignee_user_id TEXT REFERENCES users(id),
  due_date DATE,
  priority TEXT NOT NULL DEFAULT 'media',
  status TEXT NOT NULL DEFAULT 'pendiente',
  depends_on JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT REFERENCES users(id),
  completed_by TEXT REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (priority IN ('baja', 'media', 'alta', 'critica')),
  CHECK (status IN ('pendiente', 'en_curso', 'bloqueada', 'completada', 'cancelada'))
);

CREATE TABLE IF NOT EXISTS document_comments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  workspace_id TEXT NOT NULL REFERENCES procurement_workspaces(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  version_id TEXT,
  parent_id TEXT REFERENCES document_comments(id) ON DELETE CASCADE,
  anchor_text TEXT,
  anchor_start INTEGER,
  anchor_end INTEGER,
  comment_text TEXT NOT NULL,
  mentions JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'abierto',
  created_by TEXT NOT NULL REFERENCES users(id),
  resolved_by TEXT REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status IN ('abierto', 'resuelto'))
);

CREATE TABLE IF NOT EXISTS clause_catalog_entries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  title TEXT NOT NULL,
  document_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  contract_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  procedure_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  visibility TEXT NOT NULL DEFAULT 'organizacion',
  status TEXT NOT NULL DEFAULT 'borrador',
  active_version_id TEXT,
  created_by TEXT REFERENCES users(id),
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (visibility IN ('privada', 'organizacion', 'publica')),
  CHECK (status IN ('borrador', 'en_revision', 'aprobada', 'archivada'))
);

CREATE TABLE IF NOT EXISTS clause_catalog_versions (
  id TEXT PRIMARY KEY,
  clause_id TEXT NOT NULL REFERENCES clause_catalog_entries(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content_text TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  legal_source_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_clause_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  change_summary TEXT,
  content_hash TEXT NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clause_id, version_number)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clause_catalog_active_version_fk'
  ) THEN
    ALTER TABLE clause_catalog_entries
      ADD CONSTRAINT clause_catalog_active_version_fk
      FOREIGN KEY (active_version_id) REFERENCES clause_catalog_versions(id)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS user_notifications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  workspace_id TEXT REFERENCES procurement_workspaces(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  target JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS print_profiles (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id),
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by TEXT REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE workspace_documents ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'workspace';
ALTER TABLE workspace_documents ADD COLUMN IF NOT EXISTS owner_user_id TEXT REFERENCES users(id);
ALTER TABLE workspace_documents ADD COLUMN IF NOT EXISTS custom_status TEXT;

CREATE INDEX IF NOT EXISTS idx_sync_runs_tenant_connector ON knowledge_sync_runs(tenant_id, connector, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(tenant_id, user_id, active);
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_due ON workspace_tasks(tenant_id, workspace_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_document_comments_chapter ON document_comments(tenant_id, workspace_id, chapter_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_clause_catalog_filters ON clause_catalog_entries(tenant_id, status, visibility);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON user_notifications(tenant_id, user_id, read_at, created_at DESC);
