from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field


class RuntimeConfig(BaseModel):
    app_env: str = "local"
    default_locale: str = "es"
    supported_locales: list[str] = Field(default_factory=lambda: ["es", "ca", "va", "gl", "eu"])
    postgres_dsn: str = "postgresql://procureai:procureai@postgres:5432/procureai"
    milvus_uri: str = "http://milvus:19530"
    milvus_db: str = "default"
    milvus_user: str = ""
    milvus_password: str = ""
    milvus_token: str = ""
    milvus_collection: str = "kb_chunks_v1"
    milvus_enable_hybrid: bool = True
    object_storage_endpoint: str = "http://host.docker.internal:8333"
    object_storage_bucket: str = "procureai"
    embedding_api_url: str = "http://embedding-api:8010"
    embedding_model: str = "BAAI/bge-m3"
    llm_provider: str = "openai_compatible"
    llm_base_url: str = "http://vllm:8000/v1"
    llm_model: str = "ver_modelo_real_en_destino"
    llm_api_key: str = ""
    llm_context_window: int = 128000
    llm_max_output_tokens: int = 8192
    llm_temperature: float = 0.2
    llm_top_p: float = 0.9
    llm_timeout_seconds: int = 300
    retrieval_top_k: int = 80
    retrieval_final_k: int = 24
    retrieval_max_chunks_per_doc: int = 5
    rerank_enabled: bool = True
    auth_mode: str = "development_headers"
    auth_bearer_token: str = ""
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000"])

    @property
    def reserved_context_budget(self) -> dict[str, int]:
        return {
            "system_rules": 6000,
            "workspace_context": 8000,
            "conversation_summary": 4000,
            "retrieved_chunks": 64000,
            "templates": 12000,
            "draft_context": 12000,
            "output_margin": min(self.llm_max_output_tokens, 16000),
        }


def _read_env_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        text = line.strip()
        if not text or text.startswith("#") or "=" not in text:
            continue
        key, value = text.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def _get(values: dict[str, str], *keys: str, default: str) -> str:
    for key in keys:
        candidate = os.environ.get(key) or values.get(key)
        if candidate:
            return candidate
    return default


def _get_int(values: dict[str, str], *keys: str, default: int) -> int:
    raw = _get(values, *keys, default=str(default))
    try:
        return int(raw)
    except ValueError:
        return default


def _get_float(values: dict[str, str], *keys: str, default: float) -> float:
    raw = _get(values, *keys, default=str(default))
    try:
        return float(raw)
    except ValueError:
        return default


def _get_bool(values: dict[str, str], *keys: str, default: bool) -> bool:
    raw = _get(values, *keys, default=str(default)).lower()
    return raw in {"1", "true", "yes", "y", "on"}


def load_runtime_config(env_path: str | Path | None = None) -> RuntimeConfig:
    path = Path(env_path) if env_path else Path.cwd() / ".env.local"
    values = _read_env_file(path)
    supported = _get(values, "APP_SUPPORTED_LOCALES", default="es,ca,va,gl,eu")
    cors_origins = _get(values, "CORS_ORIGINS", default="http://localhost:3000,http://127.0.0.1:3000")
    return RuntimeConfig(
        app_env=_get(values, "APP_ENV", default="local"),
        default_locale=_get(values, "APP_DEFAULT_LOCALE", default="es"),
        supported_locales=[item.strip() for item in supported.split(",") if item.strip()],
        postgres_dsn=_get(values, "POSTGRES_DSN", default=RuntimeConfig().postgres_dsn),
        milvus_uri=_get(values, "MILVUS_URI", default=RuntimeConfig().milvus_uri),
        milvus_db=_get(values, "MILVUS_DB", default=RuntimeConfig().milvus_db),
        milvus_user=_get(values, "MILVUS_USER", default=""),
        milvus_password=_get(values, "MILVUS_PASSWORD", default=""),
        milvus_token=_get(values, "MILVUS_TOKEN", default=""),
        milvus_collection=_get(values, "MILVUS_COLLECTION", default=RuntimeConfig().milvus_collection),
        milvus_enable_hybrid=_get_bool(values, "MILVUS_ENABLE_HYBRID", default=True),
        object_storage_endpoint=_get(values, "OBJECT_STORAGE_ENDPOINT", default=RuntimeConfig().object_storage_endpoint),
        object_storage_bucket=_get(values, "OBJECT_STORAGE_BUCKET", default=RuntimeConfig().object_storage_bucket),
        embedding_api_url=_get(values, "EMBEDDING_API_URL", "EMBEDDING_MODEL_HOST", default=RuntimeConfig().embedding_api_url),
        embedding_model=_get(values, "EMBEDDING_MODEL", "EMBEDDING_MODEL_NAME", default=RuntimeConfig().embedding_model),
        llm_provider=_get(values, "LLM_PROVIDER", default=RuntimeConfig().llm_provider),
        llm_base_url=_get(values, "LLM_BASE_URL", "LLM_MODEL_HOST", default=RuntimeConfig().llm_base_url),
        llm_model=_get(values, "LLM_MODEL", "LLM_MODEL_NAME", default=RuntimeConfig().llm_model),
        llm_api_key=_get(values, "LLM_API_KEY", "LLM_MODEL_API_KEY", default=""),
        llm_context_window=_get_int(values, "LLM_CONTEXT_WINDOW", default=128000),
        llm_max_output_tokens=_get_int(values, "LLM_MAX_OUTPUT_TOKENS", default=8192),
        llm_temperature=_get_float(values, "LLM_TEMPERATURE", default=0.2),
        llm_top_p=_get_float(values, "LLM_TOP_P", default=0.9),
        llm_timeout_seconds=_get_int(values, "LLM_TIMEOUT_SECONDS", default=300),
        retrieval_top_k=_get_int(values, "RETRIEVAL_TOP_K", default=80),
        retrieval_final_k=_get_int(values, "RETRIEVAL_FINAL_K", default=24),
        retrieval_max_chunks_per_doc=_get_int(values, "RETRIEVAL_MAX_CHUNKS_PER_DOC", default=5),
        rerank_enabled=_get_bool(values, "RERANK_ENABLED", default=True),
        auth_mode=_get(values, "AUTH_MODE", default="development_headers"),
        auth_bearer_token=_get(values, "API_AUTH_BEARER_TOKEN", default=""),
        cors_origins=[item.strip() for item in cors_origins.split(",") if item.strip()],
    )


def sanitized_config(config: RuntimeConfig) -> dict[str, Any]:
    data = config.model_dump()
    data["postgres_dsn"] = _redact_dsn(config.postgres_dsn)
    data["llm_api_key"] = "***" if config.llm_api_key else ""
    data["milvus_password"] = "***" if config.milvus_password else ""
    data["milvus_token"] = "***" if config.milvus_token else ""
    data["auth_bearer_token"] = "***" if config.auth_bearer_token else ""
    return data


def _redact_dsn(value: str) -> str:
    if "@" not in value or "://" not in value:
        return value
    scheme, rest = value.split("://", 1)
    _, host = rest.rsplit("@", 1)
    return f"{scheme}://***:***@{host}"
