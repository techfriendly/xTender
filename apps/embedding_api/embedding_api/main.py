from __future__ import annotations

import hashlib
import math
import os
import re
import threading
import time
from collections import Counter
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

MODEL_NAME = "BAAI/bge-m3"
MODEL_VERSION = "deterministic-development-contract-v1"
DIMENSION = 1024
_REAL_MODEL: Any | None = None
_REAL_MODEL_ERROR: str | None = None
_REAL_DEVICE: str | None = None
_REMOTE_ERROR: str | None = None
_MODEL_LOAD_LOCK = threading.RLock()
_MODEL_INFERENCE_LOCK = threading.Lock()

app = FastAPI(title="xTender Embedding API", version="0.1.0")


class EmbedRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=128)
    normalize: bool = True


class RerankRequest(BaseModel):
    query: str
    documents: list[str] = Field(min_length=1, max_length=256)
    top_k: int = Field(default=10, ge=1, le=256)


def _hash_float(seed: str, index: int) -> float:
    digest = hashlib.blake2b(f"{seed}:{index}".encode(), digest_size=8).digest()
    integer = int.from_bytes(digest, "big")
    return (integer / 2**64) * 2 - 1


def dense_vector(text: str, normalize: bool = True) -> list[float]:
    vector = [_hash_float(text, index) for index in range(DIMENSION)]
    if normalize:
        norm = math.sqrt(sum(value * value for value in vector)) or 1.0
        vector = [value / norm for value in vector]
    return vector


def sparse_vector(text: str) -> dict[str, float]:
    tokens = re.findall(r"[a-zA-Z0-9áéíóúàèòçñüÁÉÍÓÚÀÈÒÇÑÜ]+", text.lower())
    counts = Counter(tokens)
    total = sum(counts.values()) or 1
    return {token: round(count / total, 6) for token, count in counts.items()}


def _embedding_backend() -> str:
    return os.environ.get("EMBEDDING_BACKEND", "real").strip().lower()


def _remote_base_url() -> str:
    return os.environ.get("EMBEDDING_OPENAI_BASE_URL", "").strip().rstrip("/")


def _remote_model_name() -> str:
    return os.environ.get("EMBEDDING_OPENAI_MODEL", os.environ.get("EMBEDDING_MODEL", MODEL_NAME)).strip()


def _remote_headers() -> dict[str, str]:
    api_key = os.environ.get("EMBEDDING_OPENAI_API_KEY", "").strip()
    return {"Authorization": f"Bearer {api_key}"} if api_key else {}


def _resolve_device() -> str:
    configured = os.environ.get("EMBEDDING_DEVICE", "auto").strip().lower()
    if configured not in {"auto", ""}:
        return configured
    try:
        import torch

        return "cuda" if torch.cuda.is_available() else "cpu"
    except Exception:
        return "cpu"


def _load_real_model() -> Any | None:
    global _REAL_MODEL, _REAL_MODEL_ERROR, _REAL_DEVICE
    backend = _embedding_backend()
    if backend in {"deterministic", "mock"}:
        return None
    with _MODEL_LOAD_LOCK:
        if _REAL_MODEL is not None:
            return _REAL_MODEL
        if _REAL_MODEL_ERROR and backend == "auto":
            return None
        try:
            from FlagEmbedding import BGEM3FlagModel

            device = _resolve_device()
            model_name = os.environ.get("EMBEDDING_MODEL", MODEL_NAME)
            use_fp16 = os.environ.get("EMBEDDING_USE_FP16", "").strip().lower()
            fp16 = use_fp16 in {"1", "true", "yes", "on"} if use_fp16 else device.startswith("cuda")
            try:
                _REAL_MODEL = BGEM3FlagModel(model_name, use_fp16=fp16, devices=device)
            except TypeError:
                _REAL_MODEL = BGEM3FlagModel(model_name, use_fp16=fp16)
            _REAL_DEVICE = device
            _REAL_MODEL_ERROR = None
            return _REAL_MODEL
        except Exception as exc:
            _REAL_MODEL_ERROR = str(exc)[:500]
            if backend == "real":
                raise
            return None


def _normalize_dense(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(value * value for value in vector)) or 1.0
    return [value / norm for value in vector]


def _real_hybrid_vectors(texts: list[str], normalize: bool) -> list[dict[str, Any]] | None:
    model = _load_real_model()
    if model is None:
        return None
    batch_size = int(os.environ.get("EMBEDDING_BATCH_SIZE", "16") or "16")
    max_length = int(os.environ.get("EMBEDDING_MAX_LENGTH", "8192") or "8192")
    # FlagEmbedding/PyTorch model instances are not safe to execute concurrently.
    # Serialising GPU inference also prevents duplicate allocations and transient OOMs.
    with _MODEL_INFERENCE_LOCK:
        output = model.encode(
            texts,
            batch_size=batch_size,
            max_length=max_length,
            return_dense=True,
            return_sparse=True,
            return_colbert_vecs=False,
        )
    dense_values = output.get("dense_vecs")
    if dense_values is None:
        dense_values = output.get("dense") or []
    sparse_values = output.get("lexical_weights")
    if sparse_values is None:
        sparse_values = output.get("sparse_vecs")
    if sparse_values is None:
        sparse_values = output.get("sparse")
    if sparse_values is None:
        sparse_values = [{} for _ in texts]
    items: list[dict[str, Any]] = []
    for index, dense in enumerate(dense_values):
        vector = [float(value) for value in getattr(dense, "tolist", lambda: dense)()]
        if normalize:
            vector = _normalize_dense(vector)
        sparse_raw = sparse_values[index] if index < len(sparse_values) else {}
        sparse = {str(token): float(weight) for token, weight in dict(sparse_raw).items()}
        items.append({"dense_vector": vector, "sparse_vector": sparse})
    return items


def _remote_hybrid_vectors(texts: list[str], normalize: bool) -> list[dict[str, Any]]:
    global _REMOTE_ERROR
    base_url = _remote_base_url()
    if not base_url:
        raise RuntimeError("EMBEDDING_OPENAI_BASE_URL no está configurada")
    timeout = float(os.environ.get("EMBEDDING_TIMEOUT_SECONDS", "30") or "30")
    try:
        response = httpx.post(
            f"{base_url}/embeddings",
            headers=_remote_headers(),
            json={"model": _remote_model_name(), "input": texts, "encoding_format": "float"},
            timeout=timeout,
        )
        response.raise_for_status()
        rows = sorted(response.json().get("data") or [], key=lambda item: int(item.get("index") or 0))
        if len(rows) != len(texts):
            raise RuntimeError(f"el proveedor devolvió {len(rows)} vectores para {len(texts)} textos")
        items: list[dict[str, Any]] = []
        for text, row in zip(texts, rows):
            vector = [float(value) for value in row.get("embedding") or []]
            if len(vector) != DIMENSION:
                raise RuntimeError(f"dimensión de embedding inesperada: {len(vector)}; se esperaba {DIMENSION}")
            items.append(
                {
                    "dense_vector": _normalize_dense(vector) if normalize else vector,
                    "sparse_vector": sparse_vector(text),
                }
            )
        _REMOTE_ERROR = None
        return items
    except Exception as exc:
        _REMOTE_ERROR = str(exc)[:500]
        raise


def hybrid_vectors(texts: list[str], normalize: bool) -> list[dict[str, Any]]:
    try:
        backend = _embedding_backend()
        real = _remote_hybrid_vectors(texts, normalize) if backend in {"openai_compatible", "remote"} else _real_hybrid_vectors(texts, normalize)
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "embedding_model_unavailable", "backend": _embedding_backend(), "error": str(exc)[:300]},
        ) from exc
    if real is not None:
        return real
    return [{"dense_vector": dense_vector(text, normalize), "sparse_vector": sparse_vector(text)} for text in texts]


def active_model_version() -> str:
    if _embedding_backend() in {"openai_compatible", "remote"}:
        return f"openai-compatible:{_remote_model_name()}"
    if _REAL_MODEL is not None:
        return "bge-m3-flagembedding"
    if _embedding_backend() == "real" and _REAL_MODEL_ERROR:
        return "unavailable"
    return MODEL_VERSION


def active_backend() -> str:
    if _embedding_backend() in {"openai_compatible", "remote"}:
        return "openai_compatible" if not _REMOTE_ERROR else "unavailable"
    if _REAL_MODEL is not None:
        return "flagembedding"
    configured = _embedding_backend()
    if configured in {"deterministic", "mock"}:
        return "deterministic"
    if _REAL_MODEL_ERROR:
        return "deterministic_fallback" if configured == "auto" else "unavailable"
    return "not_loaded"


def response_meta(text: str, elapsed_ms: int) -> dict[str, Any]:
    return {
        "model": MODEL_NAME,
        "model_version": active_model_version(),
        "backend": active_backend(),
        "device": _REAL_DEVICE or _resolve_device(),
        "dimension": DIMENSION,
        "elapsed_ms": elapsed_ms,
        "text_hash": hashlib.sha256(text.encode()).hexdigest(),
    }


@app.get("/health")
def health() -> dict[str, str | None]:
    backend = _embedding_backend()
    if backend in {"openai_compatible", "remote"}:
        global _REMOTE_ERROR
        try:
            response = httpx.get(f"{_remote_base_url()}/models", headers=_remote_headers(), timeout=5)
            response.raise_for_status()
            _REMOTE_ERROR = None
        except Exception as exc:
            _REMOTE_ERROR = str(exc)[:500]
    elif backend in {"auto", "real"}:
        try:
            _load_real_model()
        except Exception:
            pass
    status = "ok"
    if backend in {"openai_compatible", "remote"} and _REMOTE_ERROR:
        status = "error"
    elif backend == "real" and _REAL_MODEL is None:
        status = "error"
    elif backend == "auto" and _REAL_MODEL is None:
        status = "degraded"
    return {
        "status": status,
        "model": MODEL_NAME,
        "backend": active_backend(),
        "device": _REAL_DEVICE or _resolve_device(),
        "error": _REMOTE_ERROR if backend in {"openai_compatible", "remote"} else _REAL_MODEL_ERROR,
    }


@app.get("/models")
def models() -> dict[str, Any]:
    return {
        "models": [
            {
                "name": MODEL_NAME,
                "version": active_model_version(),
                "dimension": DIMENSION,
                "dense": True,
                "sparse": True,
                "rerank": True,
                "backend": active_backend(),
                "device": _REAL_DEVICE or _resolve_device(),
            }
        ]
    }


@app.post("/embed/dense")
def embed_dense(request: EmbedRequest) -> dict[str, Any]:
    start = time.perf_counter()
    items = hybrid_vectors(request.texts, request.normalize)
    elapsed_ms = int((time.perf_counter() - start) * 1000)
    return {
        "items": [
            {"dense_vector": item["dense_vector"], **response_meta(text, elapsed_ms)}
            for text, item in zip(request.texts, items)
        ]
    }


@app.post("/embed/sparse")
def embed_sparse(request: EmbedRequest) -> dict[str, Any]:
    start = time.perf_counter()
    items = hybrid_vectors(request.texts, request.normalize)
    elapsed_ms = int((time.perf_counter() - start) * 1000)
    return {
        "items": [
            {"sparse_vector": item["sparse_vector"], **response_meta(text, elapsed_ms)}
            for text, item in zip(request.texts, items)
        ]
    }


@app.post("/embed/hybrid")
def embed_hybrid(request: EmbedRequest) -> dict[str, Any]:
    start = time.perf_counter()
    items = hybrid_vectors(request.texts, request.normalize)
    elapsed_ms = int((time.perf_counter() - start) * 1000)
    return {
        "items": [
            {**item, **response_meta(text, elapsed_ms)}
            for text, item in zip(request.texts, items)
        ]
    }


@app.post("/rerank")
def rerank(request: RerankRequest) -> dict[str, Any]:
    try:
        vectors = (
            _remote_hybrid_vectors([request.query, *request.documents], normalize=True)
            if _embedding_backend() in {"openai_compatible", "remote"}
            else _real_hybrid_vectors([request.query, *request.documents], normalize=True)
        )
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "embedding_model_unavailable", "backend": _embedding_backend(), "error": str(exc)[:300]},
        ) from exc
    scored = []
    if vectors:
        query_vector = vectors[0]["dense_vector"]
        for index, (document, vector) in enumerate(zip(request.documents, vectors[1:])):
            score = sum(left * right for left, right in zip(query_vector, vector["dense_vector"]))
            scored.append({"index": index, "score": round(float(score), 6), "document": document})
        model = os.environ.get("EMBEDDING_MODEL", MODEL_NAME)
        backend = "dense_similarity"
    else:
        query_terms = set(sparse_vector(request.query))
        for index, document in enumerate(request.documents):
            document_terms = set(sparse_vector(document))
            score = len(query_terms & document_terms) / max(1, len(query_terms | document_terms))
            scored.append({"index": index, "score": round(score, 6), "document": document})
        model = "token-overlap-deterministic"
        backend = active_backend()
    return {"model": model, "backend": backend, "items": sorted(scored, key=lambda item: item["score"], reverse=True)[: request.top_k]}
