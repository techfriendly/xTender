from __future__ import annotations

import hashlib
import json
import os
import re
import unicodedata
from pathlib import Path
from typing import Any

import httpx
from pymilvus import MilvusClient


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "cpv" / "cpv_2008_main.json"
CPV_SOURCE_URL = "https://ted.europa.eu/documents/d/ted/cpv_2008_xml"
CPV_COLLECTION = os.environ.get("MILVUS_CPV_COLLECTION", "cpv_codes_v1")

_CATALOG_CACHE: list[dict[str, Any]] | None = None

FALLBACK_CATALOG = [
    {"code": "09111400-4", "label_es": "Combustibles de madera", "label_en": "Wood fuels", "level": "item"},
    {"code": "09100000-0", "label_es": "Combustibles", "label_en": "Fuels", "level": "division"},
    {"code": "09300000-2", "label_es": "Electricidad, calefacción, energía solar y nuclear", "label_en": "Electricity, heating, solar and nuclear energy", "level": "division"},
    {"code": "30200000-1", "label_es": "Equipo y material informático", "label_en": "Computer equipment and supplies", "level": "division"},
    {"code": "48000000-8", "label_es": "Paquetes de software y sistemas de información", "label_en": "Software package and information systems", "level": "division"},
    {"code": "72200000-7", "label_es": "Servicios de programación de software y de consultoría", "label_en": "Software programming and consultancy services", "level": "division"},
    {"code": "72212461-2", "label_es": "Servicios de desarrollo de software analítico o científico", "label_en": "Analytical or scientific software development services", "level": "item"},
    {"code": "71300000-1", "label_es": "Servicios de ingeniería", "label_en": "Engineering services", "level": "division"},
    {"code": "79400000-8", "label_es": "Servicios de consultoría comercial y de gestión y servicios afines", "label_en": "Business and management consultancy and related services", "level": "division"},
    {"code": "45000000-7", "label_es": "Trabajos de construcción", "label_en": "Construction work", "level": "division"},
    {"code": "50700000-2", "label_es": "Servicios de reparación y mantenimiento de equipos de edificios", "label_en": "Repair and maintenance services of building installations", "level": "division"},
    {"code": "90910000-9", "label_es": "Servicios de limpieza", "label_en": "Cleaning services", "level": "class"},
    {"code": "33600000-6", "label_es": "Productos farmacéuticos", "label_en": "Pharmaceutical products", "level": "division"},
    {"code": "39160000-1", "label_es": "Mobiliario escolar", "label_en": "School furniture", "level": "class"},
    {"code": "60100000-9", "label_es": "Servicios de transporte por carretera", "label_en": "Road transport services", "level": "division"},
]


def catalog() -> list[dict[str, Any]]:
    global _CATALOG_CACHE
    if _CATALOG_CACHE is not None:
        return _CATALOG_CACHE
    if CATALOG_PATH.exists():
        payload = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
        _CATALOG_CACHE = payload.get("items", payload if isinstance(payload, list) else [])
    else:
        _CATALOG_CACHE = [normalize_item(item) for item in FALLBACK_CATALOG]
    return _CATALOG_CACHE


def search(query: str | None, *, language: str = "es", limit: int = 30) -> dict[str, Any]:
    text = (query or "").strip()
    items = catalog()
    if text:
        ranked = lexical_rank(text, items, language=language, limit=limit)
        mode = "textual_catalog"
    else:
        ranked = [with_display_label(item, language) for item in items if item.get("level") in {"division", "group"}][:limit]
        mode = "browse_catalog"
    return {
        "source_url": CPV_SOURCE_URL,
        "count": len(ranked),
        "mode": mode,
        "items": ranked,
    }


def suggest(
    *,
    query_text: str | None = None,
    title: str | None,
    object_text: str | None,
    need: str | None,
    language: str = "es",
    top_k: int = 3,
    selected_codes: list[str] | None = None,
) -> dict[str, Any]:
    query = (query_text or " ".join(part for part in [title, object_text, need] if part)).strip()
    selected = {normalize_code(code) for code in selected_codes or [] if code}
    if not query:
        return {"source_url": CPV_SOURCE_URL, "mode": "empty_query", "items": []}
    milvus_items = milvus_suggest(query, language=language, limit=max(top_k, 3) * 4)
    if milvus_items:
        ranked = merge_and_trim(query, milvus_items, selected, language, top_k, mode_boost=0.2)
        return {"source_url": CPV_SOURCE_URL, "mode": "milvus_bge_m3", "items": ranked}
    ranked = lexical_rank(query, catalog(), language=language, limit=max(top_k, 3) * 8)
    return {"source_url": CPV_SOURCE_URL, "mode": "textual_catalog", "items": merge_and_trim(query, ranked, selected, language, top_k)}


def lexical_rank(query: str, items: list[dict[str, Any]], *, language: str, limit: int) -> list[dict[str, Any]]:
    query_norm = normalize_text(expand_query(query))
    query_terms = terms(query_norm)
    scored: list[dict[str, Any]] = []
    for item in items:
        label = label_for(item, language)
        haystack = normalize_text(" ".join([item.get("code", ""), label, item.get("label_es", ""), item.get("label_en", "")]))
        hay_terms = set(terms(haystack))
        if not hay_terms:
            continue
        overlap = len(set(query_terms) & hay_terms) / max(1, len(set(query_terms)))
        exact_bonus = 0.35 if any(token in haystack for token in query_terms if len(token) >= 5) else 0.0
        code_bonus = 0.4 if normalize_code(query_norm) and normalize_code(query_norm) in normalize_code(item.get("code", "")) else 0.0
        specificity = {"item": 0.08, "category": 0.06, "class": 0.04, "group": 0.02, "division": 0.0}.get(item.get("level"), 0.03)
        score = min(1.0, overlap + exact_bonus + code_bonus + specificity)
        if score <= 0 and query_norm not in haystack:
            continue
        scored.append({**with_display_label(item, language), "score": round(score, 4), "reason": reason_for(item, query_terms, language)})
    scored.sort(key=lambda item: (float(item.get("score") or 0), item.get("level") == "item", item.get("code", "")), reverse=True)
    return scored[:limit]


def expand_query(query: str) -> str:
    normalized = normalize_text(query)
    normalized_terms = set(terms(normalized))
    expansions = [query]
    synonym_groups = [
        (["pellet", "pellets", "biomasa", "biomassa", "caldera", "termica", "térmica", "astilla"], "combustibles de madera wood fuels combustible biomasa"),
        (["software", "plataforma", "inteligencia artificial", "ia", "automatizar", "aplicacion"], "software sistemas informacion programacion consultoria informatica"),
        (["limpieza", "neteja", "limpeza", "garbiketa"], "servicios limpieza cleaning services"),
        (["obra", "construccion", "construcción", "edificio", "reforma"], "trabajos construccion construction work"),
        (["energia", "energía", "electricidad", "calefaccion", "calefacción"], "electricidad calefaccion energia heating energy"),
        (["mobiliario", "mesas", "sillas", "pupitres"], "mobiliario escolar school furniture"),
        (["consultoria", "consultoría", "asistencia tecnica", "asistencia técnica"], "servicios consultoria gestion engineering consultancy"),
    ]
    for triggers, addition in synonym_groups:
        if any(trigger_matches(trigger, normalized, normalized_terms) for trigger in triggers):
            expansions.append(addition)
    return " ".join(expansions)


def trigger_matches(trigger: str, normalized: str, normalized_terms: set[str]) -> bool:
    candidate = normalize_text(trigger)
    if len(candidate) <= 3 and " " not in candidate:
        return candidate in normalized_terms
    return candidate in normalized


def milvus_suggest(query: str, *, language: str, limit: int) -> list[dict[str, Any]]:
    try:
        vector = embed_dense(query)
        if not vector:
            return []
        client = milvus_client()
        if not client.has_collection(CPV_COLLECTION):
            return []
        client.load_collection(CPV_COLLECTION)
        results = client.search(
            collection_name=CPV_COLLECTION,
            data=[vector],
            anns_field="dense_vector",
            limit=limit,
            output_fields=["code", "label_es", "label_en", "level", "search_text"],
        )
        ranked: list[dict[str, Any]] = []
        for hit in results[0]:
            entity = hit.get("entity", {}) if isinstance(hit, dict) else getattr(hit, "entity", {})
            score = float(hit.get("distance", 0.0)) if isinstance(hit, dict) else float(getattr(hit, "distance", 0.0))
            ranked.append({**with_display_label(entity, language), "score": round(score, 4), "reason": "Coincidencia semántica BGE-M3 en catálogo CPV oficial."})
        return ranked
    except Exception:
        return []


def merge_and_trim(
    query: str,
    candidates: list[dict[str, Any]],
    selected: set[str],
    language: str,
    top_k: int,
    *,
    mode_boost: float = 0.0,
) -> list[dict[str, Any]]:
    by_code: dict[str, dict[str, Any]] = {}
    lexical_by_code = {normalize_code(item["code"]): item for item in lexical_rank(query, catalog(), language=language, limit=80)}
    for item in [*candidates, *lexical_by_code.values()]:
        code = normalize_code(item.get("code", ""))
        if not code or code in selected:
            continue
        lexical = lexical_by_code.get(code)
        semantic_score = float(item.get("score") or 0) if item not in lexical_by_code.values() else 0.0
        lexical_score = float(lexical.get("score") if lexical else 0)
        blended_score = (0.35 * semantic_score) + (1.25 * lexical_score) + mode_boost
        merged = {**item, "score": round(blended_score, 4)}
        if lexical and lexical.get("reason") and not str(merged.get("reason", "")).startswith("Coincidencia semántica"):
            merged["reason"] = lexical["reason"]
        by_code[code] = max([by_code.get(code, merged), merged], key=lambda value: float(value.get("score") or 0))
    ranked = sorted(by_code.values(), key=lambda item: float(item.get("score") or 0), reverse=True)
    return [with_display_label(item, language) for item in ranked[: max(1, min(top_k, 10))]]


def embed_dense(text: str) -> list[float] | None:
    embedding_api = os.environ.get("EMBEDDING_API_URL", "http://127.0.0.1:8010").rstrip("/")
    response = httpx.post(f"{embedding_api}/embed/dense", json={"texts": [text], "normalize": True}, timeout=30)
    response.raise_for_status()
    return response.json()["items"][0]["dense_vector"]


def milvus_client() -> MilvusClient:
    kwargs: dict[str, Any] = {"uri": os.environ.get("MILVUS_URI", "http://127.0.0.1:19530")}
    db_name = os.environ.get("MILVUS_DB")
    token = os.environ.get("MILVUS_TOKEN")
    user = os.environ.get("MILVUS_USER")
    password = os.environ.get("MILVUS_PASSWORD")
    if db_name:
        kwargs["db_name"] = db_name
    if token:
        kwargs["token"] = token
    elif user and password:
        kwargs["token"] = f"{user}:{password}"
    return MilvusClient(**kwargs)


def normalize_item(item: dict[str, Any]) -> dict[str, Any]:
    code = item.get("code") or item.get("CODE") or ""
    label_es = item.get("label_es") or item.get("ES") or item.get("label") or ""
    label_en = item.get("label_en") or item.get("EN") or label_es
    return {
        "code": code,
        "code8": normalize_code(code),
        "label_es": label_es,
        "label_en": label_en,
        "level": item.get("level") or cpv_level(code),
        "source": "TED/SIMAP CPV 2008",
    }


def with_display_label(item: dict[str, Any], language: str) -> dict[str, Any]:
    normalized = normalize_item(item)
    normalized["label"] = label_for(normalized, language)
    return {**item, **normalized}


def label_for(item: dict[str, Any], language: str) -> str:
    if language.lower().startswith("en"):
        return item.get("label_en") or item.get("label_es") or item.get("label") or ""
    return item.get("label_es") or item.get("label_en") or item.get("label") or ""


def reason_for(item: dict[str, Any], query_terms: list[str], language: str) -> str:
    label = label_for(item, language)
    label_terms = set(terms(normalize_text(label)))
    matches = [term for term in query_terms if term in label_terms]
    if matches:
        return f"Coincide con {', '.join(matches[:4])} en la descripción CPV."
    return "Coincidencia por código, familia o texto relacionado."


def cpv_level(code: str) -> str:
    digits = normalize_code(code)
    if len(digits) < 8:
        return "unknown"
    if digits[2:] == "000000":
        return "division"
    if digits[3:] == "00000":
        return "group"
    if digits[4:] == "0000":
        return "class"
    if digits[5:] == "000":
        return "category"
    return "item"


def normalize_code(value: str) -> str:
    return "".join(re.findall(r"\d", value or ""))[:8]


def normalize_text(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value or "")
    stripped = "".join(char for char in decomposed if not unicodedata.combining(char))
    return stripped.lower()


def terms(value: str) -> list[str]:
    stop = {"de", "del", "la", "el", "los", "las", "para", "por", "con", "y", "o", "en", "un", "una", "the", "and", "of", "to"}
    return [token for token in re.findall(r"[a-z0-9]+", value) if len(token) > 1 and token not in stop]


def sparse_to_milvus(value: Any) -> dict[int, float]:
    if not isinstance(value, dict):
        return {}
    converted: dict[int, float] = {}
    for token, weight in sorted(value.items()):
        digest = hashlib.blake2b(str(token).encode(), digest_size=8).digest()
        converted[int.from_bytes(digest, "big") % 1_000_000_000] = float(weight)
    return converted
