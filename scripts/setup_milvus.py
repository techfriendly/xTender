#!/usr/bin/env python3
"""Prepare Milvus database, user, role and privileges for xTender."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

from pymilvus import MilvusClient


def load_env(path: Path | None) -> dict[str, str]:
    if not path or not path.exists():
        return {}
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        text = line.strip()
        if not text or text.startswith("#") or "=" not in text:
            continue
        key, value = text.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def env_value(values: dict[str, str], *keys: str, default: str = "") -> str:
    for key in keys:
        candidate = os.environ.get(key) or values.get(key)
        if candidate:
            return candidate
    return default


def ignore_exists(callable_obj, *args: Any, **kwargs: Any) -> bool:
    try:
        callable_obj(*args, **kwargs)
        return True
    except Exception as error:
        text = str(error).lower()
        if "already" in text or "exist" in text or "duplicate" in text:
            return False
        raise


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--env", default=".env.local")
    parser.add_argument("--uri")
    parser.add_argument("--db")
    parser.add_argument("--user")
    parser.add_argument("--password")
    parser.add_argument("--role", default="procureai_kb_rw")
    parser.add_argument("--root-token", default="")
    args = parser.parse_args()

    values = load_env(Path(args.env) if args.env else None)
    uri = args.uri or env_value(values, "MILVUS_URI", default="http://127.0.0.1:19530")
    db_name = args.db or env_value(values, "MILVUS_DB", default="procureai")
    user = args.user or env_value(values, "MILVUS_USER", default="procureai")
    password = args.password or env_value(values, "MILVUS_PASSWORD")
    root_token = args.root_token or env_value(values, "MILVUS_ROOT_TOKEN", default="root:Milvus")
    if not password:
        raise SystemExit("MILVUS_PASSWORD is required")

    root = MilvusClient(uri=uri, token=root_token)
    databases = set(root.list_databases())
    created_db = False
    if db_name not in databases:
        root.create_database(db_name)
        created_db = True

    created_role = ignore_exists(root.create_role, args.role)
    created_user = ignore_exists(root.create_user, user, password)
    ignore_exists(root.grant_role, user, args.role)

    for privilege in ["DatabaseAdmin", "CollectionAdmin", "Search", "Query", "Insert", "Upsert", "Flush", "Load"]:
        ignore_exists(
            root.grant_privilege_v2,
            role_name=args.role,
            privilege=privilege,
            collection_name="*",
            db_name=db_name,
        )

    MilvusClient(uri=uri, token=f"{user}:{password}", db_name=db_name).close()
    print(
        json.dumps(
            {
                "uri": uri,
                "db": db_name,
                "user": user,
                "role": args.role,
                "created_db": created_db,
                "created_user": created_user,
                "created_role": created_role,
                "token_valid": True,
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
