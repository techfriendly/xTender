from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient


pytestmark = pytest.mark.skipif(
    os.environ.get("PROCUREAI_RUN_POSTGRES_TESTS") != "1",
    reason="requiere el PostgreSQL local y se ejecuta explícitamente",
)

from procureai_api import kb, runtime
from procureai_api.main import app


HEADERS = {
    "X-User-Id": "xtender-e2e-user",
    "X-Tenant-Id": "tenant-xtender-e2e",
    "X-Roles": "responsable_contratacion",
}


def test_postgres_persists_complete_document_workspace_across_clients() -> None:
    runtime._DB_READY = None
    assert runtime._db_available() is True

    with TestClient(app, backend_options={"use_uvloop": True}) as first_client:
        listed = first_client.get("/workspaces?include_archived=true", headers=HEADERS)
        existing = next((item for item in listed.json()["items"] if item.get("file_number") == "E2E-PERSIST-001"), None)
        if existing:
            workspace_id = existing["id"]
        else:
            created = first_client.post(
                "/workspaces",
                headers=HEADERS,
                json={
                    "file_number": "E2E-PERSIST-001",
                    "title": "Verificación persistente de los cuatro documentos",
                    "contracting_body": "Entidad de prueba xTender",
                    "promoting_unit": "Unidad E2E",
                    "object": "Servicio de verificación de persistencia documental",
                    "need": "Comprobar la recuperación real después de reabrir el expediente",
                    "contract_type": "Servicios",
                    "procedure": "Abierto",
                    "cpv_codes": ["72200000-7"],
                    "budget": 10000,
                    "estimated_value": 12000,
                    "duration": "12 meses",
                    "lots": "Sin lotes",
                    "target_document": "informe_necesidad",
                },
            )
            assert created.status_code == 200
            workspace_id = created.json()["workspace"]["id"]

        for document_type in ["informe_necesidad", "ppt", "pcap", "informe_juridico"]:
            workspace = first_client.get(f"/workspaces/{workspace_id}", headers=HEADERS).json()["workspace"]
            if document_type not in (workspace.get("document_indexes") or {}):
                proposed = first_client.post(
                    "/draft-index",
                    headers=HEADERS,
                    json={"workspace_id": workspace_id, "document_type": document_type, "language": "es"},
                )
                assert proposed.status_code == 200

        saved = first_client.patch(
            "/chapters/informe-necesidad-medios",
            headers=HEADERS,
            json={
                "workspace_id": workspace_id,
                "content": "# Necesidad\n\nContenido humano persistido en PostgreSQL.",
                "summary": "Prueba de persistencia real",
            },
        )
        assert saved.status_code == 200
        saved_version_id = saved.json()["version"]["version_id"]

    runtime._DB_READY = None
    with TestClient(app, backend_options={"use_uvloop": True}) as reopened_client:
        reopened = reopened_client.get(f"/workspaces/{workspace_id}", headers=HEADERS)
        chapters = reopened_client.get(
            f"/workspaces/{workspace_id}/chapters?document_type=informe_necesidad",
            headers=HEADERS,
        )
        overview = reopened_client.get(f"/workspaces/{workspace_id}/documents", headers=HEADERS)

    assert reopened.status_code == 200
    assert set(reopened.json()["workspace"]["document_indexes"]) == {"informe_necesidad", "ppt", "pcap", "informe_juridico"}
    persisted = next(item for item in chapters.json()["chapters"] if item["chapter_id"] == "informe-necesidad-medios")
    assert persisted["version_id"] == saved_version_id
    assert "Contenido humano persistido" in persisted["content"]
    assert all(item["exists"] for item in overview.json()["items"])


def test_postgres_has_advanced_preparation_and_collaboration_schema() -> None:
    runtime._DB_READY = None
    assert runtime._db_available() is True
    expected_tables = {
        "annual_procurement_plan_items",
        "market_studies",
        "procurement_risks",
        "procurement_schedules",
        "economic_calculations",
        "legal_knowledge_sources",
        "ai_output_reviews",
        "ai_literacy_completions",
        "compliance_profiles",
        "knowledge_sync_runs",
        "saved_searches",
        "workspace_tasks",
        "document_comments",
        "clause_catalog_entries",
        "clause_catalog_versions",
        "user_notifications",
        "print_profiles",
    }
    rows = kb.db_fetch_all(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY(%s)",
        (list(expected_tables),),
    )
    assert {row["tablename"] for row in rows} == expected_tables

    columns = kb.db_fetch_all(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workspace_documents'",
    )
    assert {"visibility", "owner_user_id", "custom_status"}.issubset({row["column_name"] for row in columns})
