-- Keep exact CPV filtering indexable before the explorer broadens a search.
-- jsonb_path_ops supports the @> containment operator used by kb.db_search.
CREATE INDEX IF NOT EXISTS idx_kb_chunks_cpv
  ON kb_chunks USING GIN(cpv_codes jsonb_path_ops);
