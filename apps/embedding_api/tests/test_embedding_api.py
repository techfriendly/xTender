from __future__ import annotations

import os

import httpx
from fastapi.testclient import TestClient

os.environ.setdefault("EMBEDDING_BACKEND", "deterministic")

from embedding_api import main
from embedding_api.main import DIMENSION, app


client = TestClient(app, backend_options={"use_uvloop": True})


def test_hybrid_embedding_contract() -> None:
    response = client.post("/embed/hybrid", json={"texts": ["contrato de atencion ciudadana con IA"]})

    assert response.status_code == 200
    item = response.json()["items"][0]
    assert item["model"] == "BAAI/bge-m3"
    assert item["dimension"] == DIMENSION
    assert len(item["dense_vector"]) == DIMENSION
    assert "contrato" in item["sparse_vector"]
    assert item["text_hash"]
    assert item["backend"] == "deterministic"


def test_rerank_orders_by_token_overlap() -> None:
    response = client.post(
        "/rerank",
        json={
            "query": "solvencia proporcional contrato",
            "documents": [
                "plazo de ejecucion y entregables",
                "solvencia vinculada al objeto del contrato y proporcional",
            ],
        },
    )

    assert response.status_code == 200
    assert response.json()["items"][0]["index"] == 1
    assert response.json()["backend"] == "deterministic"


def test_real_backend_reports_unavailable_model_without_fake_success(monkeypatch) -> None:
    monkeypatch.setenv("EMBEDDING_BACKEND", "real")
    monkeypatch.setattr(main, "_REAL_MODEL", None)
    monkeypatch.setattr(main, "_REAL_MODEL_ERROR", "modelo no instalado")
    monkeypatch.setattr(main, "_load_real_model", lambda: (_ for _ in ()).throw(RuntimeError("modelo no instalado")))

    health = client.get("/health")
    embedding = client.post("/embed/hybrid", json={"texts": ["texto"]})

    assert health.status_code == 200
    assert health.json()["status"] == "error"
    assert health.json()["backend"] == "unavailable"
    assert embedding.status_code == 503
    assert embedding.json()["detail"]["code"] == "embedding_model_unavailable"


def test_openai_compatible_backend_uses_remote_bge_m3(monkeypatch) -> None:
    vector = [0.0] * DIMENSION
    vector[0] = 2.0

    def remote_post(url: str, **kwargs):
        assert url == "http://embeddings.test/v1/embeddings"
        assert kwargs["json"]["model"] == "bge-m3"
        return httpx.Response(
            200,
            json={"data": [{"index": 0, "embedding": vector}]},
            request=httpx.Request("POST", url),
        )

    monkeypatch.setenv("EMBEDDING_BACKEND", "openai_compatible")
    monkeypatch.setenv("EMBEDDING_OPENAI_BASE_URL", "http://embeddings.test/v1")
    monkeypatch.setenv("EMBEDDING_OPENAI_MODEL", "bge-m3")
    monkeypatch.setattr(main.httpx, "post", remote_post)
    monkeypatch.setattr(main, "_REMOTE_ERROR", None)

    response = client.post("/embed/hybrid", json={"texts": ["contratación pública"]})

    assert response.status_code == 200
    item = response.json()["items"][0]
    assert item["backend"] == "openai_compatible"
    assert item["model_version"] == "openai-compatible:bge-m3"
    assert item["dense_vector"][0] == 1.0
    assert "contratación" in item["sparse_vector"]
