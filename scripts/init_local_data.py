#!/usr/bin/env python3
"""Create an empty local knowledge base without importing procurement documents."""

import json
from pathlib import Path


def initialize(root: Path) -> Path:
    path = root / "data" / "kb" / "kb.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with path.open("x", encoding="utf-8") as handle:
            json.dump(
                {"source": "empty-local-workspace", "source_urls": [], "tenders": [], "documents": [], "chunks": []},
                handle,
                ensure_ascii=False,
                indent=2,
            )
            handle.write("\n")
    except FileExistsError:
        pass  # Existing local documents belong to the operator; never overwrite them.
    return path


if __name__ == "__main__":
    print(initialize(Path(__file__).resolve().parents[1]))
