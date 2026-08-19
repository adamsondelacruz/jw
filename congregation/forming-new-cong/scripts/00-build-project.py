#!/usr/bin/env python3
"""Build the Ashburton new-congregation evidence portal from canonical JSON."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import quote


ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "data" / "00-project.json"
ASSET_FILE = ROOT / "assets" / "00-portal.css"
DOCS_DIR = ROOT / "docs"
REFS_DIR = ROOT / "references"
ENTRY_HTML = ROOT / "index.html"
ROOT_MD = ROOT / "00-project-overview.md"
ROOT_HTML = ROOT / "00-project-overview.html"
ROOT_PDF = ROOT / "00-project-overview.pdf"
PACK_MD = ROOT / "01-meeting-pack.md"
PACK_HTML = ROOT / "01-meeting-pack.html"
PACK_PDF = ROOT / "01-meeting-pack.pdf"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def qpath(value: str) -> str:
    return quote(value, safe="/.:#?=&%")


def md_cell(value: object) -> str:
    return str(value if value is not None else "—").replace("|", "\\|").replace("\n", " ")


def status(value: str) -> str:
    label = value.replace("-", " ").title()
    return f'<span class="status {html.escape(value)}">{html.escape(label)}</span>'


def file_link(path: str, prefix: str = "") -> str:
    return f"[{md_cell(Path(path).name)}]({qpath(prefix + path)})"


def source_link(reference: str, prefix: str = "") -> str:
    anchor = None
    target = None
    if reference.startswith("S-50"):
        target = "references/00-S-50-reference.html"
        match = re.search(r"(?:par\.?|paragraph|#)\s*(\d)(?:\((\d)\))?", reference, re.I)
        if match:
            anchor = f"s50-p{match.group(1)}"
            if match.group(2):
                anchor += f"-item-{match.group(2)}"
    elif reference.startswith("S-51"):
        target = "references/01-S-51-reference.html"
        match = re.search(r"point\s+([1-8])", reference, re.I)
        if match:
            anchor = f"s51-point-{match.group(1)}"
        elif "page 2" in reference.lower():
            anchor = "s51-page-2-instructions"
    if not target:
        return md_cell(reference)
    return f"[{md_cell(reference)}]({qpath(prefix + target)}{('#' + anchor) if anchor else ''})"


def load_data() -> dict:
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))


def verify_preserved_files(data: dict) -> dict[str, str]:
    hashes: dict[str, str] = {}
    failures = []
    for item in data["source_documents"]:
        path = ROOT / item["path"]
        if not path.exists():
            failures.append(f"missing source: {item['path']}")
            continue
        actual = sha256(path)
        hashes[item["path"]] = actual
        if item.get("immutable") and item.get("sha256") != actual:
            failures.append(f"immutable source hash changed: {item['path']}")
    if failures:
        raise RuntimeError("Source-integrity check failed:\n- " + "\n- ".join(failures))
    return hashes


def common_nav(depth: int, current: str) -> str:
    prefix = "../" * depth
    links = [
        ("Home", f"{prefix}index.html", "home"),
        ("Forms", f"{prefix}docs/00-forms-register.html", "forms"),
        ("Requirements", f"{prefix}docs/01-requirements.html", "requirements"),
        ("Statistics", f"{prefix}docs/02-statistics.html", "statistics"),
        ("Submissions", f"{prefix}docs/03-submissions.html", "submissions"),
        ("Sources", f"{prefix}docs/04-source-map.html", "sources"),
        ("Checklist", f"{prefix}02-checklist.html", "checklist"),
    ]
    values = []
    for label, href, key in links:
        active = ' aria-current="page"' if key == current else ""
        values.append(f'<a href="{html.escape(href)}"{active}>{html.escape(label)}</a>')
    return '<nav class="portal-nav" aria-label="Project navigation">' + "".join(values) + "</nav>"


def title_from_markdown(text: str) -> str:
    match = re.search(r"(?m)^#\s+(.+)$", text)
    if not match:
        raise RuntimeError("Markdown document lacks a level-one heading")
    return match.group(1).strip()


def render_markdown(source: Path, target: Path, current: str, depth: int) -> None:
    markdown = source.read_text(encoding="utf-8")
    title = title_from_markdown(markdown)
    result = subprocess.run(
        ["pandoc", str(source), "--from=gfm+raw_html", "--to=html5"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    body = re.sub(r"<h1[^>]*>.*?</h1>", "", result.stdout, count=1, flags=re.S)
    body = re.sub(r'href="([^"#?]+)\.md([#?][^"]*)?"', r'href="\1.html\2"', body)
    css = "../" * depth + "assets/00-portal.css"
    page = f'''<!doctype html>
<html lang="en-NZ">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<link rel="stylesheet" href="{css}">
</head>
<body>
<header class="hero"><p class="eyebrow">Ashburton Tagalog · Working project portal</p><h1>{html.escape(title)}</h1><p>Evidence-backed working aid. Current official direction and original documents remain authoritative.</p></header>
{common_nav(depth, current)}
<main>{body}</main>
<p class="footer">Generated from <code>data/00-project.json</code>. This portal does not replace S-50, S-51, or current direction from the circuit overseer or branch office.</p>
</body>
</html>
'''
    target.write_text(page, encoding="utf-8")


def write_entry_alias() -> None:
    """Create the conventional, stable project entry point."""
    ENTRY_HTML.write_text(
        '''<!doctype html>
<html lang="en-NZ">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0; url=00-project-overview.html">
<link rel="canonical" href="00-project-overview.html">
<title>Ashburton Tagalog — New Congregation Project</title>
<link rel="stylesheet" href="assets/00-portal.css">
</head>
<body>
<main class="entry-card">
<p class="eyebrow">Ashburton Tagalog</p>
<h1>New Congregation Project</h1>
<p>Opening the project overview…</p>
<p><a class="button" href="00-project-overview.html">Open the project portal</a></p>
</main>
<script>location.replace("00-project-overview.html" + location.hash);</script>
</body>
</html>
''',
        encoding="utf-8",
    )


def dashboard(data: dict) -> str:
    unresolved = sum(1 for item in data["decisions"] if item["status"] == "unresolved")
    needs = sum(1 for item in data["requirements"] if item["status"] == "needs-confirmation")
    return f'''<div class="dashboard">
<div class="metric"><strong>{len(data['forms'])}</strong><span>form workstreams</span></div>
<div class="metric"><strong>{len(data['requirements'])}</strong><span>tracked instruction gates</span></div>
<div class="metric"><strong>{needs}</strong><span>S-50 items not yet confirmed</span></div>
<div class="metric"><strong>{unresolved}</strong><span>open control decisions</span></div>
</div>'''


def build_home(data: dict) -> str:
    project = data["project"]
    unresolved = [item for item in data["decisions"] if item["status"] == "unresolved"]
    key_stats = {item["id"]: item for item in data["statistics"]}
    lines = [
        f"# {project['name']}",
        "",
        dashboard(data),
        "",
        '<blockquote class="notice warning">',
        "",
        f"**Current control point:** {project['current_direction']}",
        "",
        f"**Next action:** {project['next_action']}",
        "",
        "</blockquote>",
        "",
        "<div class=\"actions screen-only\">",
        '<a class="button" href="02-checklist.html">Open the 78-item checklist</a>',
        '<a class="button" href="01-meeting-pack.pdf">Open the complete meeting pack</a>',
        '<a class="button secondary" href="09-S-51-Ashburton-Tagalog-signed.pdf">Open signed proposed S-51</a>',
        '<a class="button secondary" href="08-S-51_E-Ashburton-working.pdf">Open submitted Ashburton S-51</a>',
        "</div>",
        "",
        "## Start here",
        "",
        "1. [Forms register](docs/00-forms-register.md) — what each form is for, who needs it, its current version and status.",
        "2. [Requirements and evidence](docs/01-requirements.md) — every S-50 gate linked to the exact instruction text.",
        "3. [Statistics](docs/02-statistics.md) — printed facts, reported estimates, calculations and cautions.",
        "4. [Submissions and correspondence](docs/03-submissions.md) — what has been sent, requested and still needs review.",
        "5. [Source map](docs/04-source-map.md) — original PDFs, signed evidence, generated derivatives and hashes.",
        "6. [Persistent master checklist](02-checklist.html) — existing ticks, notes and JSON save workflow, preserved unchanged.",
        "",
        "## Present position",
        "",
        "| Workstream | Current position |",
        "|---|---|",
    ]
    for form in data["forms"]:
        lines.append(f"| **{form['code']} — {md_cell(form['title'])}** | {status(form['status'])} {md_cell(form['notes'])} |")
    lines.extend([
        "",
        "## Evidence at a glance",
        "",
        "| Measure | Figure | Evidence classification |",
        "|---|---:|---|",
    ])
    for item_id in ["aug-total", "aug-active", "aug-rp", "aug-elders", "aug-ms", "june-studies", "progressive-studies", "june-weekend", "june-midweek", "census-tagalog", "mid-canterbury-estimate"]:
        item = key_stats[item_id]
        lines.append(f"| {md_cell(item['label'])} | **{item['value']} {md_cell(item['unit'])}** | {md_cell(item['kind'])}; {md_cell(item['confidence'])} |")
    lines.extend([
        "",
        "## Decisions requiring confirmation",
        "",
    ])
    for item in unresolved:
        lines.append(f"- **{md_cell(item['question'])}** — {md_cell(item['basis'])}")
    lines.extend([
        "",
        '<blockquote class="notice danger">',
        "",
        "**Approval gate:** Both S-51 forms have been sent to the circuit overseer, and S-50 through par. 5 has been confirmed. S-50 par. 6 remains pending until the branch office communicates its decision, official start date, and further instructions.",
        "",
        "</blockquote>",
        "",
        "## Direct official references",
        "",
        "- [S-50 searchable reference](references/00-S-50-reference.html) · [official PDF](05-S-50_E.pdf)",
        "- [S-51 searchable reference](references/01-S-51-reference.html) · [official PDF](06-S-51_E.pdf)",
        "- [S-50 par. 2 requirements](references/00-S-50-reference.html#s50-p2)",
        "- [S-50 par. 5 recommendation package](references/00-S-50-reference.html#s50-p5)",
        "- [S-51 page 2 instructions](references/01-S-51-reference.html#s51-page-2-instructions)",
        "",
        "## Authority boundary",
        "",
        "This portal is an operational aid generated from local project evidence. It does not replace current official publications, branch direction, or the circuit overseer’s instructions. Figures marked *reported*, *estimated*, *calculated*, or *needs confirmation* must not be represented as verified printed facts.",
    ])
    return "\n".join(lines) + "\n"


def build_forms(data: dict) -> str:
    lines = [
        "# Forms Register",
        "",
        "> **Current sequence:** Both requested S-51 forms have been sent to the circuit overseer. S-50 through par. 5 is confirmed; par. 6 remains pending. This register shows the eventual S-50 package but does not imply that every remaining form should be sent now.",
        "",
        "| Form | Purpose | Required for / timing | Owner | Status | Working files |",
        "|---|---|---|---|---|---|",
    ]
    for item in data["forms"]:
        files = " · ".join(file_link(value["path"], "../") for value in item["files"])
        refs = ", ".join(source_link(value, "../") for value in item["source_references"])
        required = "; ".join(item["required_for"])
        lines.append(
            f"| **{item['code']} — {md_cell(item['title'])}**<br>{refs} | {md_cell(item['purpose'])} | "
            f"{md_cell(required)}<br><br>{md_cell(item['timing'])} | {md_cell(item['owner'])} | {status(item['status'])} | {files}<br><br>{md_cell(item['notes'])} |"
        )
    lines.extend([
        "",
        "## Current submission position",
        "",
        "1. The proposed Ashburton Tagalog S-51 has been sent to the circuit overseer.",
        "2. The separate Ashburton host-congregation S-51 has also been sent to him.",
        "3. S-50 through par. 5 is confirmed. Wait for the branch-office decision and instructions described in S-50 par. 6.",
        "4. Prepare or submit S-29, S-5, M-202, S-36 and S-6 only when current direction requires them.",
        "",
        "## Submitted S-51 record",
        "",
        "- **Proposed congregation:** submitted to Daniel Martin, Circuit NZ-1. Receipt of the first S-51 is evidenced by his request for the separate Ashburton form.",
        "- **Ashburton host congregation:** submitted to Daniel Martin, Circuit NZ-1, as requested.",
        "- **Recordkeeping:** exact send dates are not currently recorded in the local project files.",
    ])
    return "\n".join(lines) + "\n"


def build_requirements(data: dict) -> str:
    lines = [
        "# Requirements and Evidence",
        "",
        "> **Confirmed position:** S-50 through par. 5 has been confirmed. Par. 6 is the remaining approval stage and can be completed only when the branch office communicates its decision and instructions.",
        "",
        "| Requirement | Current evidence | Status / what remains |",
        "|---|---|---|",
    ]
    for item in data["requirements"]:
        ref = f"[S-50 {item['source_reference'].removeprefix('S-50 ')}](../references/00-S-50-reference.html#{item['source_anchor']})"
        evidence = "<br>".join(f"• {md_cell(value)}" for value in item["evidence"]) or "—"
        lines.append(f"| **{ref}**<br>{md_cell(item['requirement'])} | {evidence} | {status(item['status'])}<br>{md_cell(item['notes'])} |")
    lines.extend([
        "",
        "## What remains under S-50 par. 6",
        "",
        "Wait for the branch office to state whether the new congregation is approved. Its letter will provide the official start date and further instructions. Until that direction is received, do not begin functioning as a congregation or treat a proposed date as approved.",
    ])
    return "\n".join(lines) + "\n"


def build_statistics(data: dict) -> str:
    lines = [
        "# Statistics and Provenance",
        "",
        "## Source facts and reported figures",
        "",
        "| Measure | Value | As of | Classification | Source | Confidence / caution |",
        "|---|---:|---|---|---|---|",
    ]
    for item in data["statistics"]:
        source = "—"
        if item.get("source_file"):
            source = file_link(item["source_file"], "../") + f" — {md_cell(item.get('source_location'))}"
        if item.get("source_url"):
            source += f" · [source link]({item['source_url']})"
        caution = item.get("notes") or item["confidence"]
        lines.append(
            f"| {md_cell(item['label'])} | **{md_cell(item['value'])} {md_cell(item['unit'])}** | {md_cell(item.get('as_of'))} | "
            f"{md_cell(item['kind'])} | {source} | {md_cell(caution)} |"
        )
    lines.extend([
        "",
        "## Calculations",
        "",
        "| Calculation | Result | Formula | Caution |",
        "|---|---:|---|---|",
    ])
    for item in data["calculations"]:
        lines.append(f"| {md_cell(item['label'])} | **{item['value']} {md_cell(item['unit'])}** | `{md_cell(item['formula'])}` | {md_cell(item['caution'])} |")
    lines.extend([
        "",
        '<blockquote class="notice info">',
        "",
        "**Population evidence:** the 1,605 census figure is for Filipino ethnicity in Ashburton District; the 2.17% figure is language ability; the approximately 3,000 figure is an informed local estimate for the wider Mid Canterbury area. They are useful together only when their different measures and geographies remain explicit.",
        "",
        "</blockquote>",
    ])
    return "\n".join(lines) + "\n"


def build_submissions(data: dict) -> str:
    lines = [
        "# Submissions and Correspondence",
        "",
        "## Submission register",
        "",
        "| Package | Recipient | Date | Status | Attachments | Verification / next step |",
        "|---|---|---|---|---|---|",
    ]
    for item in data["submissions"]:
        files = " · ".join(file_link(value, "../") for value in item["attachments"])
        verification = item.get("verification") or item.get("notes") or "—"
        lines.append(f"| {md_cell(item['package'])} | {md_cell(item['recipient'])} | {md_cell(item['date'])} | {status(item['status'])} | {files} | {md_cell(verification)} |")
    lines.extend([
        "",
        "## Correspondence register",
        "",
        "| Direction | With | Subject | Status | Summary | Source |",
        "|---|---|---|---|---|---|",
    ])
    for item in data["correspondence"]:
        source = file_link(item["source"], "../") if item["source"].endswith((".md", ".html", ".pdf")) else md_cell(item["source"])
        lines.append(f"| {md_cell(item['direction'])} | {md_cell(item['with'])} | {md_cell(item['subject'])} | {status(item['status'])} | {md_cell(item['summary'])} | {source} |")
    lines.extend([
        "",
        "## External-action gate",
        "",
        "No portal button sends email, uploads a form, or submits a recommendation. Online automation remains read-only until a reviewed, exact action is separately authorised with an explicit confirmation and an independent verification step.",
    ])
    return "\n".join(lines) + "\n"


def build_source_map(data: dict, actual_hashes: dict[str, str]) -> str:
    lines = [
        "# Source Map and Integrity Register",
        "",
        "## Authority layers",
        "",
        "1. Official instructions and blank forms are controlling sources.",
        "2. Signed and returned documents are immutable evidence of what was actually prepared or received.",
        "3. Supporting proposal, S-303 and correspondence provide dated evidence and direction.",
        "4. `data/00-project.json` is the canonical working index.",
        "5. Markdown, HTML, PDF and searchable reference pages are generated working aids.",
        "",
        "## Local source register",
        "",
        "| Source | Kind | Revision/date | Integrity |",
        "|---|---|---|---|",
    ]
    for item in data["source_documents"]:
        digest = actual_hashes[item["path"]]
        immutable = "immutable" if item.get("immutable") else "working/mutable"
        revision = item.get("revision") or item.get("as_of")
        if not revision:
            revision = f"schema {item['schema_version']}" if item.get("schema_version") is not None else "not recorded"
        lines.append(f"| {file_link(item['path'], '../')} | {md_cell(item['kind'])} | {md_cell(revision)} | `{digest[:16]}…` · {immutable} |")
    lines.extend([
        "",
        "## Searchable official references",
        "",
        "- [S-50 deep-linked working edition](../references/00-S-50-reference.html) — anchors for paragraphs 1–6 and each numbered subitem.",
        "- [S-51 deep-linked working edition](../references/01-S-51-reference.html) — anchors for points 1–8 and page 2 instruction sections.",
        "",
        "These extracted pages support precise links. Always compare wording, layout, fields and signatures with the original PDF.",
        "",
        "## Generated derivatives",
        "",
        "- `index.html` — stable, conventional entry point for the project.",
        "- `00-project-overview.md/.html/.pdf` — portal home and printable summary.",
        "- `01-meeting-pack.md/.html/.pdf` — combined meeting document with every portal register.",
        "- `docs/00-forms-register`, then `docs/01-` through `docs/04-` — focused forms, requirements, statistics, submissions and source pages.",
        "- `references/00-S-50-reference.html` and `references/01-S-51-reference.html` — searchable source text.",
        "- `data/00-project.json` — canonical structured facts and workflow state.",
        "- `02-checklist.html` plus `03-checklist-progress.json` — preserved interactive progress tracker.",
    ])
    return "\n".join(lines) + "\n"


def meeting_section(markdown: str) -> str:
    body = re.sub(r"(?m)^#\s+[^\n]+\n?", "", markdown, count=1).strip()
    body = re.sub(r"(?m)^(#{2,5})(\s+)", lambda match: "#" + match.group(1) + match.group(2), body)
    return body.replace("](../", "](")


def build_meeting_pack(data: dict, actual_hashes: dict[str, str]) -> str:
    project = data["project"]
    sections = [
        ("Forms Register", build_forms(data)),
        ("Requirements and Evidence", build_requirements(data)),
        ("Statistics and Provenance", build_statistics(data)),
        ("Submissions and Correspondence", build_submissions(data)),
        ("Source Map and Integrity Register", build_source_map(data, actual_hashes)),
    ]
    lines = [
        f"# {project['name']} — Meeting Pack",
        "",
        dashboard(data),
        "",
        '<blockquote class="notice warning">',
        "",
        f"**Current control point:** {project['current_direction']}",
        "",
        f"**Next action:** {project['next_action']}",
        "",
        "</blockquote>",
        "",
        "This combined document is designed for review at a planning meeting. Use the [interactive portal](index.html) for navigation and the [persistent checklist](02-checklist.html) for ticks and notes.",
        "",
    ]
    for title, content in sections:
        lines.extend([f"## {title}", "", meeting_section(content), ""])
    return "\n".join(lines) + "\n"


def extracted_text(pdf: Path) -> str:
    result = subprocess.run(["pdftotext", str(pdf), "-"], check=True, capture_output=True, text=True)
    return result.stdout.replace("\r", "")


def anchor_for_line(code: str, page_number: int, line: str, state: dict) -> tuple[str | None, str | None]:
    stripped = line.strip()
    if code == "S-50":
        paragraph = re.match(r"^([1-6])\.\s", stripped)
        if paragraph:
            state["paragraph"] = paragraph.group(1)
            return f"s50-p{paragraph.group(1)}", f"S-50 par. {paragraph.group(1)}"
        item = re.match(r"^\(([1-7])\)\s", stripped)
        if item and state.get("paragraph") in {"2", "4", "5"}:
            anchor = f"s50-p{state['paragraph']}-item-{item.group(1)}"
            return anchor, f"S-50 par. {state['paragraph']}({item.group(1)})"
        headings = {
            "REQUIREMENTS FOR FORMING A NEW CONGREGATION": ("s50-requirements", "Requirements"),
            "ADDITIONAL CONSIDERATIONS": ("s50-considerations", "Considerations"),
            "SUBMITTING A RECOMMENDATION": ("s50-submitting", "Submitting"),
        }
        return headings.get(stripped, (None, None))
    if page_number == 1:
        point = re.match(r"^([1-8])\.\s", stripped)
        if point:
            return f"s51-point-{point.group(1)}", f"S-51 point {point.group(1)}"
    page_two = [
        ("INSTRUCTIONS", "s51-page-2-instructions", "Page 2 instructions"),
        ("Fill out the entire form", "s51-instructions-new", "New congregation"),
        ("Fill in only points 1-4", "s51-instructions-existing", "Existing involved congregation"),
        ("Fill in only point 1", "s51-instructions-name-only", "Name-only change"),
        ("Congregation name:", "s51-name-instructions", "Complete-name rules"),
        ("When a second congregation", "s51-name-existing", "Existing-name review"),
        ("In all cases where the primary language", "s51-name-language", "Foreign-language name"),
        ("If the reason for the name chosen", "s51-name-map", "Map explanation"),
    ]
    if page_number == 2:
        for start, anchor, label in page_two:
            if stripped.startswith(start):
                return anchor, label
    return None, None


def build_reference(code: str, source: Path, target: Path, revision: str) -> None:
    pages = extracted_text(source).split("\f")
    if pages and not pages[-1].strip():
        pages.pop()
    sections = []
    state: dict[str, str] = {}
    anchor_count = 0
    for page_number, page in enumerate(pages, 1):
        rendered = []
        for line in page.splitlines():
            anchor, label = anchor_for_line(code, page_number, line, state)
            escaped = html.escape(line)
            if anchor:
                anchor_count += 1
                rendered.append(
                    f'<span class="source-anchor" id="{anchor}" tabindex="-1">'
                    f'<a class="anchor-label" href="#{anchor}">{html.escape(label or anchor)}</a>{escaped}</span>'
                )
            else:
                rendered.append(escaped)
        sections.append(
            f'<section class="source-page" id="{code.lower().replace("-", "")}-page-{page_number}">'
            f'<h2>PDF page {page_number}</h2><p><a href="../{qpath(source.name)}#page={page_number}">Open this page in the official PDF</a></p>'
            f'<pre>{"\n".join(rendered)}</pre></section>'
        )
    title = "Instructions for Recommending New Congregations" if code == "S-50" else "Congregation Application/Information"
    quick = (
        '<a href="#s50-p2">Requirements</a><a href="#s50-p5">Recommendation package</a><a href="#s50-p6">Approval</a>'
        if code == "S-50"
        else '<a href="#s51-point-1">Points 1–4</a><a href="#s51-point-5">Points 5–8</a><a href="#s51-page-2-instructions">Page 2 instructions</a>'
    )
    page = f'''<!doctype html>
<html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{code} — {html.escape(title)}</title><link rel="stylesheet" href="../assets/00-portal.css"></head>
<body><header class="hero"><p class="eyebrow">{html.escape(revision)} · Searchable working edition</p><h1>{code} — {html.escape(title)}</h1><p>Text extracted locally for search and exact links. The official PDF remains authoritative for wording, layout, fields, annotations and signatures.</p></header>
{common_nav(1, "sources")}
<main><blockquote class="notice warning"><p><strong>Source boundary:</strong> This generated page does not replace the official PDF. Hyphenation and visual form elements may differ after text extraction.</p></blockquote>
<div class="actions">{quick}<a href="../{qpath(source.name)}">Official PDF</a></div>
<p class="source-meta"><span>{len(pages)} PDF pages</span><span>{anchor_count} stable anchors</span><span>Source hash <code>{sha256(source)[:16]}…</code></span></p>
{"".join(sections)}</main><p class="footer">Generated directly from {html.escape(source.name)}. Do not edit this page by hand.</p></body></html>
'''
    target.write_text(page, encoding="utf-8")


def print_pdf(html_path: Path, pdf_path: Path) -> None:
    chrome = os.environ.get("CHROME_BIN", "/usr/bin/google-chrome")
    with tempfile.TemporaryDirectory(prefix="forming-new-cong-render-") as profile:
        result = subprocess.run(
            [
                chrome,
                "--headless=new",
                "--disable-gpu",
                "--no-pdf-header-footer",
                f"--user-data-dir={profile}",
                f"--print-to-pdf={pdf_path}",
                html_path.resolve().as_uri(),
            ],
            capture_output=True,
            text=True,
        )
    if result.returncode != 0 or not pdf_path.exists():
        raise RuntimeError(f"Chrome PDF rendering failed: {result.stderr.strip()}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--no-pdf", action="store_true", help="Skip printing the portal home to PDF")
    args = parser.parse_args()
    data = load_data()
    hashes_before = verify_preserved_files(data)
    progress_hash = hashes_before[data["checklist"]["progress_json"]]
    DOCS_DIR.mkdir(exist_ok=True)
    REFS_DIR.mkdir(exist_ok=True)

    build_reference("S-50", ROOT / "05-S-50_E.pdf", REFS_DIR / "00-S-50-reference.html", "S-50-E 7/21")
    build_reference("S-51", ROOT / "06-S-51_E.pdf", REFS_DIR / "01-S-51-reference.html", "S-51-E 1/16")

    documents = [
        (ROOT_MD, ROOT_HTML, "home", 0, build_home(data)),
        (PACK_MD, PACK_HTML, "home", 0, build_meeting_pack(data, hashes_before)),
        (DOCS_DIR / "00-forms-register.md", DOCS_DIR / "00-forms-register.html", "forms", 1, build_forms(data)),
        (DOCS_DIR / "01-requirements.md", DOCS_DIR / "01-requirements.html", "requirements", 1, build_requirements(data)),
        (DOCS_DIR / "02-statistics.md", DOCS_DIR / "02-statistics.html", "statistics", 1, build_statistics(data)),
        (DOCS_DIR / "03-submissions.md", DOCS_DIR / "03-submissions.html", "submissions", 1, build_submissions(data)),
        (DOCS_DIR / "04-source-map.md", DOCS_DIR / "04-source-map.html", "sources", 1, build_source_map(data, hashes_before)),
    ]
    for markdown_path, html_path, current, depth, content in documents:
        markdown_path.write_text(content, encoding="utf-8")
        render_markdown(markdown_path, html_path, current, depth)
    write_entry_alias()

    if not args.no_pdf:
        print_pdf(ROOT_HTML, ROOT_PDF)
        print_pdf(PACK_HTML, PACK_PDF)

    hashes_after = verify_preserved_files(data)
    if hashes_after[data["checklist"]["progress_json"]] != progress_hash:
        raise RuntimeError("Checklist progress JSON changed during generation; refusing handoff.")
    print(f"Built index.html, {len(documents)} Markdown/HTML portal documents, 2 deep-reference pages" + (" and 2 PDFs." if not args.no_pdf else "."))
    print("Verified immutable source hashes and preserved checklist progress JSON.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
