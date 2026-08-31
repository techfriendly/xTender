from __future__ import annotations

import csv
import hashlib
import io
import json
import re
import statistics
import unicodedata
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any
from urllib.parse import urlparse

from psycopg2.extras import Json

from . import kb, runtime
from .document_specs import DOCUMENT_SPECS
from .models import (
    AdvancedValidationRequest,
    AiOutputReviewRequest,
    AnnualPlanItemRequest,
    ComplianceProfileRequest,
    EconomicCalculationRequest,
    LegalKnowledgeSourceRequest,
    LiteracyCompletionRequest,
    MarketStudyRequest,
    ProcurementRiskRequest,
    ProcurementScheduleRequest,
    UserContext,
    WorkspaceUpdate,
)
from .services import trace_id


CATEGORY1_SERVICES: tuple[dict[str, Any], ...] = (
    {"id": "annual_plan", "group": "planificacion", "name": "Plan anual de contratación", "module": "planning"},
    {"id": "needs", "group": "planificacion", "name": "Identificación de necesidades", "module": "guided_documents"},
    {"id": "market_study", "group": "planificacion", "name": "Estudios de mercado", "module": "market"},
    {"id": "solution_scenarios", "group": "planificacion", "name": "Escenarios de solución y operadores", "module": "market"},
    {"id": "risk_analysis", "group": "planificacion", "name": "Análisis de riesgos", "module": "risk"},
    {"id": "schedule", "group": "planificacion", "name": "Plazos y alertas de tramitación", "module": "schedule"},
    {"id": "tender_explorer", "group": "redaccion", "name": "Explorador de licitaciones", "module": "pcsp"},
    {"id": "law_explorer", "group": "redaccion", "name": "Explorador de normativa", "module": "legal_sources", "source_kind": "normativa"},
    {"id": "doctrine_explorer", "group": "redaccion", "name": "Explorador de doctrina contractual", "module": "legal_sources", "source_kind": "doctrina"},
    {"id": "case_law_explorer", "group": "redaccion", "name": "Explorador de jurisprudencia", "module": "legal_sources", "source_kind": "jurisprudencia"},
    {"id": "cpv", "group": "redaccion", "name": "Asistencia CPV", "module": "cpv"},
    {"id": "economics", "group": "redaccion", "name": "Cálculo de PBL y valor estimado", "module": "economics"},
    {"id": "pcap", "group": "redaccion", "name": "Redacción de PCAP", "module": "guided_documents"},
    {"id": "ppt", "group": "redaccion", "name": "Redacción de PPT", "module": "guided_documents"},
    {"id": "need_report", "group": "redaccion", "name": "Informe de necesidad", "module": "guided_documents"},
    {"id": "legal_report", "group": "redaccion", "name": "Informe jurídico de aprobación", "module": "legal_report"},
    {"id": "document_coherence", "group": "validacion", "name": "Redundancias, ambigüedades y contradicciones", "module": "advanced_validation"},
    {"id": "normative_consistency", "group": "validacion", "name": "Consistencia normativa trazable", "module": "advanced_validation"},
    {"id": "restrictive_requirements", "group": "validacion", "name": "Exigencias ambiguas o restrictivas", "module": "advanced_validation"},
)


LITERACY_MODULES: tuple[dict[str, Any], ...] = (
    {
        "id": "ai-basics-hitl",
        "version": "1.0",
        "minutes": 20,
        "title_es": "IA asistiva y supervisión humana",
        "title_ca": "IA assistiva i supervisió humana",
        "objectives": ["Distinguir propuesta y decisión", "Validar antes de aprobar", "Saber detener una generación incorrecta"],
    },
    {
        "id": "sources-traceability",
        "version": "1.0",
        "minutes": 25,
        "title_es": "Fuentes, citas y límites del resultado",
        "title_ca": "Fonts, citacions i límits del resultat",
        "objectives": ["Comprobar una cita", "Diferenciar fuente oficial y precedente", "Evitar trasladar errores de otros pliegos"],
    },
    {
        "id": "data-security",
        "version": "1.0",
        "minutes": 25,
        "title_es": "Datos, secretos y uso seguro",
        "title_ca": "Dades, secrets i ús segur",
        "objectives": ["Minimizar datos", "Clasificar información", "Reconocer documentos que no deben cargarse"],
    },
    {
        "id": "public-procurement-review",
        "version": "1.0",
        "minutes": 30,
        "title_es": "Revisión responsable en contratación pública",
        "title_ca": "Revisió responsable en contractació pública",
        "objectives": ["Revisar proporcionalidad", "Interpretar alertas", "Documentar la decisión humana"],
    },
)


DEFAULT_COMPLIANCE_PROFILE: dict[str, Any] = {
    "solution_scope": "Preparación y revisión asistida de contratos públicos",
    "ai_system_classification": "pendiente_declaracion_anexo_iii",
    "human_oversight": "implementado",
    "ai_disclosure": "implementado",
    "generated_content_provenance": "implementado",
    "feedback_channel": "implementado",
    "ens_level": "pendiente_evidencia_nivel_bajo",
    "eu_hosting": {
        "application": "pendiente_evidencia",
        "database": "pendiente_evidencia",
        "object_storage": "pendiente_evidencia",
        "llm": "pendiente_evidencia",
        "embeddings": "pendiente_evidencia",
    },
    "data_reuse_for_training": "prohibido_por_configuracion_pendiente_evidencia_contractual",
    "retention_days": None,
    "data_processing_agreement": "pendiente",
    "professional_secrets": "pendiente_evidencia",
    "data_act": "pendiente_evaluacion",
    "exit_plan": "implementado_exportacion_abierta",
    "limitations": [
        "Los resultados requieren revisión humana explícita.",
        "La cobertura normativa depende de corpus oficiales actualizados y de su fecha de vigencia.",
        "xTender no sustituye el informe ni el criterio jurídico del órgano competente.",
    ],
}


DEFAULT_SCHEDULE_PHASES: tuple[dict[str, Any], ...] = (
    {"id": "definicion", "name": "Definición de necesidad y alcance", "duration_days": 10, "owner": "unidad promotora"},
    {"id": "mercado", "name": "Estudio de mercado y cálculos", "duration_days": 10, "owner": "unidad promotora"},
    {"id": "pliegos", "name": "Redacción coordinada de documentos", "duration_days": 15, "owner": "equipo del expediente"},
    {"id": "revision", "name": "Revisión técnica, económica y jurídica", "duration_days": 10, "owner": "órganos revisores"},
    {"id": "aprobacion", "name": "Aprobación del expediente", "duration_days": 7, "owner": "órgano competente"},
    {"id": "licitacion", "name": "Publicación y presentación de ofertas", "duration_days": 30, "owner": "contratación"},
    {"id": "evaluacion", "name": "Evaluación y propuesta de adjudicación", "duration_days": 20, "owner": "mesa"},
    {"id": "formalizacion", "name": "Adjudicación y formalización", "duration_days": 20, "owner": "órgano de contratación"},
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_safe(item) for item in value]
    return value


def _workspace(user: UserContext, workspace_id: str) -> dict[str, Any]:
    workspace = runtime.get_workspace(user, workspace_id)
    if not workspace:
        raise KeyError(workspace_id)
    return workspace


def _date(value: str | None, *, field: str) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(f"invalid_date:{field}") from exc


def _money(value: Any) -> Decimal:
    try:
        result = Decimal(str(value or 0))
    except Exception as exc:
        raise ValueError("invalid_money_value") from exc
    if result < 0:
        raise ValueError("negative_money_value")
    return result.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _public_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [_safe(dict(row)) for row in rows]


def category1_capabilities(user: UserContext) -> dict[str, Any]:
    legal_counts = legal_source_counts(user)
    kb_summary = kb.summary()
    items: list[dict[str, Any]] = []
    for service in CATEGORY1_SERVICES:
        item = dict(service)
        item.update({"label": service["name"], "human_validation": True, "status": "operativo", "evidence": []})
        if service.get("source_kind"):
            count = legal_counts.get(str(service["source_kind"]), 0)
            item["corpus_items"] = count
            if count == 0:
                item["status"] = "operativo_sin_corpus"
                item["limitation"] = "El explorador funciona, pero no puede validar materialmente sin cargar fuentes oficiales."
        if service["id"] == "tender_explorer":
            item["corpus_items"] = int(kb_summary.get("documents") or 0)
            item["backend"] = kb_summary.get("backend")
        if service["id"] == "legal_report" and "informe_juridico" not in DOCUMENT_SPECS:
            item["status"] = "pendiente"
        items.append(item)
    return {
        "trace_id": trace_id("cat1"),
        "category": 1,
        "items": items,
        "summary": {
            "operational": sum(1 for item in items if item["status"] == "operativo"),
            "without_corpus": sum(1 for item in items if item["status"] == "operativo_sin_corpus"),
            "pending": sum(1 for item in items if item["status"] == "pendiente"),
        },
    }


def list_annual_plan(user: UserContext, plan_year: int, *, include_archived: bool = False) -> dict[str, Any]:
    if runtime._db_available():
        archived_filter = "" if include_archived else "AND archived_at IS NULL"
        rows = kb.db_fetch_all(
            f"""
            SELECT * FROM annual_procurement_plan_items
            WHERE tenant_id = %s AND plan_year = %s {archived_filter}
            ORDER BY planned_publication_date NULLS LAST, planned_quarter NULLS LAST, title
            """,
            (user.tenant_id, plan_year),
        )
    else:
        rows = [
            item for item in runtime._MEMORY["annual_plan_items"].values()
            if item["tenant_id"] == user.tenant_id and item["plan_year"] == plan_year and (include_archived or not item.get("archived_at"))
        ]
        rows.sort(key=lambda item: (item.get("planned_publication_date") or "9999-12-31", item.get("planned_quarter") or 9, item["title"]))
    items = _public_rows(rows)
    return {
        "trace_id": trace_id("plan"),
        "plan_year": plan_year,
        "items": items,
        "summary": {
            "count": len(items),
            "estimated_value": round(sum(float(item.get("estimated_value") or 0) for item in items), 2),
            "high_risk": sum(1 for item in items if item.get("risk_level") in {"alto", "critico"}),
        },
    }


def save_annual_plan_item(user: UserContext, request: AnnualPlanItemRequest, item_id: str | None = None) -> dict[str, Any]:
    runtime._ensure_identity(user)
    if request.workspace_id:
        _workspace(user, request.workspace_id)
    publication_date = _date(request.planned_publication_date, field="planned_publication_date")
    item_id = item_id or f"plan-{uuid.uuid4().hex[:12]}"
    existing = None
    if item_id:
        if runtime._db_available():
            existing = kb.db_fetch_one("SELECT * FROM annual_procurement_plan_items WHERE id = %s AND tenant_id = %s", (item_id, user.tenant_id))
        else:
            candidate = runtime._MEMORY["annual_plan_items"].get(item_id)
            existing = candidate if candidate and candidate["tenant_id"] == user.tenant_id else None
    risk_level = _workspace_risk_level(user, request.workspace_id) if request.workspace_id else "sin_evaluar"
    item = {
        "id": item_id,
        "tenant_id": user.tenant_id,
        **request.model_dump(),
        "planned_publication_date": publication_date.isoformat() if publication_date else None,
        "risk_level": risk_level,
        "created_by": (existing or {}).get("created_by") or user.user_id,
        "created_at": _safe((existing or {}).get("created_at")) or _now(),
        "updated_at": _now(),
        "archived_at": None,
    }
    if runtime._db_available():
        with kb.db_connection() as connection, connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO annual_procurement_plan_items(
                  id, tenant_id, workspace_id, plan_year, title, need, contracting_body,
                  promoting_unit, cpv_codes, contract_type, procedure, estimated_value,
                  planned_quarter, planned_publication_date, owner, status, risk_level,
                  notes, created_by
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                  workspace_id = EXCLUDED.workspace_id, plan_year = EXCLUDED.plan_year,
                  title = EXCLUDED.title, need = EXCLUDED.need,
                  contracting_body = EXCLUDED.contracting_body, promoting_unit = EXCLUDED.promoting_unit,
                  cpv_codes = EXCLUDED.cpv_codes, contract_type = EXCLUDED.contract_type,
                  procedure = EXCLUDED.procedure, estimated_value = EXCLUDED.estimated_value,
                  planned_quarter = EXCLUDED.planned_quarter,
                  planned_publication_date = EXCLUDED.planned_publication_date,
                  owner = EXCLUDED.owner, status = EXCLUDED.status, risk_level = EXCLUDED.risk_level,
                  notes = EXCLUDED.notes, archived_at = NULL, updated_at = now()
                WHERE annual_procurement_plan_items.tenant_id = EXCLUDED.tenant_id
                """,
                (
                    item_id, user.tenant_id, request.workspace_id, request.plan_year, request.title,
                    request.need, request.contracting_body, request.promoting_unit, Json(request.cpv_codes),
                    request.contract_type, request.procedure, request.estimated_value,
                    request.planned_quarter, publication_date, request.owner, request.status,
                    risk_level, request.notes, user.user_id,
                ),
            )
            if cursor.rowcount != 1:
                raise KeyError(item_id)
            connection.commit()
    else:
        runtime._MEMORY["annual_plan_items"][item_id] = item
    runtime._audit(user, "preparation.plan_item_saved", request.workspace_id, {"item_id": item_id, "year": request.plan_year})
    return {"trace_id": trace_id("plan"), "item": item}


def archive_annual_plan_item(user: UserContext, item_id: str) -> dict[str, Any]:
    if runtime._db_available():
        with kb.db_connection() as connection, connection.cursor() as cursor:
            cursor.execute(
                "UPDATE annual_procurement_plan_items SET status = 'archivado', archived_at = now(), updated_at = now() WHERE id = %s AND tenant_id = %s RETURNING workspace_id",
                (item_id, user.tenant_id),
            )
            row = cursor.fetchone()
            connection.commit()
        if not row:
            raise KeyError(item_id)
        workspace_id = row.get("workspace_id")
    else:
        item = runtime._MEMORY["annual_plan_items"].get(item_id)
        if not item or item["tenant_id"] != user.tenant_id:
            raise KeyError(item_id)
        item.update({"status": "archivado", "archived_at": _now(), "updated_at": _now()})
        workspace_id = item.get("workspace_id")
    runtime._audit(user, "preparation.plan_item_archived", workspace_id, {"item_id": item_id})
    return {"trace_id": trace_id("plan"), "item_id": item_id, "status": "archivado"}


def annual_plan_csv(user: UserContext, plan_year: int) -> tuple[str, bytes]:
    items = list_annual_plan(user, plan_year)["items"]
    stream = io.StringIO(newline="")
    fields = ["id", "plan_year", "title", "need", "contracting_body", "promoting_unit", "cpv_codes", "contract_type", "procedure", "estimated_value", "planned_quarter", "planned_publication_date", "owner", "status", "risk_level", "notes"]
    writer = csv.DictWriter(stream, fieldnames=fields)
    writer.writeheader()
    for item in items:
        row = {field: item.get(field) for field in fields}
        row["cpv_codes"] = ";".join(item.get("cpv_codes") or [])
        writer.writerow(row)
    runtime._audit(user, "preparation.annual_plan_exported", None, {"year": plan_year, "items": len(items)})
    return f"plan-contratacion-{plan_year}.csv", stream.getvalue().encode("utf-8-sig")


def _risk_level(score: int) -> str:
    if score <= 4:
        return "bajo"
    if score <= 9:
        return "medio"
    if score <= 16:
        return "alto"
    return "critico"


def _workspace_risk_level(user: UserContext, workspace_id: str | None) -> str:
    if not workspace_id:
        return "sin_evaluar"
    items = list_risks(user, workspace_id)["items"]
    active = [item for item in items if item["status"] not in {"cerrado"}]
    return max(active, key=lambda item: item["score"])["level"] if active else "sin_evaluar"


def save_risk(user: UserContext, request: ProcurementRiskRequest, risk_id: str | None = None) -> dict[str, Any]:
    _workspace(user, request.workspace_id)
    runtime._ensure_identity(user)
    risk_id = risk_id or f"risk-{uuid.uuid4().hex[:12]}"
    score = request.probability * request.impact
    item = {
        "id": risk_id,
        "tenant_id": user.tenant_id,
        **request.model_dump(),
        "score": score,
        "level": _risk_level(score),
        "created_by": user.user_id,
        "created_at": _now(),
        "updated_at": _now(),
    }
    if runtime._db_available():
        with kb.db_connection() as connection, connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO procurement_risks(
                  id, tenant_id, workspace_id, category, description, probability, impact,
                  score, level, mitigation, contingency, owner, status, source_refs, created_by
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                  category = EXCLUDED.category, description = EXCLUDED.description,
                  probability = EXCLUDED.probability, impact = EXCLUDED.impact,
                  score = EXCLUDED.score, level = EXCLUDED.level, mitigation = EXCLUDED.mitigation,
                  contingency = EXCLUDED.contingency, owner = EXCLUDED.owner,
                  status = EXCLUDED.status, source_refs = EXCLUDED.source_refs, updated_at = now()
                WHERE procurement_risks.tenant_id = EXCLUDED.tenant_id
                  AND procurement_risks.workspace_id = EXCLUDED.workspace_id
                """,
                (
                    risk_id, user.tenant_id, request.workspace_id, request.category, request.description,
                    request.probability, request.impact, score, item["level"], request.mitigation,
                    request.contingency, request.owner, request.status, Json(request.source_refs), user.user_id,
                ),
            )
            if cursor.rowcount != 1:
                raise KeyError(risk_id)
            connection.commit()
    else:
        previous = runtime._MEMORY["procurement_risks"].get(risk_id)
        if previous and (previous["tenant_id"] != user.tenant_id or previous["workspace_id"] != request.workspace_id):
            raise KeyError(risk_id)
        if previous:
            item["created_at"] = previous["created_at"]
            item["created_by"] = previous["created_by"]
        runtime._MEMORY["procurement_risks"][risk_id] = item
    runtime._audit(user, "preparation.risk_saved", request.workspace_id, {"risk_id": risk_id, "score": score, "level": item["level"]})
    return {"trace_id": trace_id("risk"), "risk": item}


def list_risks(user: UserContext, workspace_id: str) -> dict[str, Any]:
    _workspace(user, workspace_id)
    if runtime._db_available():
        rows = kb.db_fetch_all(
            "SELECT * FROM procurement_risks WHERE tenant_id = %s AND workspace_id = %s ORDER BY score DESC, created_at DESC",
            (user.tenant_id, workspace_id),
        )
    else:
        rows = [item for item in runtime._MEMORY["procurement_risks"].values() if item["tenant_id"] == user.tenant_id and item["workspace_id"] == workspace_id]
        rows.sort(key=lambda item: (-item["score"], item["created_at"]))
    items = _public_rows(rows)
    return {
        "trace_id": trace_id("risk"),
        "workspace_id": workspace_id,
        "items": items,
        "summary": {level: sum(1 for item in items if item["level"] == level and item["status"] != "cerrado") for level in ["bajo", "medio", "alto", "critico"]},
    }


def calculate_schedule(user: UserContext, request: ProcurementScheduleRequest) -> dict[str, Any]:
    workspace = _workspace(user, request.workspace_id)
    runtime._ensure_identity(user)
    start = _date(request.start_date, field="start_date")
    assert start is not None
    raw_phases = request.phases or [dict(item) for item in DEFAULT_SCHEDULE_PHASES]
    phases: list[dict[str, Any]] = []
    cursor = start
    today = date.today()
    for position, raw in enumerate(raw_phases, start=1):
        name = str(raw.get("name") or "").strip()
        try:
            duration = int(raw.get("duration_days") or 0)
        except (TypeError, ValueError) as exc:
            raise ValueError("invalid_phase_duration") from exc
        if not name or duration < 1 or duration > 3650:
            raise ValueError("invalid_schedule_phase")
        phase_start = cursor
        phase_end = phase_start + timedelta(days=duration - 1)
        if phase_end < today:
            alert_status = "vencida"
        elif phase_end <= today + timedelta(days=7):
            alert_status = "proxima"
        else:
            alert_status = "planificada"
        phases.append(
            {
                "id": str(raw.get("id") or f"phase-{position}"),
                "order": position,
                "name": name,
                "duration_days": duration,
                "start_date": phase_start.isoformat(),
                "end_date": phase_end.isoformat(),
                "owner": str(raw.get("owner") or "equipo del expediente"),
                "status": str(raw.get("status") or "pendiente"),
                "alert_status": alert_status,
                "legal_minimum": False,
            }
        )
        cursor = phase_end + timedelta(days=1)
    alerts = [
        {"phase_id": item["id"], "name": item["name"], "due_date": item["end_date"], "severity": "error" if item["alert_status"] == "vencida" else "advertencia"}
        for item in phases if item["alert_status"] in {"vencida", "proxima"} and item["status"] != "completada"
    ]
    assumptions = list(request.assumptions)
    assumptions.append("Las duraciones son una planificación editable, no un cálculo automático de plazos legales mínimos.")
    assumptions.append("Se emplean días naturales salvo que el usuario configure fases específicas conforme al procedimiento aplicable.")
    schedule_id = f"schedule-{uuid.uuid4().hex[:12]}"
    record = {
        "id": schedule_id,
        "tenant_id": user.tenant_id,
        "workspace_id": request.workspace_id,
        "procedure": request.procedure or workspace.get("procedure"),
        "start_date": start.isoformat(),
        "target_date": phases[-1]["end_date"],
        "phases": phases,
        "alerts": alerts,
        "assumptions": assumptions,
        "status": request.status,
        "created_by": user.user_id,
        "validated_by": user.user_id if request.status == "validado" else None,
        "validated_at": _now() if request.status == "validado" else None,
        "created_at": _now(),
    }
    if runtime._db_available():
        with kb.db_connection() as connection, connection.cursor() as db_cursor:
            db_cursor.execute(
                """
                INSERT INTO procurement_schedules(
                  id, tenant_id, workspace_id, procedure, start_date, target_date,
                  phases, alerts, assumptions, status, created_by, validated_by, validated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    schedule_id, user.tenant_id, request.workspace_id, record["procedure"], start,
                    _date(record["target_date"], field="target_date"), Json(phases), Json(alerts),
                    Json(assumptions), request.status, user.user_id, record["validated_by"],
                    datetime.now(timezone.utc) if request.status == "validado" else None,
                ),
            )
            connection.commit()
    else:
        runtime._MEMORY["procurement_schedules"][schedule_id] = record
    runtime._audit(user, "preparation.schedule_calculated", request.workspace_id, {"schedule_id": schedule_id, "target_date": record["target_date"], "phases": len(phases)})
    return {"trace_id": trace_id("time"), "schedule": record}


def list_schedules(user: UserContext, workspace_id: str) -> dict[str, Any]:
    _workspace(user, workspace_id)
    if runtime._db_available():
        rows = kb.db_fetch_all(
            "SELECT * FROM procurement_schedules WHERE tenant_id = %s AND workspace_id = %s ORDER BY created_at DESC",
            (user.tenant_id, workspace_id),
        )
    else:
        rows = [item for item in runtime._MEMORY["procurement_schedules"].values() if item["tenant_id"] == user.tenant_id and item["workspace_id"] == workspace_id]
        rows.sort(key=lambda item: item["created_at"], reverse=True)
    return {"trace_id": trace_id("time"), "workspace_id": workspace_id, "items": _public_rows(rows)}


def calculate_economics(user: UserContext, request: EconomicCalculationRequest) -> dict[str, Any]:
    _workspace(user, request.workspace_id)
    runtime._ensure_identity(user)
    line_items: list[dict[str, Any]] = []
    subtotal = Decimal("0.00")
    for position, raw in enumerate(request.line_items, start=1):
        description = str(raw.get("description") or "").strip()
        if not description:
            raise ValueError("line_item_description_required")
        quantity = _money(raw.get("quantity", 1))
        unit_price = _money(raw.get("unit_price", 0))
        periods = _money(raw.get("periods", 1))
        total = (quantity * unit_price * periods).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        subtotal += total
        line_items.append(
            {
                "id": str(raw.get("id") or f"line-{position}"),
                "description": description[:500],
                "quantity": float(quantity),
                "unit": str(raw.get("unit") or "unidad")[:80],
                "unit_price": float(unit_price),
                "periods": float(periods),
                "total": float(total),
                "source": str(raw.get("source") or "entrada_usuario")[:500],
            }
        )
    base_without_tax = (subtotal + _money(request.other_costs) + _money(request.contingency)).quantize(Decimal("0.01"))
    tax_rate = Decimal(str(request.tax_rate))
    tax_amount = (base_without_tax * tax_rate / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    base_with_tax = base_without_tax + tax_amount
    modifications_amount = (base_without_tax * Decimal(str(request.modification_percent)) / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    estimated_value = base_without_tax + _money(request.extensions_amount) + _money(request.options_amount) + modifications_amount
    if estimated_value < base_without_tax:
        raise ValueError("estimated_value_below_base")
    if runtime._db_available():
        row = kb.db_fetch_one("SELECT COALESCE(max(version), 0) + 1 AS version FROM economic_calculations WHERE tenant_id = %s AND workspace_id = %s", (user.tenant_id, request.workspace_id))
        version = int((row or {}).get("version") or 1)
    else:
        version = 1 + max([item["version"] for item in runtime._MEMORY["economic_calculations"].values() if item["tenant_id"] == user.tenant_id and item["workspace_id"] == request.workspace_id] or [0])
    calculation_id = f"econ-{uuid.uuid4().hex[:12]}"
    record = {
        "id": calculation_id,
        "tenant_id": user.tenant_id,
        "workspace_id": request.workspace_id,
        "version": version,
        "currency": request.currency.upper(),
        "line_items": line_items,
        "other_costs": float(_money(request.other_costs)),
        "contingency": float(_money(request.contingency)),
        "tax_rate": float(tax_rate),
        "base_without_tax": float(base_without_tax),
        "tax_amount": float(tax_amount),
        "base_with_tax": float(base_with_tax),
        "extensions_amount": float(_money(request.extensions_amount)),
        "options_amount": float(_money(request.options_amount)),
        "modifications_amount": float(modifications_amount),
        "estimated_value": float(estimated_value),
        "assumptions": request.assumptions,
        "status": request.status,
        "created_by": user.user_id,
        "validated_by": user.user_id if request.status == "validado" else None,
        "validated_at": _now() if request.status == "validado" else None,
        "applied_at": None,
        "created_at": _now(),
    }
    if runtime._db_available():
        with kb.db_connection() as connection, connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO economic_calculations(
                  id, tenant_id, workspace_id, version, currency, line_items, other_costs,
                  contingency, tax_rate, base_without_tax, tax_amount, base_with_tax,
                  extensions_amount, options_amount, modifications_amount, estimated_value,
                  assumptions, status, created_by, validated_by, validated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    calculation_id, user.tenant_id, request.workspace_id, version, record["currency"],
                    Json(line_items), record["other_costs"], record["contingency"], record["tax_rate"],
                    record["base_without_tax"], record["tax_amount"], record["base_with_tax"],
                    record["extensions_amount"], record["options_amount"], record["modifications_amount"],
                    record["estimated_value"], Json(record["assumptions"]), record["status"], user.user_id,
                    record["validated_by"], datetime.now(timezone.utc) if record["validated_by"] else None,
                ),
            )
            connection.commit()
    else:
        runtime._MEMORY["economic_calculations"][calculation_id] = record
    runtime._audit(user, "preparation.economic_calculation_created", request.workspace_id, {"calculation_id": calculation_id, "version": version, "base_without_tax": record["base_without_tax"], "estimated_value": record["estimated_value"]})
    return {"trace_id": trace_id("econ"), "calculation": record}


def list_economic_calculations(user: UserContext, workspace_id: str) -> dict[str, Any]:
    _workspace(user, workspace_id)
    if runtime._db_available():
        rows = kb.db_fetch_all(
            "SELECT * FROM economic_calculations WHERE tenant_id = %s AND workspace_id = %s ORDER BY version DESC",
            (user.tenant_id, workspace_id),
        )
    else:
        rows = [item for item in runtime._MEMORY["economic_calculations"].values() if item["tenant_id"] == user.tenant_id and item["workspace_id"] == workspace_id]
        rows.sort(key=lambda item: item["version"], reverse=True)
    return {"trace_id": trace_id("econ"), "workspace_id": workspace_id, "items": _public_rows(rows)}


def apply_economic_calculation(user: UserContext, workspace_id: str, calculation_id: str) -> dict[str, Any]:
    _workspace(user, workspace_id)
    if runtime._db_available():
        record = kb.db_fetch_one(
            "SELECT * FROM economic_calculations WHERE id = %s AND tenant_id = %s AND workspace_id = %s",
            (calculation_id, user.tenant_id, workspace_id),
        )
    else:
        candidate = runtime._MEMORY["economic_calculations"].get(calculation_id)
        record = candidate if candidate and candidate["tenant_id"] == user.tenant_id and candidate["workspace_id"] == workspace_id else None
    if not record:
        raise KeyError(calculation_id)
    if record.get("status") != "validado":
        raise ValueError("economic_calculation_requires_human_validation")
    response = runtime.update_workspace(
        user,
        workspace_id,
        WorkspaceUpdate(
            budget=float(record["base_without_tax"]),
            estimated_value=float(record["estimated_value"]),
            tax_rate=float(record["tax_rate"]),
            shared_data={"economic_calculation_id": calculation_id, "economic_calculation_version": int(record["version"])},
        ),
    )
    if runtime._db_available():
        with kb.db_connection() as connection, connection.cursor() as cursor:
            cursor.execute("UPDATE economic_calculations SET status = 'aplicado', applied_at = now() WHERE id = %s AND tenant_id = %s", (calculation_id, user.tenant_id))
            connection.commit()
    else:
        runtime._MEMORY["economic_calculations"][calculation_id].update({"status": "aplicado", "applied_at": _now()})
    runtime._audit(user, "preparation.economic_calculation_applied", workspace_id, {"calculation_id": calculation_id})
    return {"trace_id": trace_id("econ"), "calculation_id": calculation_id, "workspace": response["workspace"]}


def _market_statistics(hits: list[dict[str, Any]]) -> dict[str, Any]:
    budgets = [float(hit.get("metadata", {}).get("budget_without_tax")) for hit in hits if hit.get("metadata", {}).get("budget_without_tax") not in {None, ""}]
    bodies = sorted({str(hit.get("metadata", {}).get("contracting_body")) for hit in hits if hit.get("metadata", {}).get("contracting_body")})
    return {
        "references": len(hits),
        "contracting_bodies": bodies,
        "budget_sample_size": len(budgets),
        "budget_min": min(budgets) if budgets else None,
        "budget_median": statistics.median(budgets) if budgets else None,
        "budget_max": max(budgets) if budgets else None,
        "warning": None if budgets else "No hay una muestra económica suficiente; no se ha estimado un precio de mercado.",
    }


def _default_scenarios(workspace: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {"id": "baseline", "title": "Continuidad sin nueva contratación", "description": "Escenario de contraste: documentar efectos, costes y riesgos de mantener la situación actual.", "proposed_by": "regla", "requires_validation": True},
        {"id": "single_scope", "title": "Contratación del alcance completo", "description": f"Contratar de forma unificada el objeto definido: {workspace.get('object') or '[objeto pendiente]' }.", "proposed_by": "regla", "requires_validation": True},
        {"id": "phased_or_lots", "title": "Implantación por fases o lotes", "description": "Separar prestaciones cuando sea técnica y económicamente viable para comparar concurrencia, dependencias y riesgos.", "proposed_by": "regla", "requires_validation": True},
    ]


def create_market_study(user: UserContext, request: MarketStudyRequest) -> dict[str, Any]:
    workspace = _workspace(user, request.workspace_id)
    runtime._ensure_identity(user)
    query = (request.search_query or workspace.get("object") or workspace.get("need") or request.scope).strip()
    cpv_code = (request.cpv_codes or workspace.get("cpv_codes") or [workspace.get("cpv")])[0] if (request.cpv_codes or workspace.get("cpv_codes") or workspace.get("cpv")) else None
    raw_hits = kb.search(query, cpv=cpv_code, top_k=25)
    hits = [hit.model_dump() if hasattr(hit, "model_dump") else dict(hit) for hit in raw_hits]
    if request.reference_ids:
        selected_hits = [hit for hit in hits if hit["document_id"] in request.reference_ids or hit["chunk_id"] in request.reference_ids]
        reference_ids = list(dict.fromkeys(request.reference_ids))
    else:
        selected_hits = hits[:8]
        reference_ids = list(dict.fromkeys(hit["document_id"] for hit in selected_hits))
    statistics_data = _market_statistics(selected_hits)
    operators = list(request.economic_operators)
    detected_operator_names: set[str] = set()
    for hit in selected_hits:
        metadata = hit.get("metadata") or {}
        name = metadata.get("awarded_to") or metadata.get("supplier_name") or metadata.get("awardee")
        if name and str(name) not in detected_operator_names:
            detected_operator_names.add(str(name))
            operators.append({"name": str(name), "source_reference": hit["document_id"], "origin": "adjudicacion_publicada", "validated": False})
    limitations: list[str] = []
    if not selected_hits:
        limitations.append("No se localizaron precedentes suficientes con los filtros actuales.")
    if not operators:
        limitations.append("Los datos recuperados no identifican adjudicatarios; los operadores deben añadirse con una fuente pública verificable.")
    scenarios = request.scenarios or _default_scenarios(workspace)
    if request.status == "validado" and (not reference_ids or len(scenarios) < 2 or not (request.conclusions or "").strip()):
        raise ValueError("market_study_validation_requires_sources_scenarios_and_conclusions")
    if runtime._db_available():
        row = kb.db_fetch_one("SELECT COALESCE(max(version), 0) + 1 AS version FROM market_studies WHERE tenant_id = %s AND workspace_id = %s", (user.tenant_id, request.workspace_id))
        version = int((row or {}).get("version") or 1)
    else:
        version = 1 + max([item["version"] for item in runtime._MEMORY["market_studies"].values() if item["tenant_id"] == user.tenant_id and item["workspace_id"] == request.workspace_id] or [0])
    study_id = f"market-{uuid.uuid4().hex[:12]}"
    record = {
        "id": study_id,
        "tenant_id": user.tenant_id,
        "workspace_id": request.workspace_id,
        "version": version,
        "status": request.status,
        "scope": request.scope,
        "search_query": query,
        "cpv_codes": request.cpv_codes or workspace.get("cpv_codes") or ([workspace.get("cpv")] if workspace.get("cpv") else []),
        "reference_ids": reference_ids,
        "references": [{"document_id": hit["document_id"], "title": hit["title"], "score": hit["score"], "url": hit["source"]["url"]} for hit in selected_hits],
        "statistics": statistics_data,
        "scenarios": scenarios,
        "economic_operators": operators,
        "risks": request.risks,
        "conclusions": request.conclusions,
        "limitations": limitations,
        "created_by": user.user_id,
        "validated_by": user.user_id if request.status == "validado" else None,
        "validated_at": _now() if request.status == "validado" else None,
        "created_at": _now(),
        "updated_at": _now(),
    }
    if runtime._db_available():
        with kb.db_connection() as connection, connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO market_studies(
                  id, tenant_id, workspace_id, version, status, scope, search_query,
                  cpv_codes, reference_ids, statistics, scenarios, economic_operators,
                  risks, conclusions, limitations, created_by, validated_by, validated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    study_id, user.tenant_id, request.workspace_id, version, request.status,
                    request.scope, query, Json(record["cpv_codes"]), Json(reference_ids),
                    Json(statistics_data), Json(scenarios), Json(operators), Json(request.risks),
                    request.conclusions, Json(limitations), user.user_id, record["validated_by"],
                    datetime.now(timezone.utc) if record["validated_by"] else None,
                ),
            )
            connection.commit()
    else:
        runtime._MEMORY["market_studies"][study_id] = record
    runtime._audit(user, "preparation.market_study_created", request.workspace_id, {"study_id": study_id, "version": version, "references": len(reference_ids), "operators": len(operators)})
    return {"trace_id": trace_id("market"), "study": record}


def list_market_studies(user: UserContext, workspace_id: str) -> dict[str, Any]:
    _workspace(user, workspace_id)
    if runtime._db_available():
        rows = kb.db_fetch_all("SELECT * FROM market_studies WHERE tenant_id = %s AND workspace_id = %s ORDER BY version DESC", (user.tenant_id, workspace_id))
    else:
        rows = [item for item in runtime._MEMORY["market_studies"].values() if item["tenant_id"] == user.tenant_id and item["workspace_id"] == workspace_id]
        rows.sort(key=lambda item: item["version"], reverse=True)
    return {"trace_id": trace_id("market"), "workspace_id": workspace_id, "items": _public_rows(rows)}


def save_legal_source(user: UserContext, request: LegalKnowledgeSourceRequest) -> dict[str, Any]:
    runtime._ensure_identity(user)
    parsed = urlparse(request.source_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("invalid_official_source_url")
    source_id = f"legal-{uuid.uuid4().hex[:12]}"
    digest = hashlib.sha256(f"{request.title}\n{request.source_url}\n{request.content_text or ''}".encode("utf-8")).hexdigest()
    record = {
        "id": source_id,
        "tenant_id": user.tenant_id,
        **request.model_dump(),
        "content_hash": digest,
        "created_by": user.user_id,
        "created_at": _now(),
        "updated_at": _now(),
    }
    publication_date = _date(request.publication_date, field="publication_date")
    effective_from = _date(request.effective_from, field="effective_from")
    effective_to = _date(request.effective_to, field="effective_to")
    if effective_from and effective_to and effective_to < effective_from:
        raise ValueError("invalid_effective_period")
    if runtime._db_available():
        with kb.db_connection() as connection, connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO legal_knowledge_sources(
                  id, tenant_id, source_kind, title, publisher, jurisdiction, source_url,
                  reference_number, publication_date, effective_from, effective_to, language,
                  content_text, content_hash, metadata, status, created_by
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (tenant_id, source_url) DO UPDATE SET
                  source_kind = EXCLUDED.source_kind, title = EXCLUDED.title,
                  publisher = EXCLUDED.publisher, jurisdiction = EXCLUDED.jurisdiction,
                  reference_number = EXCLUDED.reference_number,
                  publication_date = EXCLUDED.publication_date, effective_from = EXCLUDED.effective_from,
                  effective_to = EXCLUDED.effective_to, language = EXCLUDED.language,
                  content_text = EXCLUDED.content_text, content_hash = EXCLUDED.content_hash,
                  metadata = EXCLUDED.metadata, status = EXCLUDED.status, updated_at = now()
                RETURNING id, created_at
                """,
                (
                    source_id, user.tenant_id, request.source_kind, request.title, request.publisher,
                    request.jurisdiction, request.source_url, request.reference_number,
                    publication_date, effective_from, effective_to, request.language,
                    request.content_text, digest, Json(request.metadata), request.status, user.user_id,
                ),
            )
            row = cursor.fetchone()
            connection.commit()
        record["id"] = row["id"]
        record["created_at"] = _safe(row["created_at"])
    else:
        duplicate = next((item for item in runtime._MEMORY["legal_knowledge_sources"].values() if item["tenant_id"] == user.tenant_id and item["source_url"] == request.source_url), None)
        if duplicate:
            record["id"] = duplicate["id"]
            record["created_at"] = duplicate["created_at"]
        runtime._MEMORY["legal_knowledge_sources"][record["id"]] = record
    runtime._audit(user, "preparation.legal_source_saved", None, {"source_id": record["id"], "source_kind": request.source_kind, "url": request.source_url})
    return {"trace_id": trace_id("legal"), "source": record}


def legal_source_counts(user: UserContext) -> dict[str, int]:
    if runtime._db_available():
        rows = kb.db_fetch_all(
            "SELECT source_kind, count(*) AS count FROM legal_knowledge_sources WHERE tenant_id = %s AND status <> 'archivada' GROUP BY source_kind",
            (user.tenant_id,),
        )
        return {row["source_kind"]: int(row["count"]) for row in rows}
    result = {"normativa": 0, "doctrina": 0, "jurisprudencia": 0}
    for item in runtime._MEMORY["legal_knowledge_sources"].values():
        if item["tenant_id"] == user.tenant_id and item["status"] != "archivada":
            result[item["source_kind"]] = result.get(item["source_kind"], 0) + 1
    return result


def search_legal_sources(user: UserContext, query: str, source_kind: str | None = None, *, limit: int = 30) -> dict[str, Any]:
    normalized_query = query.strip()
    if not normalized_query:
        normalized_query = "contratación pública"
    if source_kind and source_kind not in {"normativa", "doctrina", "jurisprudencia"}:
        raise ValueError("invalid_source_kind")
    normalized_terms = []
    for raw_term in re.findall(r"\w+", unicodedata.normalize("NFKD", normalized_query).encode("ascii", "ignore").decode("ascii").lower()):
        if len(raw_term) < 3 or raw_term in normalized_terms:
            continue
        normalized_terms.append(raw_term)
    patterns = [f"%{term}%" for term in normalized_terms[:12]] or ["%contratacion%", "%publica%"]
    if runtime._db_available():
        rows = kb.db_fetch_all(
            """
            SELECT *,
              CASE WHEN translate(lower(title), 'áéíóúüñàèìòùç', 'aeiouunaeiouc') LIKE ANY(%s) THEN 2 ELSE 0 END +
              CASE WHEN translate(lower(COALESCE(content_text, '')), 'áéíóúüñàèìòùç', 'aeiouunaeiouc') LIKE ANY(%s) THEN 1 ELSE 0 END AS relevance
            FROM legal_knowledge_sources
            WHERE tenant_id = %s AND status <> 'archivada'
              AND (%s::text IS NULL OR source_kind = %s)
              AND (
                translate(lower(title), 'áéíóúüñàèìòùç', 'aeiouunaeiouc') LIKE ANY(%s)
                OR translate(lower(COALESCE(content_text, '')), 'áéíóúüñàèìòùç', 'aeiouunaeiouc') LIKE ANY(%s)
                OR translate(lower(COALESCE(reference_number, '')), 'áéíóúüñàèìòùç', 'aeiouunaeiouc') LIKE ANY(%s)
              )
            ORDER BY relevance DESC, publication_date DESC NULLS LAST, updated_at DESC
            LIMIT %s
            """,
            (patterns, patterns, user.tenant_id, source_kind, source_kind, patterns, patterns, patterns, max(1, min(limit, 100))),
        )
    else:
        terms = set(normalized_terms)
        candidates = [item for item in runtime._MEMORY["legal_knowledge_sources"].values() if item["tenant_id"] == user.tenant_id and item["status"] != "archivada" and (not source_kind or item["source_kind"] == source_kind)]
        scored = []
        for item in candidates:
            haystack = unicodedata.normalize(
                "NFKD",
                f"{item['title']} {item.get('reference_number') or ''} {item.get('content_text') or ''}",
            ).encode("ascii", "ignore").decode("ascii").lower()
            score = sum(1 for term in terms if term in haystack)
            if score:
                scored.append((score, item))
        rows = [item for _, item in sorted(scored, key=lambda pair: (-pair[0], pair[1].get("publication_date") or ""))[:limit]]
    items = _public_rows(rows)
    for item in items:
        item.pop("content_text", None)
        item.pop("relevance", None)
        item["official_source"] = item.get("status") == "vigente" and bool(item.get("reviewed_at"))
    return {"trace_id": trace_id("legal"), "query": normalized_query, "source_kind": source_kind, "items": items, "total": len(items), "counts": legal_source_counts(user)}


def search_tender_explorer(user: UserContext, query: str, *, cpv: str | None = None, document_type: str | None = None, language: str | None = None, limit: int = 30) -> dict[str, Any]:
    hits = kb.search(query, cpv=cpv, document_type=document_type, language=language, top_k=max(1, min(limit, 80)))
    relaxed_filters: list[str] = []
    if not hits and cpv:
        hits = kb.search(query, document_type=document_type, language=language, top_k=max(1, min(limit, 80)))
        relaxed_filters.append("cpv")
    items = [hit.model_dump() if hasattr(hit, "model_dump") else dict(hit) for hit in hits]
    if relaxed_filters:
        for item in items:
            item.setdefault("why_similar", []).append(f"búsqueda ampliada: sin coincidencias exactas para CPV {cpv}")
    runtime._audit(user, "preparation.tender_explorer_searched", None, {"query_hash": hashlib.sha256(query.encode("utf-8")).hexdigest(), "cpv": cpv, "document_type": document_type, "results": len(items), "relaxed_filters": relaxed_filters})
    return {"trace_id": trace_id("explore"), "query": query, "items": items, "total": len(items), "relaxed_filters": relaxed_filters, "summary": kb.summary(), "source": "PLACSP/datos abiertos y corpus indexado"}


def review_ai_output(user: UserContext, request: AiOutputReviewRequest) -> dict[str, Any]:
    _workspace(user, request.workspace_id)
    runtime._ensure_identity(user)
    if request.decision in {"rechazado", "modificado"} and not (request.comment or "").strip():
        raise ValueError("review_comment_required")
    review_id = f"review-{uuid.uuid4().hex[:12]}"
    record = {
        "id": review_id,
        "tenant_id": user.tenant_id,
        **request.model_dump(),
        "reviewer_user_id": user.user_id,
        "created_at": _now(),
    }
    if runtime._db_available():
        with kb.db_connection() as connection, connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO ai_output_reviews(
                  id, tenant_id, workspace_id, target_type, target_id, target_version_id,
                  decision, comment, reviewer_user_id
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (review_id, user.tenant_id, request.workspace_id, request.target_type, request.target_id, request.target_version_id, request.decision, request.comment, user.user_id),
            )
            connection.commit()
    else:
        runtime._MEMORY["ai_output_reviews"][review_id] = record
    runtime._audit(user, "preparation.ai_output_reviewed", request.workspace_id, {"review_id": review_id, "target_type": request.target_type, "target_id": request.target_id, "target_version_id": request.target_version_id, "decision": request.decision})
    return {"trace_id": trace_id("review"), "review": record}


def list_ai_reviews(user: UserContext, workspace_id: str, target_id: str | None = None) -> dict[str, Any]:
    _workspace(user, workspace_id)
    if runtime._db_available():
        rows = kb.db_fetch_all(
            "SELECT * FROM ai_output_reviews WHERE tenant_id = %s AND workspace_id = %s AND (%s::text IS NULL OR target_id = %s) ORDER BY created_at DESC",
            (user.tenant_id, workspace_id, target_id, target_id),
        )
    else:
        rows = [item for item in runtime._MEMORY["ai_output_reviews"].values() if item["tenant_id"] == user.tenant_id and item["workspace_id"] == workspace_id and (not target_id or item["target_id"] == target_id)]
        rows.sort(key=lambda item: item["created_at"], reverse=True)
    return {"trace_id": trace_id("review"), "workspace_id": workspace_id, "items": _public_rows(rows)}


def latest_ai_review(user: UserContext, workspace_id: str, target_id: str, version_id: str | None) -> dict[str, Any] | None:
    items = list_ai_reviews(user, workspace_id, target_id)["items"]
    return next((item for item in items if not version_id or item.get("target_version_id") == version_id), None)


def literacy_status(user: UserContext) -> dict[str, Any]:
    if runtime._db_available():
        rows = kb.db_fetch_all("SELECT * FROM ai_literacy_completions WHERE tenant_id = %s AND user_id = %s", (user.tenant_id, user.user_id))
    else:
        rows = [item for item in runtime._MEMORY["literacy_completions"].values() if item["tenant_id"] == user.tenant_id and item["user_id"] == user.user_id]
    completed = {f"{item['module_id']}:{item['module_version']}": _safe(item) for item in rows}
    items = []
    for module in LITERACY_MODULES:
        key = f"{module['id']}:{module['version']}"
        items.append(
            {
                **module,
                "title": module["title_es"],
                "objective": "; ".join(module["objectives"]),
                "duration_minutes": module["minutes"],
                "topics": module["objectives"],
                "completion": completed.get(key),
                "completed": bool(completed.get(key) and completed[key].get("attested") and int(completed[key].get("quiz_score") or 0) >= 80),
            }
        )
    return {"trace_id": trace_id("learn"), "items": items, "summary": {"completed": sum(1 for item in items if item["completed"]), "total": len(items)}}


def complete_literacy_module(user: UserContext, module_id: str, request: LiteracyCompletionRequest) -> dict[str, Any]:
    module = next((item for item in LITERACY_MODULES if item["id"] == module_id and item["version"] == request.module_version), None)
    if not module:
        raise KeyError(module_id)
    if not request.attested or request.quiz_score < 80:
        raise ValueError("literacy_completion_requires_attestation_and_score_80")
    runtime._ensure_identity(user)
    record = {"tenant_id": user.tenant_id, "user_id": user.user_id, "module_id": module_id, "module_version": request.module_version, "quiz_score": request.quiz_score, "attested": True, "completed_at": _now()}
    if runtime._db_available():
        with kb.db_connection() as connection, connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO ai_literacy_completions(tenant_id, user_id, module_id, module_version, quiz_score, attested)
                VALUES (%s, %s, %s, %s, %s, true)
                ON CONFLICT (tenant_id, user_id, module_id, module_version)
                DO UPDATE SET quiz_score = EXCLUDED.quiz_score, attested = true, completed_at = now()
                """,
                (user.tenant_id, user.user_id, module_id, request.module_version, request.quiz_score),
            )
            connection.commit()
    else:
        runtime._MEMORY["literacy_completions"][f"{user.tenant_id}:{user.user_id}:{module_id}:{request.module_version}"] = record
    runtime._audit(user, "preparation.ai_literacy_completed", None, {"module_id": module_id, "version": request.module_version, "score": request.quiz_score})
    return {"trace_id": trace_id("learn"), "completion": record}


def get_compliance_profile(user: UserContext) -> dict[str, Any]:
    if runtime._db_available():
        row = kb.db_fetch_one("SELECT * FROM compliance_profiles WHERE tenant_id = %s", (user.tenant_id,))
    else:
        row = runtime._MEMORY["compliance_profiles"].get(user.tenant_id)
    profile = json.loads(json.dumps(DEFAULT_COMPLIANCE_PROFILE))
    evidence: list[dict[str, Any]] = []
    if row:
        stored = row.get("profile") or {}
        for key, value in stored.items():
            if key == "eu_hosting" and isinstance(value, dict):
                profile["eu_hosting"].update(value)
            else:
                profile[key] = value
        evidence = list(row.get("evidence") or [])
    controls = _compliance_controls(profile, evidence)
    return {"trace_id": trace_id("comp"), "profile": profile, "evidence": evidence, "controls": controls, "summary": {"satisfied": sum(1 for item in controls if item["status"] == "satisfecho"), "pending": sum(1 for item in controls if item["status"] == "pendiente"), "total": len(controls)}}


def update_compliance_profile(user: UserContext, request: ComplianceProfileRequest) -> dict[str, Any]:
    runtime._ensure_identity(user)
    allowed = set(DEFAULT_COMPLIANCE_PROFILE)
    unknown = sorted(set(request.profile) - allowed)
    if unknown:
        raise ValueError(f"unknown_compliance_fields:{','.join(unknown)}")
    current = get_compliance_profile(user)["profile"]
    updated = {**current, **request.profile}
    if isinstance(current.get("eu_hosting"), dict) and isinstance(request.profile.get("eu_hosting"), dict):
        updated["eu_hosting"] = {**current["eu_hosting"], **request.profile["eu_hosting"]}
    if runtime._db_available():
        with kb.db_connection() as connection, connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO compliance_profiles(tenant_id, profile, evidence, updated_by)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (tenant_id) DO UPDATE SET profile = EXCLUDED.profile,
                  evidence = EXCLUDED.evidence, updated_by = EXCLUDED.updated_by, updated_at = now()
                """,
                (user.tenant_id, Json(updated), Json(request.evidence), user.user_id),
            )
            connection.commit()
    else:
        runtime._MEMORY["compliance_profiles"][user.tenant_id] = {"tenant_id": user.tenant_id, "profile": updated, "evidence": request.evidence, "updated_by": user.user_id, "updated_at": _now()}
    runtime._audit(user, "preparation.compliance_profile_updated", None, {"fields": sorted(request.profile), "evidence_count": len(request.evidence)})
    return get_compliance_profile(user)


def _compliance_controls(profile: dict[str, Any], evidence: list[dict[str, Any]]) -> list[dict[str, Any]]:
    evidence_types = {str(item.get("type")) for item in evidence}
    eu = profile.get("eu_hosting") or {}
    return [
        {"id": "hitl", "requirement": "Supervisión y validación humana", "status": "satisfecho" if profile.get("human_oversight") == "implementado" else "pendiente", "evidence": "Revisión explícita, versiones y bloqueo de sobrescritura"},
        {"id": "transparency", "requirement": "Aviso de interacción y contenido generado por IA", "status": "satisfecho" if profile.get("ai_disclosure") == "implementado" and profile.get("generated_content_provenance") == "implementado" else "pendiente", "evidence": "Procedencia por versión y avisos en interfaz/exportación"},
        {"id": "annex_iii", "requirement": "Declaración de no inclusión en anexo III del RIA", "status": "satisfecho" if "ai_risk_declaration" in evidence_types else "pendiente", "evidence": "Requiere declaración firmada"},
        {"id": "ens", "requirement": "ENS nivel bajo para redacción de pliegos", "status": "satisfecho" if "ens_conformity" in evidence_types else "pendiente", "evidence": "No se infiere de la configuración; requiere acreditación"},
        {"id": "eu_hosting", "requirement": "Servidores y servicios asociados en la UE", "status": "satisfecho" if eu and all(value == "acreditado" for value in eu.values()) else "pendiente", "evidence": "Debe acreditarse por componente"},
        {"id": "closed_ai", "requirement": "No reutilización, retención limitada y ausencia de entrenamiento", "status": "satisfecho" if "provider_data_terms" in evidence_types and profile.get("retention_days") is not None else "pendiente", "evidence": "Requiere condiciones contractuales y plazo de retención"},
        {"id": "data_protection", "requirement": "RGPD, LOPDGDD y encargo de tratamiento", "status": "satisfecho" if "data_processing_agreement" in evidence_types else "pendiente", "evidence": "Requiere análisis y, cuando proceda, contrato"},
        {"id": "literacy", "requirement": "Alfabetización de usuarios", "status": "satisfecho" if "training_plan" in evidence_types else "pendiente", "evidence": "El producto registra módulos; el proveedor debe aportar el plan"},
        {"id": "exit", "requirement": "Devolución ordenada y formatos abiertos", "status": "satisfecho" if profile.get("exit_plan") == "implementado_exportacion_abierta" else "pendiente", "evidence": "ZIP con JSON, Markdown, auditoría y documentos"},
    ]


def run_advanced_validation(user: UserContext, workspace_id: str, request: AdvancedValidationRequest) -> dict[str, Any]:
    workspace = _workspace(user, workspace_id)
    from . import document_workflow

    chapters: list[dict[str, Any]] = []
    for document_type in DOCUMENT_SPECS:
        try:
            for chapter in runtime.latest_chapters(user, workspace_id, document_type=document_type)["chapters"]:
                if str(chapter.get("content") or "").strip():
                    chapters.append({**chapter, "document_type": document_type})
        except KeyError:
            continue
    issues: list[dict[str, Any]] = []
    if "redundancia" in request.modes:
        seen: dict[str, dict[str, Any]] = {}
        for chapter in chapters:
            for sentence in re.split(r"(?<=[.!?])\s+|\n+", str(chapter.get("content") or "")):
                normalized = re.sub(r"\W+", " ", sentence.lower()).strip()
                if len(normalized) < 70:
                    continue
                if normalized in seen:
                    previous = seen[normalized]
                    issues.append(document_workflow._issue("preparation_redundancy", "advertencia", "Cláusula o requisito repetido", "El mismo contenido sustantivo aparece en más de un apartado y puede provocar divergencias al editarlo.", [{"document_type": previous["document_type"], "chapter_id": previous["chapter_id"], "title": previous["title"]}, {"document_type": chapter["document_type"], "chapter_id": chapter["chapter_id"], "title": chapter["title"]}], "Mantén una formulación principal y sustituye la repetición por una remisión inequívoca.", [previous["document_type"], chapter["document_type"]], discriminator=hashlib.sha256(normalized.encode()).hexdigest()[:12]))
                else:
                    seen[normalized] = chapter
    if "ambiguedad" in request.modes:
        ambiguous = [r"\ben su caso\b", r"\badecuad[oa]s?\b", r"\bsuficientes?\b", r"\bpreferentemente\b", r"\ba criterio de\b", r"\blo antes posible\b", r"\betc\.?\b"]
        for chapter in chapters:
            content = str(chapter.get("content") or "")
            matches = sorted({match.group(0) for pattern in ambiguous for match in re.finditer(pattern, content, flags=re.IGNORECASE)})
            if matches:
                issues.append(document_workflow._issue("preparation_ambiguity", "advertencia", "Expresión potencialmente ambigua", f"Se han localizado expresiones no medibles: {', '.join(matches[:8])}.", [{"document_type": chapter["document_type"], "chapter_id": chapter["chapter_id"], "title": chapter["title"]}], "Define condición, unidad de medida, responsable y evidencia de cumplimiento; conserva la expresión solo si su flexibilidad está justificada.", [chapter["document_type"]], discriminator=f"{chapter['chapter_id']}:{'|'.join(matches)}"))
    if "restriccion" in request.modes:
        restrictive_patterns = {
            r"\bmarca\s+[A-ZÁÉÍÓÚ0-9][\w.-]+": "Referencia a marca",
            r"\bdomicilio\s+en\b": "Exigencia territorial",
            r"\bexperiencia\s+(?:mínima\s+)?de\s+(?:1[0-9]|[2-9][0-9])\s+años\b": "Experiencia temporal elevada",
            r"\bnacionalidad\s+española\b": "Exigencia de nacionalidad",
        }
        for chapter in chapters:
            content = str(chapter.get("content") or "")
            matches = [label for pattern, label in restrictive_patterns.items() if re.search(pattern, content, flags=re.IGNORECASE)]
            if matches:
                issues.append(document_workflow._issue("preparation_restrictive", "error", "Posible exigencia restrictiva", f"Indicadores detectados: {', '.join(matches)}. La detección es una señal para revisión, no una conclusión jurídica.", [{"document_type": chapter["document_type"], "chapter_id": chapter["chapter_id"], "title": chapter["title"]}], "Justifica necesidad y proporcionalidad, admite equivalencias y revisa su efecto sobre igualdad y concurrencia.", [chapter["document_type"]], discriminator=f"{chapter['chapter_id']}:{'|'.join(matches)}"))
        solvency = workspace.get("solvency") or {}
        turnover = solvency.get("annual_turnover") if isinstance(solvency, dict) else None
        estimated = workspace.get("estimated_value")
        if turnover and estimated and float(turnover) > float(estimated) * 1.5:
            issues.append(document_workflow._issue("preparation_solvency_ratio", "advertencia", "Solvencia económica potencialmente desproporcionada", f"La cifra de negocios indicada ({float(turnover):,.2f} €) supera 1,5 veces el valor estimado ({float(estimated):,.2f} €).", [{"scope": "expediente", "field": "solvency"}, {"scope": "expediente", "field": "estimated_value"}], "Comprueba el límite legal aplicable, la motivación y el periodo de referencia antes de aprobar el PCAP.", ["informe_necesidad", "pcap"], discriminator=f"{turnover}:{estimated}"))
    if "normativa" in request.modes:
        counts = legal_source_counts(user)
        if sum(counts.values()) == 0:
            issues.append(document_workflow._issue("preparation_normative_corpus_missing", "error", "No hay corpus jurídico oficial actualizado", "La aplicación no puede comprobar consistencia normativa sin normas, doctrina o jurisprudencia identificadas. No se presume cumplimiento.", [{"scope": "expediente", "field": "legal_sources"}], "Sincroniza fuentes oficiales, confirma su vigencia y vuelve a ejecutar la revisión.", list(DOCUMENT_SPECS), discriminator=user.tenant_id))
        else:
            for chapter in chapters:
                content = str(chapter.get("content") or "")
                makes_legal_claim = bool(re.search(r"\b(?:ley|reglamento|real decreto|art(?:ículo|\.)|LCSP|RGPD|ENS)\b", content, flags=re.IGNORECASE))
                if makes_legal_claim and not chapter.get("citations"):
                    issues.append(document_workflow._issue("preparation_legal_claim_without_source", "advertencia", "Afirmación normativa sin fuente trazada", "El apartado contiene referencias jurídicas, pero la versión no conserva una cita verificable del corpus.", [{"document_type": chapter["document_type"], "chapter_id": chapter["chapter_id"], "title": chapter["title"]}], "Vincula la norma, artículo o resolución oficial y su fecha de vigencia; si no puede verificarse, marca el punto para revisión jurídica.", [chapter["document_type"]], discriminator=chapter["chapter_id"]))
    issue_ids = [document_workflow._store_issue(user, workspace_id, issue) for issue in issues]
    runtime._audit(user, "preparation.advanced_validation_run", workspace_id, {"modes": request.modes, "issues": len(issue_ids)})
    all_items = document_workflow.list_validation_issues(user, workspace_id, include_resolved=True)["items"]
    active = [item for item in all_items if item["id"] in set(issue_ids)]
    return {"trace_id": trace_id("val"), "workspace_id": workspace_id, "modes": request.modes, "items": active, "summary": {"error": sum(1 for item in active if item["severity"] == "error"), "advertencia": sum(1 for item in active if item["severity"] == "advertencia"), "recomendacion": sum(1 for item in active if item["severity"] == "recomendacion")}}
