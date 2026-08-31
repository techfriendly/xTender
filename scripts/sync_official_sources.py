#!/usr/bin/env python3
"""Sincroniza fuentes públicas autorizadas y ejecuta alertas guardadas.

El proceso conserva autoridad, URL, fecha, hash y resultado de cada ejecución. No
intenta descargar CENDOJ ni otras fuentes cuya reutilización requiera acuerdo.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
API_ROOT = ROOT / "apps" / "api"
for candidate in (str(API_ROOT), str(ROOT)):
    if candidate not in sys.path:
        sys.path.insert(0, candidate)

from procureai_api import collaboration, kb, official_sources, runtime  # noqa: E402
from procureai_api.models import OfficialSourceSyncRequest, UserContext  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--connectors", default=os.environ.get("OFFICIAL_SOURCE_CONNECTORS", "boe,dogc,eurlex,eurlex_jurisprudencia,tccsp,tacrc"))
    parser.add_argument("--since", default=None, help="Fecha ISO inicial; por defecto usa la ventana incremental del conector.")
    parser.add_argument("--limit", type=int, default=int(os.environ.get("OFFICIAL_SOURCE_LIMIT", "100")))
    parser.add_argument("--tenant", default=os.environ.get("OFFICIAL_SOURCE_TENANT_ID"), help="Limita la sincronización a una organización.")
    parser.add_argument("--watch", action="store_true", help="Mantiene el proceso activo y repite el ciclo.")
    parser.add_argument("--interval-hours", type=float, default=float(os.environ.get("OFFICIAL_SOURCE_INTERVAL_HOURS", "24")))
    parser.add_argument("--skip-text", action="store_true", help="Registra metadatos y enlaces sin recuperar el texto completo.")
    parser.add_argument("--skip-alerts", action="store_true", help="No ejecuta búsquedas guardadas vencidas.")
    return parser.parse_args()


def sync_users(tenant_filter: str | None) -> list[UserContext]:
    if not runtime._db_available():
        tenant = tenant_filter or "tenant-demo"
        return [UserContext(user_id=f"official-source-sync-{tenant}", tenant_id=tenant, roles=["administrador"])]
    if tenant_filter:
        tenant_ids = [tenant_filter]
    else:
        tenant_ids = [str(row["id"]) for row in kb.db_fetch_all("SELECT id FROM tenants ORDER BY id")]
    if not tenant_ids:
        tenant_ids = ["tenant-demo"]
    users = []
    for tenant_id in tenant_ids:
        safe = "".join(character if character.isalnum() else "-" for character in tenant_id)[:80]
        user = UserContext(user_id=f"official-source-sync-{safe}", tenant_id=tenant_id, roles=["administrador"])
        runtime._ensure_identity(user)
        users.append(user)
    return users


def due_saved_search_users(tenant_filter: str | None) -> list[tuple[UserContext, str]]:
    if not runtime._db_available():
        return []
    tenant_clause = "AND tenant_id = %s" if tenant_filter else ""
    params: tuple[Any, ...] = (tenant_filter,) if tenant_filter else ()
    rows = kb.db_fetch_all(
        f"""
        SELECT id, tenant_id, user_id
        FROM saved_searches
        WHERE active = true AND alert_frequency <> 'sin_alerta' {tenant_clause}
          AND (
            last_checked_at IS NULL
            OR (alert_frequency = 'diaria' AND last_checked_at <= now() - interval '1 day')
            OR (alert_frequency = 'semanal' AND last_checked_at <= now() - interval '7 days')
          )
        ORDER BY updated_at
        """,
        params,
    )
    return [
        (UserContext(user_id=str(row["user_id"]), tenant_id=str(row["tenant_id"]), roles=["responsable_contratacion"]), str(row["id"]))
        for row in rows
    ]


def run_cycle(args: argparse.Namespace) -> dict[str, Any]:
    connectors = [item.strip() for item in args.connectors.split(",") if item.strip()]
    allowed = set(official_sources.SYNC_HANDLERS)
    invalid = sorted(set(connectors) - allowed)
    if invalid:
        raise ValueError(f"Conectores no autorizados o desconocidos: {', '.join(invalid)}")
    request = OfficialSourceSyncRequest(
        connectors=connectors,
        since=args.since,
        limit_per_connector=args.limit,
        include_text=not args.skip_text,
    )
    results = []
    for user in sync_users(args.tenant):
        results.append({"tenant_id": user.tenant_id, "sync": official_sources.sync_official_sources(user, request)})
    alerts = []
    if not args.skip_alerts:
        for user, search_id in due_saved_search_users(args.tenant):
            try:
                result = collaboration.run_saved_search(user, search_id)
                alerts.append({"tenant_id": user.tenant_id, "user_id": user.user_id, "search_id": search_id, "new": len(result["new_result_ids"]), "status": "completado"})
            except Exception as exc:  # el siguiente aviso no debe quedar bloqueado por uno defectuoso
                alerts.append({"tenant_id": user.tenant_id, "user_id": user.user_id, "search_id": search_id, "status": "error", "error": f"{type(exc).__name__}: {str(exc)[:300]}"})
    return {"finished_at": datetime.now(timezone.utc).isoformat(), "tenants": results, "alerts": alerts}


def main() -> int:
    args = parse_args()
    while True:
        try:
            print(json.dumps(run_cycle(args), ensure_ascii=False, default=str), flush=True)
        except Exception as exc:
            print(json.dumps({"status": "error", "error": f"{type(exc).__name__}: {str(exc)[:500]}"}, ensure_ascii=False), file=sys.stderr, flush=True)
            if not args.watch:
                return 1
        if not args.watch:
            return 0
        time.sleep(max(300, int(args.interval_hours * 3600)))


if __name__ == "__main__":
    raise SystemExit(main())
