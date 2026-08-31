from __future__ import annotations

from copy import deepcopy
from typing import Any


DOCUMENT_KIND_ALIASES = {
    "memoria": "informe_necesidad",
    "informe": "informe_necesidad",
    "informe_necesidad": "informe_necesidad",
    "ppt": "ppt",
    "pcap": "pcap",
    "juridico": "informe_juridico",
    "informe_juridico": "informe_juridico",
}


DOCUMENT_SPECS: dict[str, dict[str, Any]] = {
    "informe_necesidad": {
        "title": "Informe de necesidad",
        "short_title": "Informe",
        "purpose": "Justificar la necesidad, la idoneidad y las principales decisiones preparatorias del contrato.",
        "review_notice": "Borrador administrativo sujeto a revisión técnica, económica y jurídica.",
        "chapters": [
            {
                "chapter_id": "informe-necesidad-medios",
                "title": "Necesidad a satisfacer e insuficiencia o idoneidad de medios propios",
                "required": True,
                "depends_on": ["need", "promoting_unit", "own_means"],
                "review_role": "técnico promotor",
            },
            {
                "chapter_id": "informe-objeto-alcance",
                "title": "Objeto, alcance e idoneidad de la solución contractual",
                "required": True,
                "depends_on": ["object", "included", "excluded", "outcome"],
                "review_role": "técnico promotor",
            },
            {
                "chapter_id": "informe-tipologia-cpv-procedimiento",
                "title": "Tipología contractual, CPV y elección del procedimiento",
                "required": True,
                "depends_on": ["contract_type", "cpv_codes", "procedure"],
                "review_role": "contratación",
            },
            {
                "chapter_id": "informe-lotes",
                "title": "División en lotes o justificación de su no división",
                "required": True,
                "depends_on": ["lots", "lot_structure"],
                "review_role": "contratación",
            },
            {
                "chapter_id": "informe-duracion",
                "title": "Duración, prórrogas, fases e hitos",
                "required": True,
                "depends_on": ["duration", "extensions", "milestones"],
                "review_role": "técnico promotor",
            },
            {
                "chapter_id": "informe-economia",
                "title": "Presupuesto base, valor estimado, financiación e impacto presupuestario",
                "required": True,
                "depends_on": ["budget", "estimated_value", "tax_rate", "funding", "budget_impact"],
                "review_role": "control económico",
                "content_mode": "structured_and_narrative",
            },
            {
                "chapter_id": "informe-solvencia",
                "title": "Solvencia, clasificación y habilitación profesional",
                "required": False,
                "depends_on": ["solvency", "classification", "professional_authorization"],
                "review_role": "contratación",
            },
            {
                "chapter_id": "informe-adjudicacion",
                "title": "Criterios de adjudicación y su vinculación con el objeto",
                "required": True,
                "depends_on": ["award_criteria", "object"],
                "review_role": "contratación",
            },
            {
                "chapter_id": "informe-ejecucion",
                "title": "Condiciones especiales de ejecución y responsable del contrato",
                "required": True,
                "depends_on": ["special_execution_conditions", "contract_manager"],
                "review_role": "técnico promotor",
            },
            {
                "chapter_id": "informe-datos-confidencialidad",
                "title": "Protección de datos, confidencialidad y propiedad intelectual",
                "required": False,
                "depends_on": ["data_protection", "confidentiality", "intellectual_property"],
                "review_role": "jurídico y seguridad",
            },
            {
                "chapter_id": "informe-riesgos-justificaciones",
                "title": "Riesgos y otras justificaciones aplicables",
                "required": False,
                "depends_on": ["risks", "other_justifications"],
                "review_role": "equipo del expediente",
            },
        ],
    },
    "ppt": {
        "title": "Pliego de Prescripciones Técnicas",
        "short_title": "PPT",
        "purpose": "Definir de manera verificable el alcance, los requisitos, los entregables y las condiciones técnicas de ejecución.",
        "review_notice": "Borrador técnico sujeto a validación humana; no es una presentación PowerPoint.",
        "chapters": [
            {
                "chapter_id": "ppt-antecedentes",
                "title": "Contexto y antecedentes",
                "required": True,
                "depends_on": ["need", "outcome"],
            },
            {
                "chapter_id": "ppt-objeto-alcance",
                "title": "Objeto y alcance técnico",
                "required": True,
                "depends_on": ["object", "included", "excluded"],
            },
            {
                "chapter_id": "ppt-requisitos-funcionales",
                "title": "Requisitos funcionales",
                "required": True,
                "depends_on": ["outcome", "functional_requirements"],
                "requirement_taxonomy": True,
            },
            {
                "chapter_id": "ppt-requisitos-no-funcionales",
                "title": "Requisitos no funcionales, calidad y accesibilidad",
                "required": True,
                "depends_on": ["non_functional_requirements", "quality", "accessibility"],
                "requirement_taxonomy": True,
            },
            {
                "chapter_id": "ppt-arquitectura-interoperabilidad",
                "title": "Arquitectura, condiciones técnicas e interoperabilidad",
                "required": False,
                "depends_on": ["architecture", "interoperability", "integrations"],
                "requirement_taxonomy": True,
            },
            {
                "chapter_id": "ppt-servicios-metodologia",
                "title": "Servicios, actividades y metodología",
                "required": True,
                "depends_on": ["included", "methodology"],
            },
            {
                "chapter_id": "ppt-fases-planificacion",
                "title": "Fases de ejecución, planificación e hitos",
                "required": True,
                "depends_on": ["duration", "extensions", "milestones"],
            },
            {
                "chapter_id": "ppt-entregables-aceptacion",
                "title": "Entregables, pruebas y criterios de aceptación",
                "required": True,
                "depends_on": ["deliverables", "acceptance", "testing"],
                "content_mode": "structured_and_narrative",
            },
            {
                "chapter_id": "ppt-equipo",
                "title": "Equipo técnico y organización del servicio",
                "required": False,
                "depends_on": ["technical_team", "service_governance"],
            },
            {
                "chapter_id": "ppt-sla-indicadores",
                "title": "Niveles de servicio, indicadores y seguimiento",
                "required": False,
                "depends_on": ["service_levels", "indicators", "monitoring"],
                "content_mode": "structured_and_narrative",
            },
            {
                "chapter_id": "ppt-seguridad-datos",
                "title": "Seguridad y protección de datos",
                "required": False,
                "depends_on": ["security", "data_protection"],
                "requirement_taxonomy": True,
            },
            {
                "chapter_id": "ppt-propiedad-confidencialidad",
                "title": "Propiedad intelectual y confidencialidad técnica",
                "required": False,
                "depends_on": ["intellectual_property", "confidentiality"],
            },
            {
                "chapter_id": "ppt-transferencia-soporte",
                "title": "Transferencia de conocimiento, mantenimiento y soporte",
                "required": False,
                "depends_on": ["knowledge_transfer", "maintenance", "support"],
            },
            {
                "chapter_id": "ppt-obligaciones-devolucion",
                "title": "Obligaciones técnicas, continuidad y devolución del servicio",
                "required": True,
                "depends_on": ["technical_obligations", "continuity", "exit_plan"],
            },
        ],
    },
    "pcap": {
        "title": "Pliego de Cláusulas Administrativas Particulares",
        "short_title": "PCAP",
        "purpose": "Definir las condiciones jurídicas, económicas y administrativas particulares de la licitación y del contrato.",
        "review_notice": "Borrador jurídico-administrativo para revisión profesional; xTender no sustituye el criterio jurídico.",
        "chapters": [
            {
                "chapter_id": "pcap-regimen-objeto",
                "title": "Régimen jurídico, objeto, naturaleza y codificación CPV",
                "required": True,
                "depends_on": ["object", "contract_type", "cpv_codes"],
                "review_role": "jurídico",
                "content_mode": "structured_and_legal_text",
            },
            {
                "chapter_id": "pcap-lotes",
                "title": "Lotes y limitaciones aplicables",
                "required": True,
                "depends_on": ["lots", "lot_structure"],
                "content_mode": "structured_and_legal_text",
            },
            {
                "chapter_id": "pcap-economia",
                "title": "Presupuesto, valor estimado, precio, impuestos y financiación",
                "required": True,
                "depends_on": ["budget", "estimated_value", "tax_rate", "price_system", "funding"],
                "review_role": "control económico",
                "content_mode": "structured_and_legal_text",
            },
            {
                "chapter_id": "pcap-duracion-procedimiento",
                "title": "Duración, prórrogas y procedimiento de adjudicación",
                "required": True,
                "depends_on": ["duration", "extensions", "procedure"],
                "content_mode": "structured_and_legal_text",
            },
            {
                "chapter_id": "pcap-solvencia-habilitacion",
                "title": "Solvencia, clasificación y habilitación profesional",
                "required": True,
                "depends_on": ["solvency", "classification", "professional_authorization"],
                "review_role": "jurídico",
                "content_mode": "structured_and_legal_text",
            },
            {
                "chapter_id": "pcap-criterios",
                "title": "Criterios de adjudicación: juicio de valor y fórmulas",
                "required": True,
                "depends_on": ["award_criteria", "formula_criteria", "judgment_criteria"],
                "content_mode": "structured_and_legal_text",
            },
            {
                "chapter_id": "pcap-anormalidad-garantias",
                "title": "Ofertas anormalmente bajas y garantías",
                "required": False,
                "depends_on": ["abnormally_low_offers", "guarantees"],
                "content_mode": "structured_and_legal_text",
            },
            {
                "chapter_id": "pcap-ofertas-documentacion",
                "title": "Presentación de ofertas y documentación administrativa",
                "required": True,
                "depends_on": ["submission_deadline", "offer_submission", "administrative_documents"],
                "content_mode": "structured_and_legal_text",
            },
            {
                "chapter_id": "pcap-mesa-adjudicacion",
                "title": "Mesa, adjudicación y formalización",
                "required": True,
                "depends_on": ["procurement_board", "award_date", "formalization_date"],
                "content_mode": "structured_and_legal_text",
            },
            {
                "chapter_id": "pcap-ejecucion-obligaciones",
                "title": "Condiciones especiales de ejecución y obligaciones del contratista",
                "required": True,
                "depends_on": ["special_execution_conditions", "contractor_obligations"],
                "content_mode": "structured_and_legal_text",
            },
            {
                "chapter_id": "pcap-subcontratacion-modificaciones",
                "title": "Subcontratación, cesión y modificaciones",
                "required": False,
                "depends_on": ["subcontracting", "assignment", "modifications"],
                "content_mode": "structured_and_legal_text",
            },
            {
                "chapter_id": "pcap-penalidades-resolucion",
                "title": "Penalidades y resolución",
                "required": True,
                "depends_on": ["penalties", "termination"],
                "content_mode": "structured_and_legal_text",
            },
            {
                "chapter_id": "pcap-datos-confidencialidad-pi",
                "title": "Confidencialidad, protección de datos y propiedad intelectual",
                "required": False,
                "depends_on": ["confidentiality", "data_protection", "intellectual_property"],
                "content_mode": "structured_and_legal_text",
            },
            {
                "chapter_id": "pcap-recursos-anexos",
                "title": "Recursos, anexos y modelos",
                "required": True,
                "depends_on": ["appeals", "annexes"],
                "content_mode": "structured_and_legal_text",
            },
        ],
    },
    "informe_juridico": {
        "title": "Informe jurídico de aprobación del expediente",
        "short_title": "Jurídico",
        "purpose": "Facilitar una revisión jurídica estructurada de la preparación y aprobación del expediente, sin sustituir el criterio ni la firma del órgano asesor competente.",
        "review_notice": "Borrador asistido: exige contraste con normativa oficial vigente, revisión jurídica humana y firma del órgano competente.",
        "chapters": [
            {
                "chapter_id": "juridico-antecedentes-competencia",
                "title": "Antecedentes, competencia y documentación examinada",
                "required": True,
                "depends_on": ["file_number", "contracting_body", "promoting_unit", "legal_sources"],
                "review_role": "jurídico",
                "content_mode": "structured_and_legal_text",
            },
            {
                "chapter_id": "juridico-necesidad-objeto",
                "title": "Necesidad, objeto, naturaleza contractual y CPV",
                "required": True,
                "depends_on": ["need", "object", "contract_type", "cpv_codes"],
                "review_role": "jurídico",
                "content_mode": "structured_and_legal_text",
            },
            {
                "chapter_id": "juridico-procedimiento-lotes",
                "title": "Procedimiento, tramitación y división en lotes",
                "required": True,
                "depends_on": ["procedure", "lots", "lot_structure"],
                "review_role": "jurídico",
                "content_mode": "structured_and_legal_text",
            },
            {
                "chapter_id": "juridico-economia-financiacion",
                "title": "Presupuesto, valor estimado, precio y financiación",
                "required": True,
                "depends_on": ["budget", "estimated_value", "tax_rate", "funding", "price_system"],
                "review_role": "jurídico y control económico",
                "content_mode": "structured_and_legal_text",
            },
            {
                "chapter_id": "juridico-duracion-solvencia",
                "title": "Duración, prórrogas, solvencia y habilitación",
                "required": True,
                "depends_on": ["duration", "extensions", "solvency", "professional_authorization"],
                "review_role": "jurídico",
                "content_mode": "structured_and_legal_text",
            },
            {
                "chapter_id": "juridico-criterios-concurrencia",
                "title": "Criterios de adjudicación, proporcionalidad y concurrencia",
                "required": True,
                "depends_on": ["award_criteria", "solvency", "market_study"],
                "review_role": "jurídico",
                "content_mode": "structured_and_legal_text",
            },
            {
                "chapter_id": "juridico-ejecucion-datos",
                "title": "Ejecución, condiciones especiales, datos y confidencialidad",
                "required": True,
                "depends_on": ["special_execution_conditions", "data_protection", "confidentiality", "intellectual_property"],
                "review_role": "jurídico y seguridad",
                "content_mode": "structured_and_legal_text",
            },
            {
                "chapter_id": "juridico-conclusiones",
                "title": "Observaciones, condicionantes y conclusión jurídica propuesta",
                "required": True,
                "depends_on": ["validation_issues", "legal_sources"],
                "review_role": "jurídico",
                "content_mode": "structured_and_legal_text",
            },
        ],
    },
}


def normalize_document_kind(value: str | None, *, default: str = "ppt") -> str:
    normalized = (value or default).strip().lower()
    return DOCUMENT_KIND_ALIASES.get(normalized, default)


def document_spec(value: str | None) -> dict[str, Any]:
    return deepcopy(DOCUMENT_SPECS[normalize_document_kind(value)])


def document_chapters(value: str | None) -> list[dict[str, Any]]:
    kind = normalize_document_kind(value)
    chapters = deepcopy(DOCUMENT_SPECS[kind]["chapters"])
    for order, chapter in enumerate(chapters, start=1):
        chapter.setdefault("order", order)
        chapter.setdefault("depends_on", [])
        chapter.setdefault("required", False)
        chapter.setdefault("review_role", "equipo del expediente")
        chapter.setdefault("content_mode", "narrative")
        chapter["document_type"] = kind
    return chapters


def public_document_specs() -> list[dict[str, Any]]:
    result = []
    for kind, spec in DOCUMENT_SPECS.items():
        result.append(
            {
                "document_type": kind,
                "title": spec["title"],
                "short_title": spec["short_title"],
                "purpose": spec["purpose"],
                "review_notice": spec["review_notice"],
                "chapters": document_chapters(kind),
            }
        )
    return result
