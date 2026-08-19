#!/usr/bin/env python3
"""Validate portal links, anchors, canonical sources, and the stable entry point."""

from __future__ import annotations

import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "data" / "00-project.json"


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.hrefs: list[str] = []
        self.ids: set[str] = set()

    def handle_starttag(self, _tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if values.get("href"):
            self.hrefs.append(values["href"] or "")
        if values.get("id"):
            self.ids.add(values["id"] or "")


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def parse_page(path: Path) -> PageParser:
    parser = PageParser()
    parser.feed(path.read_text(encoding="utf-8"))
    return parser


def main() -> int:
    failures: list[str] = []
    data = json.loads(DATA_FILE.read_text(encoding="utf-8"))

    for item in data["source_documents"]:
        source = ROOT / item["path"]
        if not source.exists():
            failures.append(f"missing canonical source: {item['path']}")
        elif digest(source) != item["sha256"]:
            failures.append(f"hash mismatch: {item['path']}")

    entry = ROOT / "index.html"
    if not entry.exists() or "00-project-overview.html" not in entry.read_text(encoding="utf-8"):
        failures.append("index.html does not point to 00-project-overview.html")

    pages = [path for path in ROOT.rglob("*.html") if "node_modules" not in path.parts and "artifacts" not in path.parts]
    parsed = {path: parse_page(path) for path in pages}
    link_count = 0
    anchor_count = sum(len(page.ids) for page in parsed.values())
    for page_path, page in parsed.items():
        for href in page.hrefs:
            link_count += 1
            link = urlsplit(href)
            if link.scheme or link.netloc:
                continue
            target = (page_path.parent / unquote(link.path)).resolve() if link.path else page_path.resolve()
            if not target.exists():
                failures.append(f"broken link: {page_path.relative_to(ROOT)} -> {href}")
                continue
            if link.fragment and target.suffix.lower() == ".html":
                target_page = parsed.get(target) or parse_page(target)
                if unquote(link.fragment) not in target_page.ids:
                    failures.append(f"missing anchor: {page_path.relative_to(ROOT)} -> {href}")

    if failures:
        print("Validation failed:\n- " + "\n- ".join(failures))
        return 1
    print(f"Validated {len(pages)} HTML files, {link_count} links, {anchor_count} anchors, and {len(data['source_documents'])} canonical source hashes.")
    print("Confirmed index.html -> 00-project-overview.html.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
