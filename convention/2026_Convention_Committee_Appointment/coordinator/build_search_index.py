#!/usr/bin/env python3
"""Build the coordinator portal's browser-side search index from local sources."""

from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent


def clean(value: str) -> str:
    value = value.replace("\u00ad", "").replace("\uf0a8", " ").replace("\uf0fe", " ")
    value = re.sub(r"[_|]{3,}", " ", value)
    return re.sub(r"\s+", " ", value).strip()


class CO1Parser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.entries = []
        self.heading = ""
        self.capture = None
        self.buffer = []
        self.entry_id = ""
        self.entry_kind = ""

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = set(attrs.get("class", "").split())
        if tag in {"h2", "h3"}:
            self.capture, self.buffer = "heading", []
        elif tag == "article" and "paragraph" in classes:
            self.capture, self.buffer = "entry", []
            self.entry_id, self.entry_kind = attrs.get("id", ""), "paragraph"
        elif tag == "section" and "appendix" in classes:
            self.entry_id, self.entry_kind = attrs.get("id", ""), "appendix"
        elif tag == "pre" and self.entry_kind == "appendix":
            self.capture, self.buffer = "appendix", []

    def handle_endtag(self, tag):
        if self.capture == "heading" and tag in {"h2", "h3"}:
            self.heading = clean("".join(self.buffer))
            self.capture = None
        elif self.capture == "entry" and tag == "article":
            text = clean("".join(self.buffer))
            reference = self.entry_id.removeprefix("co1-").replace("-", ":", 1)
            self.entries.append({
                "id": self.entry_id, "sourceId": "co1", "source": "CO-1",
                "type": "co1", "title": self.heading, "reference": reference,
                "url": f"../CO-1.html#{self.entry_id}", "text": re.sub(rf"^{re.escape(reference)}\s*", "", text),
                "priority": 0,
            })
            self.capture = None
        elif self.capture == "appendix" and tag == "pre":
            text = clean("".join(self.buffer))
            appendix = self.entry_id.removeprefix("appendix-").upper()
            # Smaller overlapping passages produce readable result excerpts.
            words = text.split()
            for number, start in enumerate(range(0, len(words), 90), 1):
                passage = " ".join(words[start:start + 120])
                if passage:
                    self.entries.append({
                        "id": f"{self.entry_id}-{number}", "sourceId": "co1", "source": "CO-1",
                        "type": "co1", "title": self.heading, "reference": f"Appendix {appendix}",
                        "url": f"../CO-1.html#{self.entry_id}", "text": passage, "priority": 0,
                    })
            self.capture = None

    def handle_data(self, data):
        if self.capture:
            self.buffer.append(data)


class GuidanceParser(HTMLParser):
    def __init__(self, source_id: str, source: str, url: str, priority: int, reference: str = "Guidance"):
        super().__init__()
        self.source_id, self.source, self.url, self.priority, self.reference = source_id, source, url, priority, reference
        self.heading = source
        self.capture = None
        self.buffer = []
        self.heading_id = ""
        self.entries = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in {"nav", "script", "style"}:
            self.skip += 1
            return
        if self.skip:
            return
        if tag in {"h1", "h2", "h3"}:
            self.capture, self.buffer = "heading", []
            self.heading_id = attrs.get("id", "")
        elif tag in {"p", "li", "td"}:
            self.capture, self.buffer = "block", []

    def handle_endtag(self, tag):
        if tag in {"nav", "script", "style"} and self.skip:
            self.skip -= 1
            return
        if self.skip:
            return
        if self.capture == "heading" and tag in {"h1", "h2", "h3"}:
            self.heading = clean("".join(self.buffer)) or self.source
            self.capture = None
        elif self.capture == "block" and tag in {"p", "li", "td"}:
            text = clean("".join(self.buffer))
            if len(text) >= 28:
                suffix = f"#{self.heading_id}" if self.heading_id and not self.url.lower().endswith(".pdf") else ""
                self.entries.append({
                    "id": f"{self.source_id}-{len(self.entries) + 1}", "sourceId": self.source_id,
                    "source": self.source, "type": "guidance", "title": self.heading,
                    "reference": self.reference, "url": f"{self.url}{suffix}", "text": text,
                    "priority": self.priority,
                })
            self.capture = None

    def handle_data(self, data):
        if self.capture and not self.skip:
            self.buffer.append(data)


def pdf_pages(path: Path, code: str, title: str, priority: int):
    info = subprocess.run(["pdfinfo", str(path)], capture_output=True, text=True, check=True).stdout
    pages = int(re.search(r"^Pages:\s+(\d+)", info, re.MULTILINE).group(1))
    entries = []
    for page in range(1, pages + 1):
        result = subprocess.run(
            ["pdftotext", "-f", str(page), "-l", str(page), "-nopgbrk", str(path), "-"],
            capture_output=True, text=True, check=True,
        )
        text = clean(result.stdout)
        if len(text) < 20:
            continue
        entries.append({
            "id": f"{code.lower()}-page-{page}", "sourceId": code.lower(), "source": code,
            "type": "form", "title": title, "reference": f"Page {page}",
            "url": f"forms/{quote(path.name)}#page={page}", "text": text, "priority": priority,
        })
    return entries


def build():
    parser = CO1Parser()
    parser.feed((PROJECT / "CO-1.html").read_text(encoding="utf-8"))
    entries = parser.entries

    co160_entries = pdf_pages(PROJECT / "CO-160_E.pdf", "CO-160", "Audio/Video Guidelines for Assemblies and Conventions", 1)
    for entry in co160_entries:
        page = entry["reference"].removeprefix("Page ")
        entry["type"] = "guidance"
        entry["url"] = f"../CO-160.html#co160-page-{page}"
    entries.extend(co160_entries)

    related_av = [
        ("CO-160a", "Audio/Video Guidelines for Assemblies and Conventions Addendum — New Zealand", "CO-160a_s-Nz_E.pdf", "CO-160a.html", 2),
        ("CO-162", "Instructions for Livestreaming Conventions", "CO-162_E.pdf", "CO-162.html", 3),
    ]
    for code, title, filename, html_name, priority in related_av:
        document_entries = pdf_pages(PROJECT / filename, code, title, priority)
        for entry in document_entries:
            page = entry["reference"].removeprefix("Page ")
            entry["type"] = "guidance"
            entry["url"] = f"../{html_name}#{code.lower()}-page-{page}"
        entries.extend(document_entries)

    forms = [
        ("CO-68", "Convention Committee Acceptance and Rooming Information", "00-CO-68_E.pdf"),
        ("CO-53", "Convention Personnel Report", "01-CO-53_E.pdf"),
        ("TO-5", "Risk Incident Report", "02-TO-5_E.pdf"),
        ("TO-5i", "Risk Incident Report Instructions", "03-TO-5i_E.pdf"),
        ("DC-85", "Congregation Job Hazard Analysis", "04-DC-85_E.pdf"),
    ]
    for offset, (code, title, filename) in enumerate(forms):
        entries.extend(pdf_pages(ROOT / "forms" / filename, code, title, 10 + offset))

    guidance = [
        ("overview", "Coordinator Overview", ROOT / "coordinator-overview.html", "coordinator-overview.html", 30, "Guidance"),
        ("checklist", "Coordinator Checklist", ROOT / "coordinator-checklist.html", "coordinator-checklist.html", 31, "Checklist"),
        ("forms-register", "Forms Register", ROOT / "forms-register.html", "forms-register.html", 32, "Forms guide"),
        ("operational-guidance", "Operational Guidance", ROOT / "operational-guidance.html", "operational-guidance.html", 33, "Guidance"),
        ("co53-guide", "CO-53 Easy Guide", ROOT / "co-53-guide.html", "co-53-guide.pdf", 11.5, "Easy guide · PDF"),
        ("streaming-meeting-notes", "CO-162 Streaming Meeting Notes", ROOT / "meetings/01-co-162-streaming-presiding-notes.html", "meetings/01-co-162-streaming-presiding-notes.html", 4, "Presiding notes"),
        ("personnel", "Departments and Personnel", ROOT / "departments-and-personnel.html", "departments-and-personnel.html", 35, "Guidance"),
        ("rooming-overview", "Rooming Easy Guide — Overview", PROJECT / "rooming/rooming-overview.html", "../rooming/rooming-overview.html", 20, "Easy guide"),
        ("rooming-checklist", "Rooming Easy Guide — Checklist", PROJECT / "rooming/rooming-overseer-checklist.html", "../rooming/rooming-overseer-checklist.html", 21, "Checklist"),
        ("rooming-forms", "Rooming Forms Guide", PROJECT / "rooming/forms-register.html", "../rooming/forms-register.html", 22, "Forms guide"),
        ("rooming-personnel", "Rooming Departments and Personnel", PROJECT / "rooming/departments-and-personnel.html", "../rooming/departments-and-personnel.html", 23, "Guidance"),
        ("rooming-source-map", "Rooming Source Map", PROJECT / "rooming/source-map.html", "../rooming/source-map.html", 24, "Reference map"),
        ("rooming-glossary", "Rooming Glossary", PROJECT / "rooming/glossary.html", "../rooming/glossary.html", 25, "Glossary"),
    ]
    for source_id, source, source_path, url, priority, reference in guidance:
        parser = GuidanceParser(source_id, source, url, priority, reference)
        parser.feed(source_path.read_text(encoding="utf-8"))
        entries.extend(parser.entries)

    sources = [
        {"id": "co1", "name": "CO-1", "title": "Convention Organization Guidelines", "type": "co1", "priority": 0},
        {"id": "co-160", "name": "CO-160", "title": "Audio/Video Guidelines for Assemblies and Conventions", "type": "guidance", "priority": 1},
        *[{"id": code.lower(), "name": code, "title": title, "type": "guidance", "priority": priority}
          for code, title, _, _, priority in related_av],
        *[{"id": code.lower(), "name": code, "title": title, "type": "form", "priority": 10 + i}
          for i, (code, title, _) in enumerate(forms)],
        *[{"id": sid, "name": name, "title": name, "type": "guidance", "priority": priority}
          for sid, name, _, _, priority, _ in guidance],
    ]
    payload = {"version": 1, "entries": entries, "sources": sources}
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    (ROOT / "search-index.json").write_text(compact, encoding="utf-8")
    (ROOT / "search-index.js").write_text(f"window.CONVENTION_SEARCH_INDEX={compact};\n", encoding="utf-8")
    counts = {kind: sum(entry["type"] == kind for entry in entries) for kind in ("co1", "form", "guidance")}
    print(f"Indexed {len(entries)} passages from {len(sources)} sources: {counts['co1']} CO-1, {counts['form']} form, {counts['guidance']} guidance.")


if __name__ == "__main__":
    build()
