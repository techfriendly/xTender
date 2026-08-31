from __future__ import annotations

import hashlib
import json
import re
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Callable
from urllib.parse import urljoin

import httpx
import fitz
from lxml import etree, html
from psycopg2.extras import Json

from . import kb, runtime
from .models import LegalKnowledgeSourceRequest, OfficialSourceSyncRequest, UserContext
from .services import trace_id


BOE_API = "https://www.boe.es/datosabiertos/api/legislacion-consolidada"
DOGC_API = "https://analisi.transparenciacatalunya.cat/resource/n6hn-rmy7.json"
TCCSP_BASE = "https://contractacio.gencat.cat"
TACRC_PLENARY = "https://www.hacienda.gob.es/es-ES/Areas%20Tematicas/Contratacion/TACRC/Paginas/Resoluciones-Pleno.aspx"
EURLEX_DOCUMENTS = {
    "32014L0024": "Directiva 2014/24/UE sobre contratación pública",
    "32016R0679": "Reglamento (UE) 2016/679, Reglamento general de protección de datos",
    "32023R2854": "Reglamento (UE) 2023/2854 sobre normas armonizadas para un acceso justo a los datos y su utilización",
    "32024R1689": "Reglamento (UE) 2024/1689 por el que se establecen normas armonizadas en materia de inteligencia artificial",
}

# Selección trazable de jurisprudencia del TJUE especialmente útil al preparar
# pliegos. Los identificadores CELEX son estables y el texto se recupera siempre
# desde EUR-Lex; esta lista no pretende sustituir una búsqueda jurídica completa.
EURLEX_PUBLIC_PROCUREMENT_CASE_LAW = {
    "62023CJ0424": "DYKA Plastics · formulación y proporcionalidad de las especificaciones técnicas",
    "62024CJ0282": "Polismyndigheten · modificación de acuerdos marco y naturaleza global",
    "62022CJ0441": "Contratación pública · modificación contractual y documentación del procedimiento",
    "62016CJ0546": "Montte · criterios de adjudicación y fases del procedimiento",
    "62017CJ0124": "Vossloh Laeis · motivos y duración de la exclusión",
    "62018CJ0796": "Informatikgesellschaft · cooperación entre poderes adjudicadores y software",
}


CONNECTORS: tuple[dict[str, Any], ...] = (
    {
        "id": "boe",
        "name": "BOE · legislación consolidada",
        "source_kind": "normativa",
        "automation": "api_incremental",
        "default_frequency": "diaria",
        "official_url": "https://www.boe.es/datosabiertos/api/api.php",
        "conditions": "Reutilización sujeta a las condiciones de AEBOE; el texto consolidado es informativo.",
        "requires_credentials": False,
    },
    {
        "id": "dogc",
        "name": "DOGC y Portal Jurídic de Catalunya",
        "source_kind": "normativa",
        "automation": "open_data_incremental",
        "default_frequency": "diaria",
        "official_url": "https://dogc.gencat.cat/es/serveis/Dades_obertes/",
        "conditions": "Dataset oficial actualizado diariamente y documentos ELI en XML/HTML.",
        "requires_credentials": False,
    },
    {
        "id": "tccsp",
        "name": "Tribunal Català de Contractes del Sector Públic",
        "source_kind": "doctrina",
        "automation": "public_index_incremental",
        "default_frequency": "semanal",
        "official_url": "https://contractacio.gencat.cat/ca/contacte/tccsp/cercador-resolucions/",
        "conditions": "Sin API pública documentada; sincronización moderada del índice público y enlace al original.",
        "requires_credentials": False,
    },
    {
        "id": "tacrc",
        "name": "Tribunal Administrativo Central de Recursos Contractuales",
        "source_kind": "doctrina",
        "automation": "public_index_incremental",
        "default_frequency": "semanal",
        "official_url": TACRC_PLENARY,
        "conditions": "Sin API pública documentada; se indexa la selección pública y se conserva el PDF oficial.",
        "requires_credentials": False,
    },
    {
        "id": "eurlex",
        "name": "EUR-Lex / CELLAR",
        "source_kind": "normativa",
        "automation": "curated_documents",
        "default_frequency": "semanal",
        "official_url": "https://eur-lex.europa.eu/content/help/data-reuse/reuse-contents-eurlex-details.html",
        "conditions": "Documentos CELEX conocidos sin credenciales; búsqueda masiva requiere registro o CELLAR/Data Dump.",
        "requires_credentials": False,
    },
    {
        "id": "eurlex_jurisprudencia",
        "name": "EUR-Lex · jurisprudencia del TJUE sobre contratación pública",
        "source_kind": "jurisprudencia",
        "automation": "curated_case_law",
        "default_frequency": "semanal",
        "official_url": "https://data.europa.eu/data/datasets/eu-case-law",
        "conditions": "Selección trazable de asuntos CELEX relevantes; debe completarse con búsqueda jurídica humana para cada expediente.",
        "requires_credentials": False,
    },
    {
        "id": "cendoj",
        "name": "CENDOJ",
        "source_kind": "jurisprudencia",
        "automation": "blocked_without_reuse_agreement",
        "default_frequency": None,
        "official_url": "https://www.poderjudicial.es/search/",
        "conditions": "La descarga masiva o reutilización comercial requiere procedimiento y autorización del CGPJ/CENDOJ.",
        "requires_credentials": True,
        "enabled": False,
    },
)


def connector_catalog() -> dict[str, Any]:
    return {"trace_id": trace_id("sources"), "items": [dict(item, enabled=item.get("enabled", True)) for item in CONNECTORS]}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _date(value: str | None) -> str | None:
    if not value:
        return None
    digits = re.sub(r"\D", "", value)
    if len(digits) >= 8:
        return f"{digits[:4]}-{digits[4:6]}-{digits[6:8]}"
    try:
        return date.fromisoformat(value[:10]).isoformat()
    except ValueError:
        return None


def _terms_match(text: str, terms: list[str]) -> bool:
    lowered = text.lower()
    return any(term.strip().lower() in lowered for term in terms if term.strip())


def _plain_html(content: str, *, max_chars: int = 1_900_000) -> str:
    try:
        document = html.fromstring(content)
    except (etree.ParserError, ValueError):
        return re.sub(r"\s+", " ", content).strip()[:max_chars]
    for node in document.xpath("//script|//style|//nav|//header|//footer|//form|//noscript"):
        node.drop_tree()
    candidates = document.xpath("//main|//*[@id='contenido']|//*[@id='textoxslt']|//*[contains(@class,'documento')] | //article")
    root = candidates[0] if candidates else document
    return re.sub(r"\s+", " ", " ".join(root.itertext())).strip()[:max_chars]


def _official_text(client: httpx.Client, url: str) -> str | None:
    response = client.get(url, headers={"Accept": "text/html, application/xml;q=0.9, application/pdf;q=0.8"})
    response.raise_for_status()
    # EUR-Lex can answer the public HTML URL with HTTP 202 and an empty body.
    # CELLAR exposes the same CELEX document through stable content negotiation.
    if (response.status_code == 202 or not response.content) and "eur-lex.europa.eu" in url:
        celex_match = re.search(r"CELEX(?::|%3A)([0-9A-Z_]+)", url, flags=re.IGNORECASE)
        if celex_match:
            cellar_url = f"https://publications.europa.eu/resource/celex/{celex_match.group(1).upper()}"
            response = client.get(
                cellar_url,
                headers={"Accept": "application/xhtml+xml", "Accept-Language": "es"},
            )
            response.raise_for_status()
    content_type = response.headers.get("content-type", "").lower()
    if "application/pdf" in content_type or response.content.lstrip().startswith(b"%PDF"):
        with fitz.open(stream=response.content, filetype="pdf") as document:
            chunks: list[str] = []
            consumed = 0
            for page in document:
                text = page.get_text("text")
                if not text:
                    continue
                remaining = 1_900_000 - consumed
                if remaining <= 0:
                    break
                chunks.append(text[:remaining])
                consumed += len(chunks[-1])
        extracted = re.sub(r"\s+", " ", " ".join(chunks)).strip()
        if not extracted:
            raise ValueError("official_source_empty")
        return extracted
    if "xml" in content_type or response.text.lstrip().startswith("<?xml"):
        try:
            root = etree.fromstring(response.content)
            extracted = re.sub(r"\s+", " ", " ".join(root.itertext())).strip()[:1_900_000]
            if extracted:
                return extracted
        except etree.XMLSyntaxError:
            pass
    extracted = _plain_html(response.text)
    if not extracted:
        raise ValueError("official_source_empty")
    return extracted


def _boe_xml_record(content: bytes) -> dict[str, Any] | None:
    try:
        root = etree.fromstring(content)
    except etree.XMLSyntaxError:
        return None
    metadata = root.find(".//data/metadatos")
    if metadata is None:
        return None

    def value(name: str) -> str | None:
        node = metadata.find(name)
        return node.text.strip() if node is not None and node.text else None

    def coded(name: str) -> dict[str, str] | None:
        node = metadata.find(name)
        if node is None:
            return None
        return {"codigo": str(node.get("codigo") or ""), "texto": (node.text or "").strip()}

    return {
        "fecha_actualizacion": value("fecha_actualizacion"),
        "identificador": value("identificador"),
        "ambito": coded("ambito"),
        "departamento": coded("departamento"),
        "rango": coded("rango"),
        "fecha_disposicion": value("fecha_disposicion"),
        "numero_oficial": value("numero_oficial"),
        "titulo": value("titulo"),
        "fecha_publicacion": value("fecha_publicacion"),
        "fecha_vigencia": value("fecha_vigencia"),
        "vigencia_agotada": value("vigencia_agotada"),
        "estado_consolidacion": coded("estado_consolidacion"),
        "url_eli": value("url_eli"),
        "url_html_consolidada": value("url_html_consolidada"),
    }


def _save_source(user: UserContext, payload: dict[str, Any]) -> dict[str, Any]:
    from .category1 import save_legal_source

    return save_legal_source(user, LegalKnowledgeSourceRequest(**payload))["source"]


def _sync_boe(user: UserContext, request: OfficialSourceSyncRequest, client: httpx.Client) -> dict[str, Any]:
    since = request.since or (date.today() - timedelta(days=30)).isoformat()
    from_value = re.sub(r"\D", "", since)[:8]
    response = client.get(BOE_API, params={"from": from_value, "limit": request.limit_per_connector}, headers={"Accept": "application/json"})
    response.raise_for_status()
    records = response.json().get("data") or []
    curated_ids = {
        "BOE-A-2007-19814",  # reutilización de la información del sector público
        "BOE-A-2017-12902",  # contratos del sector público
        "BOE-A-2018-16673",  # protección de datos y derechos digitales
        "BOE-A-2019-2364",   # secretos empresariales
        "BOE-A-2022-7191",   # Esquema Nacional de Seguridad
    }
    relevant = [item for item in records if item.get("identificador") in curated_ids or _terms_match(str(item.get("titulo") or ""), request.query_terms)]
    known_ids = {str(item.get("identificador") or "") for item in relevant}
    for identifier in sorted(curated_ids - known_ids):
        if len(relevant) >= request.limit_per_connector:
            break
        detail = client.get(f"{BOE_API}/id/{identifier}", headers={"Accept": "application/xml"})
        if detail.status_code == 200:
            data = _boe_xml_record(detail.content)
            if data:
                relevant.append(data)
    stored = []
    errors = []
    for item in relevant[: request.limit_per_connector]:
        identifier = str(item.get("identificador") or item.get("id") or "").strip()
        if not identifier:
            continue
        source_url = str(item.get("url_html_consolidada") or f"https://www.boe.es/buscar/act.php?id={identifier}")
        content_text = None
        if request.include_text:
            try:
                content_text = _official_text(client, source_url)
            except Exception as exc:
                errors.append({"id": identifier, "error": type(exc).__name__})
        state = item.get("estado_consolidacion") or {}
        scope = item.get("ambito") or {}
        department = item.get("departamento") or {}
        stored.append(
            _save_source(
                user,
                {
                    "source_kind": "normativa",
                    "title": str(item.get("titulo") or identifier),
                    "publisher": "Agencia Estatal Boletín Oficial del Estado",
                    "jurisdiction": str(scope.get("texto") or department.get("texto") or "España"),
                    "source_url": source_url,
                    "reference_number": str(item.get("numero_oficial") or identifier),
                    "publication_date": _date(item.get("fecha_publicacion")),
                    "effective_from": _date(item.get("fecha_vigencia")),
                    "language": "es",
                    "content_text": content_text,
                    "metadata": {
                        "connector": "boe",
                        "official_identifier": identifier,
                        "last_source_update": item.get("fecha_actualizacion"),
                        "consolidation_status": state.get("texto"),
                        "informational_consolidated_text": True,
                        "reuse_notice": "Texto consolidado de carácter meramente informativo; comprobar publicación oficial.",
                    },
                    "status": "derogada" if item.get("vigencia_agotada") == "S" else "vigente_sin_verificar",
                },
            )
        )
    return {"fetched": len(records), "matched": len(relevant), "stored": len(stored), "errors": errors, "source_ids": [item["id"] for item in stored]}


def _sync_dogc(user: UserContext, request: OfficialSourceSyncRequest, client: httpx.Client) -> dict[str, Any]:
    params: dict[str, Any] = {"$limit": request.limit_per_connector, "$order": "data_de_publicaci_del_diari DESC"}
    if request.since:
        params["$where"] = f"data_de_publicaci_del_diari >= '{request.since[:10]}T00:00:00.000'"
    response = client.get(DOGC_API, params=params)
    response.raise_for_status()
    records = response.json()
    relevant = [item for item in records if _terms_match(f"{item.get('t_tol_de_la_norma','')} {item.get('t_tol_de_la_norma_es','')}", request.query_terms)]
    stored = []
    errors = []
    for item in relevant:
        url_entry = item.get("url_es_formato_html") or item.get("format_html") or item.get("url_ltima_versi_format_html") or {}
        source_url = str(url_entry.get("url") if isinstance(url_entry, dict) else url_entry or "").strip()
        if not source_url:
            continue
        content_text = None
        if request.include_text:
            try:
                content_text = _official_text(client, source_url)
            except Exception as exc:
                errors.append({"id": item.get("n_mero_de_control"), "error": type(exc).__name__})
        title = str(item.get("t_tol_de_la_norma_es") or item.get("t_tol_de_la_norma") or item.get("n_mero_de_control"))
        stored.append(
            _save_source(
                user,
                {
                    "source_kind": "normativa",
                    "title": title,
                    "publisher": "Diari Oficial de la Generalitat de Catalunya / Portal Jurídic de Catalunya",
                    "jurisdiction": "Catalunya",
                    "source_url": source_url,
                    "reference_number": str(item.get("n_mero_de_control") or ""),
                    "publication_date": _date(item.get("data_de_publicaci_del_diari")),
                    "effective_from": _date(item.get("data_del_document")),
                    "language": "es" if item.get("t_tol_de_la_norma_es") else "ca",
                    "content_text": content_text,
                    "metadata": {"connector": "dogc", "year": item.get("any"), "rank": item.get("rang_de_norma"), "eli_xml": (item.get("url_es_format_xml") or item.get("url_format_xml") or {}).get("url")},
                    "status": "derogada" if str(item.get("vig_ncia_de_la_norma") or "").lower() not in {"vigent", "vigente"} else "vigente_sin_verificar",
                },
            )
        )
    return {"fetched": len(records), "matched": len(relevant), "stored": len(stored), "errors": errors, "source_ids": [item["id"] for item in stored]}


def _document_links(page: str, base_url: str, *, patterns: tuple[str, ...]) -> list[tuple[str, str]]:
    document = html.fromstring(page)
    links: list[tuple[str, str]] = []
    seen: set[str] = set()
    for anchor in document.xpath("//a[@href]"):
        href = urljoin(base_url, str(anchor.get("href")))
        title = re.sub(r"\s+", " ", " ".join(anchor.itertext())).strip()
        if href in seen or not title or not any(pattern.lower() in href.lower() for pattern in patterns):
            continue
        seen.add(href)
        links.append((title, href))
    return links


def _sync_tccsp(user: UserContext, request: OfficialSourceSyncRequest, client: httpx.Client) -> dict[str, Any]:
    year = date.today().year
    page_url = f"{TCCSP_BASE}/ca/contacte/tccsp/resolucions-tccsp/{year}/"
    response = client.get(page_url)
    response.raise_for_status()
    links = _document_links(response.text, page_url, patterns=("resolucio", "/resolucions/"))
    relevant = [(title, url) for title, url in links if _terms_match(title, request.query_terms) or "resolució" in title.lower()]
    stored = []
    errors = []
    for title, source_url in relevant[: request.limit_per_connector]:
        content_text = None
        if request.include_text:
            try:
                content_text = _official_text(client, source_url)
            except Exception as exc:
                errors.append({"url": source_url, "error": type(exc).__name__})
        stored.append(
            _save_source(
                user,
                {
                    "source_kind": "doctrina",
                    "title": title,
                    "publisher": "Tribunal Català de Contractes del Sector Públic",
                    "jurisdiction": "Catalunya",
                    "source_url": source_url,
                    "reference_number": title[:300],
                    "publication_date": None,
                    "language": "ca",
                    "content_text": content_text,
                    "metadata": {"connector": "tccsp", "index_url": page_url},
                    "status": "vigente_sin_verificar",
                },
            )
        )
    return {"fetched": len(links), "matched": len(relevant), "stored": len(stored), "errors": errors, "source_ids": [item["id"] for item in stored]}


def _sync_tacrc(user: UserContext, request: OfficialSourceSyncRequest, client: httpx.Client) -> dict[str, Any]:
    response = client.get(TACRC_PLENARY)
    response.raise_for_status()
    links = _document_links(response.text, TACRC_PLENARY, patterns=("/tacrc/", ".pdf"))
    relevant = [(title, url) for title, url in links if _terms_match(title, request.query_terms) or "resolución" in title.lower()]
    stored = []
    errors = []
    for title, source_url in relevant[: request.limit_per_connector]:
        content_text = None
        if request.include_text:
            try:
                content_text = _official_text(client, source_url)
            except Exception as exc:
                errors.append({"url": source_url, "error": type(exc).__name__})
        stored.append(
            _save_source(
                user,
                {
                    "source_kind": "doctrina",
                    "title": title,
                    "publisher": "Tribunal Administrativo Central de Recursos Contractuales",
                    "jurisdiction": "España",
                    "source_url": source_url,
                    "reference_number": title[:300],
                    "language": "es",
                    "content_text": content_text,
                    "metadata": {"connector": "tacrc", "index_url": TACRC_PLENARY},
                    "status": "vigente_sin_verificar",
                },
            )
        )
    return {"fetched": len(links), "matched": len(relevant), "stored": len(stored), "errors": errors, "source_ids": [item["id"] for item in stored]}


def _sync_eurlex(user: UserContext, request: OfficialSourceSyncRequest, client: httpx.Client) -> dict[str, Any]:
    stored = []
    errors = []
    for celex, title in list(EURLEX_DOCUMENTS.items())[: request.limit_per_connector]:
        source_url = f"https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:{celex}"
        content_text = None
        if request.include_text:
            try:
                content_text = _official_text(client, source_url)
            except Exception as exc:
                errors.append({"id": celex, "error": type(exc).__name__})
        stored.append(
            _save_source(
                user,
                {
                    "source_kind": "normativa",
                    "title": title,
                    "publisher": "EUR-Lex / Oficina de Publicaciones de la Unión Europea",
                    "jurisdiction": "Unión Europea",
                    "source_url": source_url,
                    "reference_number": celex,
                    "language": "es",
                    "content_text": content_text,
                    "metadata": {"connector": "eurlex", "celex": celex, "retrieval": "stable_celex_url"},
                    "status": "vigente_sin_verificar",
                },
            )
        )
    return {"fetched": len(EURLEX_DOCUMENTS), "matched": len(EURLEX_DOCUMENTS), "stored": len(stored), "errors": errors, "source_ids": [item["id"] for item in stored]}


def _sync_eurlex_case_law(user: UserContext, request: OfficialSourceSyncRequest, client: httpx.Client) -> dict[str, Any]:
    stored = []
    errors = []
    cases = list(EURLEX_PUBLIC_PROCUREMENT_CASE_LAW.items())[: request.limit_per_connector]
    for celex, title in cases:
        source_url = f"https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:{celex}"
        content_text = None
        if request.include_text:
            try:
                content_text = _official_text(client, source_url)
            except Exception as exc:
                errors.append({"id": celex, "error": type(exc).__name__})
        stored.append(
            _save_source(
                user,
                {
                    "source_kind": "jurisprudencia",
                    "title": title,
                    "publisher": "Tribunal de Justicia de la Unión Europea / EUR-Lex",
                    "jurisdiction": "Unión Europea",
                    "source_url": source_url,
                    "reference_number": celex,
                    "language": "es",
                    "content_text": content_text,
                    "metadata": {
                        "connector": "eurlex_jurisprudencia",
                        "celex": celex,
                        "retrieval": "stable_celex_url",
                        "curated_scope": "contratación pública",
                        "human_legal_search_required": True,
                    },
                    "status": "vigente_sin_verificar",
                },
            )
        )
    return {"fetched": len(cases), "matched": len(cases), "stored": len(stored), "errors": errors, "source_ids": [item["id"] for item in stored]}


SYNC_HANDLERS: dict[str, Callable[[UserContext, OfficialSourceSyncRequest, httpx.Client], dict[str, Any]]] = {
    "boe": _sync_boe,
    "dogc": _sync_dogc,
    "tccsp": _sync_tccsp,
    "tacrc": _sync_tacrc,
    "eurlex": _sync_eurlex,
    "eurlex_jurisprudencia": _sync_eurlex_case_law,
}


def _start_run(user: UserContext, connector: str, request: OfficialSourceSyncRequest) -> str:
    runtime._ensure_identity(user)
    run_id = f"sync-{uuid.uuid4().hex[:12]}"
    record = {"id": run_id, "tenant_id": user.tenant_id, "connector": connector, "status": "ejecutando", "cursor_value": request.since, "requested": request.model_dump(), "result": {}, "error": None, "started_by": user.user_id, "started_at": _now(), "finished_at": None}
    if runtime._db_available():
        with kb.db_connection() as connection, connection.cursor() as cursor:
            cursor.execute(
                "INSERT INTO knowledge_sync_runs(id, tenant_id, connector, status, cursor_value, requested, started_by) VALUES (%s, %s, %s, 'ejecutando', %s, %s, %s)",
                (run_id, user.tenant_id, connector, request.since, Json(request.model_dump()), user.user_id),
            )
            connection.commit()
    else:
        runtime._MEMORY["knowledge_sync_runs"][run_id] = record
    return run_id


def _finish_run(user: UserContext, run_id: str, status: str, result: dict[str, Any], error: str | None = None) -> None:
    if runtime._db_available():
        with kb.db_connection() as connection, connection.cursor() as cursor:
            cursor.execute(
                "UPDATE knowledge_sync_runs SET status = %s, result = %s, error = %s, finished_at = now() WHERE id = %s AND tenant_id = %s",
                (status, Json(result), error, run_id, user.tenant_id),
            )
            connection.commit()
    else:
        runtime._MEMORY["knowledge_sync_runs"][run_id].update({"status": status, "result": result, "error": error, "finished_at": _now()})


def sync_official_sources(user: UserContext, request: OfficialSourceSyncRequest) -> dict[str, Any]:
    connector_ids = list(dict.fromkeys(request.connectors))
    results: list[dict[str, Any]] = []
    with httpx.Client(timeout=httpx.Timeout(40.0, connect=10.0), follow_redirects=True, headers={"User-Agent": "xTender/1.0 official-source-sync"}) as client:
        for connector in connector_ids:
            run_id = _start_run(user, connector, request)
            try:
                result = SYNC_HANDLERS[connector](user, request, client)
                status = "parcial" if result.get("errors") else "completado"
                _finish_run(user, run_id, status, result)
                results.append({"run_id": run_id, "connector": connector, "status": status, **result})
            except Exception as exc:
                error = f"{type(exc).__name__}: {str(exc)[:500]}"
                _finish_run(user, run_id, "error", {}, error)
                results.append({"run_id": run_id, "connector": connector, "status": "error", "error": error})
    runtime._audit(user, "preparation.official_sources_synced", None, {"connectors": connector_ids, "runs": [{"run_id": item["run_id"], "status": item["status"]} for item in results]})
    return {"trace_id": trace_id("sync"), "items": results, "summary": {"stored": sum(int(item.get("stored") or 0) for item in results), "completed": sum(1 for item in results if item["status"] == "completado"), "partial": sum(1 for item in results if item["status"] == "parcial"), "errors": sum(1 for item in results if item["status"] == "error")}}


def list_sync_runs(user: UserContext, connector: str | None = None, *, limit: int = 50) -> dict[str, Any]:
    if runtime._db_available():
        rows = kb.db_fetch_all(
            "SELECT * FROM knowledge_sync_runs WHERE tenant_id = %s AND (%s::text IS NULL OR connector = %s) ORDER BY started_at DESC LIMIT %s",
            (user.tenant_id, connector, connector, max(1, min(limit, 200))),
        )
        items = [runtime._json_safe(row) for row in rows]
    else:
        items = [dict(item) for item in runtime._MEMORY["knowledge_sync_runs"].values() if item["tenant_id"] == user.tenant_id and (not connector or item["connector"] == connector)]
        items.sort(key=lambda item: item["started_at"], reverse=True)
        items = items[:limit]
    return {"trace_id": trace_id("sync"), "items": items}
