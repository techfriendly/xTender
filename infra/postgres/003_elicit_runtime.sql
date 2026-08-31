ALTER TABLE procurement_workspaces ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE procurement_workspaces ADD COLUMN IF NOT EXISTS active_document_type TEXT NOT NULL DEFAULT 'ppt';

ALTER TABLE assistant_sessions ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL DEFAULT 'entrevista';
ALTER TABLE assistant_sessions ADD COLUMN IF NOT EXISTS answers JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE draft_documents ADD COLUMN IF NOT EXISTS chapter_id TEXT;
ALTER TABLE draft_documents ADD COLUMN IF NOT EXISTS chapter_order INTEGER;
ALTER TABLE draft_documents ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE draft_document_versions ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE draft_document_versions ADD COLUMN IF NOT EXISTS citations JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE draft_document_versions ADD COLUMN IF NOT EXISTS context_budget JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE validation_issues ADD COLUMN IF NOT EXISTS section TEXT;
ALTER TABLE validation_issues ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_workspaces_status_archived ON procurement_workspaces(tenant_id, status, archived_at);
CREATE INDEX IF NOT EXISTS idx_draft_documents_workspace_chapter ON draft_documents(workspace_id, chapter_id);
CREATE INDEX IF NOT EXISTS idx_draft_versions_document_created ON draft_document_versions(draft_document_id, created_at DESC);
