CREATE TABLE IF NOT EXISTS annual_procurement_plan_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  workspace_id TEXT REFERENCES procurement_workspaces(id) ON DELETE SET NULL,
  plan_year INTEGER NOT NULL,
  title TEXT NOT NULL,
  need TEXT,
  contracting_body TEXT,
  promoting_unit TEXT,
  cpv_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  contract_type TEXT,
  procedure TEXT,
  estimated_value NUMERIC,
  planned_quarter INTEGER,
  planned_publication_date DATE,
  owner TEXT,
  status TEXT NOT NULL DEFAULT 'previsto',
  risk_level TEXT NOT NULL DEFAULT 'sin_evaluar',
  notes TEXT,
  archived_at TIMESTAMPTZ,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (planned_quarter IS NULL OR planned_quarter BETWEEN 1 AND 4),
  CHECK (status IN ('idea', 'previsto', 'en_preparacion', 'publicado', 'adjudicado', 'cancelado', 'archivado')),
  CHECK (risk_level IN ('sin_evaluar', 'bajo', 'medio', 'alto', 'critico'))
);

CREATE TABLE IF NOT EXISTS market_studies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  workspace_id TEXT NOT NULL REFERENCES procurement_workspaces(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'borrador',
  scope TEXT NOT NULL,
  search_query TEXT,
  cpv_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  reference_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  statistics JSONB NOT NULL DEFAULT '{}'::jsonb,
  scenarios JSONB NOT NULL DEFAULT '[]'::jsonb,
  economic_operators JSONB NOT NULL DEFAULT '[]'::jsonb,
  risks JSONB NOT NULL DEFAULT '[]'::jsonb,
  conclusions TEXT,
  limitations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT REFERENCES users(id),
  validated_by TEXT REFERENCES users(id),
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status IN ('borrador', 'en_revision', 'validado')),
  UNIQUE (workspace_id, version)
);

CREATE TABLE IF NOT EXISTS procurement_risks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  workspace_id TEXT NOT NULL REFERENCES procurement_workspaces(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  probability INTEGER NOT NULL,
  impact INTEGER NOT NULL,
  score INTEGER NOT NULL,
  level TEXT NOT NULL,
  mitigation TEXT,
  contingency TEXT,
  owner TEXT,
  status TEXT NOT NULL DEFAULT 'abierto',
  source_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (probability BETWEEN 1 AND 5),
  CHECK (impact BETWEEN 1 AND 5),
  CHECK (score BETWEEN 1 AND 25),
  CHECK (level IN ('bajo', 'medio', 'alto', 'critico')),
  CHECK (status IN ('abierto', 'mitigando', 'aceptado', 'cerrado'))
);

CREATE TABLE IF NOT EXISTS procurement_schedules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  workspace_id TEXT NOT NULL REFERENCES procurement_workspaces(id) ON DELETE CASCADE,
  procedure TEXT,
  start_date DATE NOT NULL,
  target_date DATE,
  phases JSONB NOT NULL DEFAULT '[]'::jsonb,
  alerts JSONB NOT NULL DEFAULT '[]'::jsonb,
  assumptions JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'borrador',
  created_by TEXT REFERENCES users(id),
  validated_by TEXT REFERENCES users(id),
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status IN ('borrador', 'validado'))
);

CREATE TABLE IF NOT EXISTS economic_calculations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  workspace_id TEXT NOT NULL REFERENCES procurement_workspaces(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  other_costs NUMERIC NOT NULL DEFAULT 0,
  contingency NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  base_without_tax NUMERIC NOT NULL,
  tax_amount NUMERIC NOT NULL,
  base_with_tax NUMERIC NOT NULL,
  extensions_amount NUMERIC NOT NULL DEFAULT 0,
  options_amount NUMERIC NOT NULL DEFAULT 0,
  modifications_amount NUMERIC NOT NULL DEFAULT 0,
  estimated_value NUMERIC NOT NULL,
  assumptions JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'borrador',
  created_by TEXT REFERENCES users(id),
  validated_by TEXT REFERENCES users(id),
  validated_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status IN ('borrador', 'validado', 'aplicado')),
  UNIQUE (workspace_id, version)
);

CREATE TABLE IF NOT EXISTS legal_knowledge_sources (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  source_kind TEXT NOT NULL,
  title TEXT NOT NULL,
  publisher TEXT,
  jurisdiction TEXT,
  source_url TEXT NOT NULL,
  reference_number TEXT,
  publication_date DATE,
  effective_from DATE,
  effective_to DATE,
  language TEXT NOT NULL DEFAULT 'es',
  content_text TEXT,
  content_hash TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'vigente_sin_verificar',
  created_by TEXT REFERENCES users(id),
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (source_kind IN ('normativa', 'doctrina', 'jurisprudencia')),
  CHECK (status IN ('vigente', 'vigente_sin_verificar', 'derogada', 'sustituida', 'archivada')),
  UNIQUE (tenant_id, source_url)
);

CREATE TABLE IF NOT EXISTS ai_output_reviews (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  workspace_id TEXT NOT NULL REFERENCES procurement_workspaces(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_version_id TEXT,
  decision TEXT NOT NULL,
  comment TEXT,
  reviewer_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (decision IN ('aceptado', 'rechazado', 'modificado'))
);

CREATE TABLE IF NOT EXISTS ai_literacy_completions (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  module_id TEXT NOT NULL,
  module_version TEXT NOT NULL,
  quiz_score INTEGER NOT NULL,
  attested BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id, module_id, module_version),
  CHECK (quiz_score BETWEEN 0 AND 100)
);

CREATE TABLE IF NOT EXISTS compliance_profiles (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id),
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_by TEXT REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_annual_plan_tenant_year ON annual_procurement_plan_items(tenant_id, plan_year, status);
CREATE INDEX IF NOT EXISTS idx_market_studies_workspace ON market_studies(tenant_id, workspace_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_procurement_risks_workspace ON procurement_risks(tenant_id, workspace_id, status, score DESC);
CREATE INDEX IF NOT EXISTS idx_procurement_schedules_workspace ON procurement_schedules(tenant_id, workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_economic_calculations_workspace ON economic_calculations(tenant_id, workspace_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_legal_sources_search ON legal_knowledge_sources(tenant_id, source_kind, status);
CREATE INDEX IF NOT EXISTS idx_ai_output_reviews_target ON ai_output_reviews(tenant_id, workspace_id, target_id, created_at DESC);
