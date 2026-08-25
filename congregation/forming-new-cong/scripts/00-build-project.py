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
from html.parser import HTMLParser
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
COMMS_MD = DOCS_DIR / "05-communications.md"
COMMS_HTML = DOCS_DIR / "05-communications.html"
SEARCH_HTML = ROOT / "search.html"
SEARCH_INDEX_JSON = ROOT / "search-index.json"
SEARCH_INDEX_JS = ROOT / "search-index.js"


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
        ("Search", f"{prefix}search.html", "search"),
        ("Forms", f"{prefix}docs/00-forms-register.html", "forms"),
        ("Requirements", f"{prefix}docs/01-requirements.html", "requirements"),
        ("Statistics", f"{prefix}docs/02-statistics.html", "statistics"),
        ("Submissions", f"{prefix}docs/03-submissions.html", "submissions"),
        ("Communications", f"{prefix}docs/05-communications.html", "communications"),
        ("Sources", f"{prefix}docs/04-source-map.html", "sources"),
        ("Checklist", f"{prefix}02-checklist.html", "checklist"),
    ]
    values = []
    for label, href, key in links:
        active = ' aria-current="page"' if key == current else ""
        values.append(f'<a href="{html.escape(href)}"{active}>{html.escape(label)}</a>')
    search = (
        f'<form class="nav-search" action="{prefix}search.html" method="get" role="search">'
        '<label class="sr-only" for="nav-search-input">Search the project portal</label>'
        '<input id="nav-search-input" name="q" type="search" placeholder="Search project" autocomplete="off">'
        '<button type="submit">Search</button></form>'
    )
    return '<nav class="portal-nav" aria-label="Project navigation"><div class="nav-links">' + "".join(values) + "</div>" + search + "</nav>"


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
        '<a class="button" href="docs/05-communications.html">Open communications</a>',
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
        "4. [Submissions](docs/03-submissions.md) — packages already sent and their verification state.",
        "5. [Communications](docs/05-communications.md) — Daniel Martin’s requests, attachments, replies, action status and next step.",
        "6. [Source map](docs/04-source-map.md) — original PDFs, signed evidence, generated derivatives and hashes.",
        "7. [Persistent master checklist](02-checklist.html) — existing ticks, notes and JSON save workflow, preserved unchanged.",
        "8. [Search](search.html) — search forms, requirements, statistics, communications, checklist items and official references.",
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
        "> **Current sequence:** Both S-51 forms have been sent. On 25 August 2026, the circuit overseer explicitly requested S-29, S-5, M-202, S-36 and S-6, together with the body’s recommendation(s) for the prospective coordinator. Par. 6 remains pending after this package is prepared and reviewed.",
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
        "3. On 25 August 2026, Daniel Martin requested S-29, S-5, M-202, S-36 and S-6 under S-50 par. 5.",
        "4. The body’s recommendation(s) for the prospective coordinator are also required as soon as possible.",
        "5. After the requested package is prepared and reviewed, await the branch-office decision and instructions described in S-50 par. 6.",
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
        "# Submissions",
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
        "## Communication summary",
        "",
        "| Date | Direction | With | Subject | Status | Action |",
        "|---|---|---|---|---|---|",
    ])
    for item in data["correspondence"]:
        lines.append(f"| {md_cell(item['date'])} | {md_cell(item['direction'])} | {md_cell(item['with'])} | [{md_cell(item['subject'])}](05-communications.html#{item['id']}) | {status(item['status'])} | {md_cell(item.get('action') or item['summary'])} |")
    lines.extend([
        "",
        "[Open the complete communications register](05-communications.html) for full email text, attachments, replies and action notes.",
        "",
        "## External-action gate",
        "",
        "No portal button sends email, uploads a form, or submits a recommendation. Online automation remains read-only until a reviewed, exact action is separately authorised with an explicit confirmation and an independent verification step.",
    ])
    return "\n".join(lines) + "\n"


def communication_timestamp(item: dict) -> str:
    return f"{item['date']} {item.get('time', '')}".strip()


def build_communications_markdown(data: dict) -> str:
    lines = [
        "# Communications",
        "",
        "> **Working register:** Received messages are evidence of current direction. A reply or acknowledgement does not mean that the requested forms or information have been completed.",
        "",
        "| Date/time | Direction | Subject | Status | Current action |",
        "|---|---|---|---|---|",
    ]
    records = sorted(data["correspondence"], key=communication_timestamp)
    for item in records:
        date_time = communication_timestamp(item)
        lines.append(
            f"| {md_cell(date_time)} | {md_cell(item['direction'])} | [{md_cell(item['subject'])}](#{item['id']}) | "
            f"{status(item['status'])} | {md_cell(item.get('action') or item['summary'])} |"
        )
    for item in records:
        lines.extend([
            "",
            f'<div id="{item["id"]}"></div>',
            "",
            f"## {item['date']} — {item['subject']}",
            "",
            f"- **Direction:** {item['direction'].title()}",
            f"- **With:** {item['with']}",
            f"- **Status:** {status(item['status'])}",
            f"- **Summary:** {item['summary']}",
            f"- **Current action:** {item.get('action') or 'No further action recorded.'}",
        ])
        if item.get("references"):
            lines.append(f"- **References:** {', '.join(item['references'])}")
        if item.get("attachments"):
            attachments = " · ".join(file_link(value, "../") for value in item["attachments"])
            lines.append(f"- **Attachments:** {attachments}")
        source = item.get("source", "")
        if source.endswith((".md", ".html", ".pdf", ".docx")):
            source = file_link(source, "../")
        lines.append(f"- **Evidence source:** {source or '—'}")
        if item.get("reply"):
            reply = item["reply"]
            lines.append(
                f"- **Reply:** {reply['date']} {reply.get('time', '')} — {status(reply['status'])} {reply['summary']}"
            )
        if item.get("body"):
            quoted = "\n> ".join(item["body"].splitlines())
            lines.extend(["", "### Substantive email text", "", f"> {quoted}"])
    lines.extend([
        "",
        "## External-action gate",
        "",
        "This register does not send email or submit attachments. Completion, review and explicit authorisation are required before any external action.",
    ])
    return "\n".join(lines) + "\n"


def write_communications_html(data: dict) -> None:
    groups = data.get("communication_groups", [])
    records_by_group = {group["id"]: [] for group in groups}
    for item in sorted(data["correspondence"], key=communication_timestamp):
        records_by_group.setdefault(item.get("group", "other"), []).append(item)

    tree_groups = []
    for group in groups:
        records = records_by_group.get(group["id"], [])
        pending = sum(item["status"] in {"action-required", "needs-confirmation", "not-started", "draft"} for item in records)
        links = []
        for item in records:
            search_value = " ".join(
                [item["subject"], item["with"], item["direction"], item["status"], item["summary"], item.get("action", ""), " ".join(item.get("references", []))]
            ).lower()
            links.append(
                f'<a class="comm-select" href="#{html.escape(item["id"])}" data-target="{html.escape(item["id"])}" '
                f'data-search="{html.escape(search_value)}"><span>{html.escape(item["subject"])}</span>'
                f'<small>{html.escape(communication_timestamp(item))} · {html.escape(item["direction"].title())}</small>'
                f'<b class="status-mini {html.escape(item["status"])}">{html.escape(item["status"].replace("-", " ").title())}</b></a>'
            )
        tree_groups.append(
            f'<details class="comm-group" data-group="{html.escape(group["id"])}" open><summary><span>'
            f'<strong>{html.escape(group["label"])}</strong><small>{html.escape(group["description"])}</small></span>'
            f'<b>{pending} pending</b></summary><div class="comm-children">{"".join(links)}</div></details>'
        )

    cards = []
    for item in sorted(data["correspondence"], key=communication_timestamp):
        attachments = []
        for filename in item.get("attachments", []):
            target = ROOT / filename
            available = target.exists()
            attachments.append(
                f'<li class="{"ready" if available else "missing"}"><a href="../{qpath(filename)}">{html.escape(Path(filename).name)}</a>'
                f'<span>{"Available" if available else "Missing"}</span></li>'
            )
        references = []
        for reference in item.get("references", []):
            if reference.startswith("S-50 par. 5"):
                references.append('<a href="../references/00-S-50-reference.html#s50-p5">S-50 par. 5</a>')
            else:
                references.append(html.escape(reference))
        source = item.get("source", "—")
        if source.endswith((".md", ".html", ".pdf", ".docx")):
            source_html = f'<a href="../{qpath(source)}">{html.escape(Path(source).name)}</a>'
        else:
            source_html = html.escape(source)
        body = ""
        if item.get("body"):
            body_text = html.escape(item["body"]).replace("\n", "<br>\n")
            body = f'<details open><summary>Substantive email text</summary><div class="email-body">{body_text}</div></details>'
        reply = ""
        if item.get("reply"):
            value = item["reply"]
            reply = (
                f'<div class="reply-record"><strong>Reply recorded</strong><span>{html.escape(value["date"])} '
                f'{html.escape(value.get("time", ""))} · {status(value["status"])}</span><p>{html.escape(value["summary"])}</p></div>'
            )
        cards.append(
            f'''<article class="comm-detail" id="{html.escape(item['id'])}" data-status="{html.escape(item['status'])}">
<header><div><p class="eyebrow">{html.escape(item['direction'])} communication</p><h2>{html.escape(item['subject'])}</h2></div>{status(item['status'])}</header>
<dl><dt>Date/time</dt><dd>{html.escape(communication_timestamp(item))}</dd><dt>With</dt><dd>{html.escape(item['with'])}</dd><dt>Direction</dt><dd>{html.escape(item['direction'].title())}</dd><dt>References</dt><dd>{' · '.join(references) or '—'}</dd><dt>Evidence source</dt><dd>{source_html}</dd></dl>
<p>{html.escape(item['summary'])}</p><p class="record-note"><strong>Current action:</strong> {html.escape(item.get('action') or 'No further action recorded.')}</p>
{reply}
<details open><summary>Attachments <span>{len(attachments)}</span></summary><ul class="attachments">{''.join(attachments) or '<li>None</li>'}</ul></details>
{body}
</article>'''
        )

    pending_total = sum(item["status"] in {"action-required", "needs-confirmation", "not-started", "draft"} for item in data["correspondence"])
    page = f'''<!doctype html>
<html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Communications — Ashburton Tagalog</title><link rel="stylesheet" href="../assets/00-portal.css"></head>
<body><header class="hero"><p class="eyebrow">Ashburton Tagalog · Working project portal</p><h1>Communications</h1><p>Daniel Martin correspondence, attachments, replies and action status. Mailbox inspection is read-only; this page sends nothing.</p></header>
{common_nav(1, 'communications')}
<main><blockquote class="notice warning"><p><strong>{pending_total} communication workstream(s) need action or confirmation.</strong> Acknowledging an email does not mean its requested form or package is complete.</p></blockquote>
<div class="comm-shell"><aside class="comm-sidebar"><h2>Communication tree</h2><input class="comm-search" id="comm-search" type="search" placeholder="Search subject, status or action" aria-label="Filter communications">{''.join(tree_groups)}</aside><div class="comm-content">{''.join(cards)}</div></div></main>
<p class="footer">Generated from <code>data/00-project.json</code>. This register does not replace the original email, attachment or current direction.</p>
<script>(()=>{{const links=[...document.querySelectorAll('.comm-select')],cards=[...document.querySelectorAll('.comm-detail')],groups=[...document.querySelectorAll('.comm-group')],search=document.getElementById('comm-search');function show(id,push=false){{const target=document.getElementById(id);if(!target)return;links.forEach(link=>link.classList.toggle('active',link.dataset.target===id));cards.forEach(card=>card.classList.toggle('active',card.id===id));const link=links.find(item=>item.dataset.target===id);if(link)link.closest('.comm-group').open=true;if(push&&location.hash!=='#'+id)history.pushState(null,'','#'+id)}}links.forEach(link=>link.addEventListener('click',event=>{{event.preventDefault();show(link.dataset.target,true)}}));function route(){{const id=location.hash.slice(1);show(document.getElementById(id)?.classList.contains('comm-detail')?id:links[links.length-1].dataset.target)}}addEventListener('hashchange',route);search.addEventListener('input',()=>{{const terms=search.value.toLowerCase().trim().split(/\\s+/).filter(Boolean);links.forEach(link=>link.hidden=!terms.every(term=>link.dataset.search.includes(term)));groups.forEach(group=>{{const visible=group.querySelector('.comm-select:not([hidden])');group.hidden=!visible;if(terms.length&&visible)group.open=true}})}});route()}})();</script></body></html>'''
    COMMS_HTML.write_text(page, encoding="utf-8")


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
        "- `docs/05-communications.md/.html` — communication timeline, full substantive email text, attachments and workflow status.",
        "- `search.html`, `search-index.json` and `search-index.js` — local browser-side portal search.",
        "- `references/00-S-50-reference.html` and `references/01-S-51-reference.html` — searchable source text.",
        "- `data/00-project.json` — canonical structured facts and workflow state.",
        "- `02-checklist.html` plus `03-checklist-progress.json` — preserved interactive progress tracker.",
    ])
    return "\n".join(lines) + "\n"


def meeting_section(markdown: str) -> str:
    body = re.sub(r"(?m)^#\s+[^\n]+\n?", "", markdown, count=1).strip()
    body = re.sub(r"(?m)^(#{2,5})(\s+)", lambda match: "#" + match.group(1) + match.group(2), body)
    body = body.replace("](05-communications.html", "](docs/05-communications.html")
    return body.replace("](../", "](")


def build_meeting_pack(data: dict, actual_hashes: dict[str, str]) -> str:
    project = data["project"]
    sections = [
        ("Forms Register", build_forms(data)),
        ("Requirements and Evidence", build_requirements(data)),
        ("Statistics and Provenance", build_statistics(data)),
        ("Submissions", build_submissions(data)),
        ("Communications", build_communications_markdown(data)),
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


def clean_search_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\u00ad", "").replace("\uf0a8", " ").replace("\uf0fe", " ")).strip()


class PortalSearchParser(HTMLParser):
    block_tags = {"p", "li", "td", "dd", "dt", "summary", "blockquote", "pre"}
    skip_tags = {"nav", "script", "style", "form"}
    void_tags = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

    def __init__(self, source: dict):
        super().__init__()
        self.source = source
        self.entries: list[dict] = []
        self.heading = source["title"]
        self.heading_id = ""
        self.skip = 0
        self.capture: str | None = None
        self.capture_depth = 0
        self.capture_buffer: list[str] = []
        self.capture_id = ""
        self.capture_tag = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag in self.skip_tags:
            self.skip += 1
            return
        if self.skip:
            return
        if self.capture:
            if tag not in self.void_tags:
                self.capture_depth += 1
            return
        classes = set((values.get("class") or "").split())
        if tag in {"h1", "h2", "h3", "h4"}:
            self.capture = "heading"
        elif tag in self.block_tags or classes.intersection({"task-title", "task-detail", "gate", "record-note"}):
            self.capture = "block"
        else:
            return
        self.capture_depth = 1
        self.capture_buffer = []
        self.capture_id = values.get("id") or ""
        self.capture_tag = tag

    def handle_endtag(self, tag: str) -> None:
        if tag in self.skip_tags and self.skip:
            self.skip -= 1
            return
        if self.skip or not self.capture:
            return
        if tag not in self.void_tags:
            self.capture_depth -= 1
        if self.capture_depth > 0:
            return
        text = clean_search_text("".join(self.capture_buffer))
        if self.capture == "heading":
            if text:
                self.heading = text
                self.heading_id = self.capture_id
        elif len(text) >= 14:
            anchor = self.capture_id or self.heading_id
            url = self.source["url"] + (f"#{anchor}" if anchor else "")
            words = text.split()
            passages = [text] if self.capture_tag != "pre" or len(words) <= 130 else [" ".join(words[start:start + 130]) for start in range(0, len(words), 100)]
            for passage in passages:
                self.entries.append({
                    "id": f"{self.source['id']}-{len(self.entries) + 1}",
                    "sourceId": self.source["id"],
                    "source": self.source["name"],
                    "type": self.source["type"],
                    "title": self.heading,
                    "reference": self.heading,
                    "url": url,
                    "text": passage,
                    "priority": self.source["priority"],
                })
        self.capture = None
        self.capture_depth = 0
        self.capture_buffer = []
        self.capture_id = ""
        self.capture_tag = ""

    def handle_data(self, value: str) -> None:
        if self.capture and not self.skip:
            self.capture_buffer.append(value)


def write_search_page() -> None:
    page = f'''<!doctype html>
<html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Search — Ashburton Tagalog Project</title><link rel="stylesheet" href="assets/00-portal.css"><script src="search-index.js" defer></script><script src="assets/01-search.js" defer></script></head>
<body><header class="hero"><p class="eyebrow">Ashburton Tagalog · Working project portal</p><h1>Search the project</h1><p>Search forms, requirements, statistics, communications, checklist items and deep-linked S-50/S-51 references.</p></header>
{common_nav(0, 'search')}
<main class="search-page"><form class="search-panel" id="search-form" role="search"><label for="search-input">Search words or an exact phrase</label><div class="search-row"><input id="search-input" type="search" placeholder="Try S-29, Daniel Martin, baptized, or par. 5" autocomplete="off" autofocus><button type="submit">Search</button></div><div class="search-options"><label for="search-type">Limit to</label><select id="search-type"><option value="">All project sources</option><option value="communications">Communications</option><option value="official">Official references</option><option value="forms">Forms and submissions</option><option value="checklist">Checklist</option><option value="portal">Project guidance</option></select><span id="search-meta"></span></div></form><p class="search-status" id="search-status" aria-live="polite"></p><div class="search-empty" id="search-empty"><h2>One search box for the whole project</h2><p>Use ordinary words, a form code, a name, or an exact phrase in quotation marks. Press <kbd>/</kbd> anywhere on this page to focus the search box.</p></div><div class="search-results" id="search-results"></div></main>
<p class="footer">The index is built only from local project files. Search results are working aids and do not replace the official source.</p></body></html>'''
    SEARCH_HTML.write_text(page, encoding="utf-8")


def build_search_index() -> None:
    sources = [
        {"id": "communications", "name": "Communications", "title": "Daniel Martin correspondence and action status", "type": "communications", "priority": 0, "path": COMMS_HTML, "url": "docs/05-communications.html"},
        {"id": "s50", "name": "S-50", "title": "Instructions for Recommending New Congregations", "type": "official", "priority": 1, "path": REFS_DIR / "00-S-50-reference.html", "url": "references/00-S-50-reference.html"},
        {"id": "s51", "name": "S-51", "title": "Congregation Application/Information", "type": "official", "priority": 2, "path": REFS_DIR / "01-S-51-reference.html", "url": "references/01-S-51-reference.html"},
        {"id": "forms", "name": "Forms", "title": "Forms register", "type": "forms", "priority": 3, "path": DOCS_DIR / "00-forms-register.html", "url": "docs/00-forms-register.html"},
        {"id": "submissions", "name": "Submissions", "title": "Submission register", "type": "forms", "priority": 4, "path": DOCS_DIR / "03-submissions.html", "url": "docs/03-submissions.html"},
        {"id": "requirements", "name": "Requirements", "title": "Requirements and evidence", "type": "portal", "priority": 5, "path": DOCS_DIR / "01-requirements.html", "url": "docs/01-requirements.html"},
        {"id": "statistics", "name": "Statistics", "title": "Statistics and provenance", "type": "portal", "priority": 6, "path": DOCS_DIR / "02-statistics.html", "url": "docs/02-statistics.html"},
        {"id": "checklist", "name": "Checklist", "title": "Forming a New Congregation checklist", "type": "checklist", "priority": 7, "path": ROOT / "02-checklist.html", "url": "02-checklist.html"},
        {"id": "overview", "name": "Overview", "title": "Project overview", "type": "portal", "priority": 8, "path": ROOT_HTML, "url": "00-project-overview.html"},
        {"id": "sources", "name": "Sources", "title": "Source map and integrity register", "type": "portal", "priority": 9, "path": DOCS_DIR / "04-source-map.html", "url": "docs/04-source-map.html"},
    ]
    entries = []
    for source in sources:
        parser = PortalSearchParser(source)
        source_text = source["path"].read_text(encoding="utf-8")
        parser.feed(source_text)
        entries.extend(parser.entries)
        if source["id"] == "checklist":
            item_pattern = re.compile(
                r'\{\s*id:\s*"([^"]+)",\s*ref:\s*"([^"]+)",\s*title:\s*"([^"]+)"(?:,\s*detail:\s*"([^"]*)")?\s*\}'
            )
            for item_id, reference, title, detail in item_pattern.findall(source_text):
                entries.append({
                    "id": f"checklist-{item_id}",
                    "sourceId": "checklist",
                    "source": "Checklist",
                    "type": "checklist",
                    "title": f"Checklist — {reference}",
                    "reference": reference,
                    "url": "02-checklist.html",
                    "text": clean_search_text(f"{title} {detail}"),
                    "priority": source["priority"],
                })
    seen = set()
    unique = []
    for entry in entries:
        key = (entry["url"], entry["text"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(entry)
    public_sources = [{key: source[key] for key in ("id", "name", "title", "type", "priority")} for source in sources]
    payload = {"version": 1, "entries": unique, "sources": public_sources}
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    SEARCH_INDEX_JSON.write_text(compact + "\n", encoding="utf-8")
    SEARCH_INDEX_JS.write_text(f"window.FORMING_CONG_SEARCH_INDEX={compact};\n", encoding="utf-8")


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
    COMMS_MD.write_text(build_communications_markdown(data), encoding="utf-8")
    write_communications_html(data)
    write_search_page()
    build_search_index()
    write_entry_alias()

    if not args.no_pdf:
        print_pdf(ROOT_HTML, ROOT_PDF)
        print_pdf(PACK_HTML, PACK_PDF)

    hashes_after = verify_preserved_files(data)
    if hashes_after[data["checklist"]["progress_json"]] != progress_hash:
        raise RuntimeError("Checklist progress JSON changed during generation; refusing handoff.")
    print(f"Built index.html, search, {len(documents) + 1} Markdown/HTML portal documents, 2 deep-reference pages" + (" and 2 PDFs." if not args.no_pdf else "."))
    print("Verified immutable source hashes and preserved checklist progress JSON.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
