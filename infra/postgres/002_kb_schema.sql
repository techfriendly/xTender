CREATE TABLE IF NOT EXISTS kb_imports (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS kb_tenders (
  id TEXT PRIMARY KEY,
  atom_id TEXT NOT NULL,
  expediente TEXT,
  title TEXT NOT NULL,
  updated_at TIMESTAMPTZ,
  status TEXT,
  cpv TEXT,
  contracting_body TEXT,
  contract_uri TEXT,
  technical_uri TEXT,
  legal_uri TEXT,
  estimated_value NUMERIC,
  budget_without_tax NUMERIC,
  budget_with_tax NUMERIC,
  currency TEXT,
  province TEXT,
  locality TEXT,
  source_feed TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(contracting_body, '') || ' ' || coalesce(cpv, '') || ' ' || coalesce(expediente, ''))
  ) STORED
);

CREATE TABLE IF NOT EXISTS kb_documents (
  id TEXT PRIMARY KEY,
  tender_id TEXT NOT NULL REFERENCES kb_tenders(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  markdown_path TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  page_count INTEGER,
  indexed_pages INTEGER,
  extraction_quality NUMERIC,
  language TEXT NOT NULL DEFAULT 'es',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(document_type, '') || ' ' || coalesce(language, ''))
  ) STORED
);

CREATE TABLE IF NOT EXISTS kb_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
  tender_id TEXT NOT NULL REFERENCES kb_tenders(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  title TEXT NOT NULL,
  chunk_text TEXT NOT NULL,
  source_url TEXT NOT NULL,
  heading_path JSONB NOT NULL DEFAULT '[]'::jsonb,
  page_start INTEGER,
  page_end INTEGER,
  cpv_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  contracting_body TEXT,
  publication_date TIMESTAMPTZ,
  language TEXT NOT NULL DEFAULT 'es',
  content_hash TEXT NOT NULL,
  token_count_estimate INTEGER,
  chunk_strategy TEXT,
  embedding_model_max_tokens INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(chunk_text, '') || ' ' || coalesce(contracting_body, ''))
  ) STORED
);

ALTER TABLE kb_chunks ADD COLUMN IF NOT EXISTS token_count_estimate INTEGER;
ALTER TABLE kb_chunks ADD COLUMN IF NOT EXISTS chunk_strategy TEXT;
ALTER TABLE kb_chunks ADD COLUMN IF NOT EXISTS embedding_model_max_tokens INTEGER;

CREATE INDEX IF NOT EXISTS idx_kb_tenders_search ON kb_tenders USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_kb_documents_tender_type ON kb_documents(tender_id, document_type);
CREATE INDEX IF NOT EXISTS idx_kb_documents_search ON kb_documents USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_document ON kb_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_tender ON kb_chunks(tender_id);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_type_language ON kb_chunks(document_type, language);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_search ON kb_chunks USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_cpv ON kb_chunks USING GIN(cpv_codes jsonb_path_ops);

CREATE TABLE IF NOT EXISTS kb_crawl_months (
  feed_id TEXT NOT NULL,
  period TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  tenders_count INTEGER NOT NULL DEFAULT 0,
  documents_count INTEGER NOT NULL DEFAULT 0,
  chunks_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  source_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (feed_id, period)
);

CREATE TABLE IF NOT EXISTS kb_document_ingest_errors (
  id TEXT PRIMARY KEY,
  feed_id TEXT NOT NULL,
  period TEXT NOT NULL,
  tender_id TEXT,
  expediente TEXT,
  document_type TEXT,
  source_url TEXT,
  error TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_kb_crawl_months_status ON kb_crawl_months(status, period);
CREATE INDEX IF NOT EXISTS idx_kb_document_ingest_errors_period ON kb_document_ingest_errors(feed_id, period);
