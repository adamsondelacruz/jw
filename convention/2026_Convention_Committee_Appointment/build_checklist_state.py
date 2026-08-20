#!/usr/bin/env python3
"""Validate the portable checklist JSON and create its file:// compatible loader."""

from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "checklist-state.json"
TARGET = ROOT / "checklist-state-data.js"


def build() -> None:
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    if data.get("version") != 1 or not isinstance(data.get("items"), dict):
        raise ValueError("checklist-state.json must have version 1 and an items object")
    for item_id, item in data["items"].items():
        if not isinstance(item_id, str) or not isinstance(item, dict) or not isinstance(item.get("checked"), bool):
            raise ValueError(f"Invalid checklist item: {item_id!r}")
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    TARGET.write_text(f"window.CONVENTION_CHECKLIST_SEED={payload};\n", encoding="utf-8")
    print(f"Built checklist state loader with {len(data['items'])} seeded items.")


if __name__ == "__main__":
    build()
