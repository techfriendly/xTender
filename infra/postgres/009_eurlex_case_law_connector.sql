BEGIN;

-- Existing databases retain the check constraint created by migration 007.
-- Recreate it idempotently so the official EUR-Lex case-law connector can be
-- audited in the same run table without altering any existing run.
ALTER TABLE knowledge_sync_runs
  DROP CONSTRAINT IF EXISTS knowledge_sync_runs_connector_check;

ALTER TABLE knowledge_sync_runs
  ADD CONSTRAINT knowledge_sync_runs_connector_check
  CHECK (connector IN ('boe', 'dogc', 'tacrc', 'tccsp', 'eurlex', 'eurlex_jurisprudencia'));

COMMIT;
