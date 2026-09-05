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
ORG_MD = DOCS_DIR / "06-organisation-chart.md"
ORG_HTML = DOCS_DIR / "06-organisation-chart.html"
ORG_PDF = DOCS_DIR / "06-organisation-chart.pdf"
START_MD = DOCS_DIR / "07-congregation-start-checklist.md"
START_HTML = DOCS_DIR / "07-congregation-start-checklist.html"
START_PDF = DOCS_DIR / "07-congregation-start-checklist.pdf"
AGENDA_MD = DOCS_DIR / "08-preparation-meeting-agenda.md"
AGENDA_HTML = DOCS_DIR / "08-preparation-meeting-agenda.html"
AGENDA_PDF = DOCS_DIR / "08-preparation-meeting-agenda.pdf"
PIONEER_MD = DOCS_DIR / "09-regular-pioneer-review.md"
PIONEER_HTML = DOCS_DIR / "09-regular-pioneer-review.html"
PIONEER_PDF = DOCS_DIR / "09-regular-pioneer-review.pdf"
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


def validate_checklist_contract(data: dict) -> None:
    """Keep canonical launch tasks, the interactive tracker and saved progress aligned."""
    source = (ROOT / data["checklist"]["html"]).read_text(encoding="utf-8")
    item_ids = re.findall(r'\{\s*id:\s*"([^"]+)",\s*ref:', source)
    unique_ids = set(item_ids)
    expected = data["checklist"]["known_item_count"]
    failures = []
    if len(item_ids) != len(unique_ids):
        failures.append("interactive checklist contains duplicate item IDs")
    if len(unique_ids) != expected:
        failures.append(f"interactive checklist has {len(unique_ids)} items; canonical count is {expected}")
    startup_ids = {item["id"] for phase in data["startup"]["phases"] for item in phase["items"]}
    missing = sorted(startup_ids - unique_ids)
    if missing:
        failures.append("startup tasks missing from interactive checklist: " + ", ".join(missing))
    progress = json.loads((ROOT / data["checklist"]["progress_json"]).read_text(encoding="utf-8"))
    if progress.get("knownItemCount") != expected:
        failures.append("saved progress item count does not match canonical count")
    stale = sorted((set(progress.get("checks", {})) | set(progress.get("notes", {}))) - unique_ids)
    if stale:
        failures.append("saved progress contains unknown task IDs: " + ", ".join(stale))
    if failures:
        raise RuntimeError("Checklist-contract validation failed:\n- " + "\n- ".join(failures))


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
        ("Roles", f"{prefix}docs/06-organisation-chart.html", "organisation"),
        ("Start", f"{prefix}docs/07-congregation-start-checklist.html", "startup"),
        ("Agenda", f"{prefix}docs/08-preparation-meeting-agenda.html", "agenda"),
        ("Pioneers", f"{prefix}docs/09-regular-pioneer-review.html", "pioneers"),
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
<body class="page-{html.escape(current)}">
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
    roles = [role for group in data["organisation"]["groups"] for role in group["roles"]]
    confirmed_roles = sum(role["status"] == "confirmed" for role in roles)
    open_roles = sum(role["status"] == "to-fill" for role in roles)
    return f'''<div class="dashboard">
<div class="metric"><strong>{len(data['forms'])}</strong><span>form workstreams</span></div>
<div class="metric"><strong>{len(data['requirements'])}</strong><span>tracked instruction gates</span></div>
<div class="metric"><strong>{confirmed_roles}</strong><span>confirmed role assignments</span></div>
<div class="metric"><strong>{open_roles}</strong><span>roles or rosters to fill</span></div>
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
        f'<a class="button" href="02-checklist.html">Open the {data["checklist"]["known_item_count"]}-item checklist</a>',
        '<a class="button" href="docs/06-organisation-chart.html">Open the role chart</a>',
        '<a class="button" href="docs/06-organisation-chart.html#oversight-view">Open the oversight view</a>',
        '<a class="button" href="docs/07-congregation-start-checklist.html">Open the congregation start checklist</a>',
        '<a class="button" href="docs/08-preparation-meeting-agenda.html">Open the preparation-meeting agenda</a>',
        '<a class="button" href="docs/09-regular-pioneer-review.html">Open the regular-pioneer review topic</a>',
        '<a class="button" href="docs/05-communications.html">Open communications</a>',
        '<a class="button" href="01-meeting-pack.pdf">Open the complete meeting pack</a>',
        '<a class="button secondary" href="27-AUS2824311_1.pdf">Open branch approval letter</a>',
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
        "6. [Organisation chart](docs/06-organisation-chart.md) — congregation roles, confirmed names and vacancies to fill.",
        "7. [Congregation start checklist](docs/07-congregation-start-checklist.md) — what must be ready before 1 November, what happens at launch, and conditional legal/financial work.",
        "8. [Preparation-meeting agenda](docs/08-preparation-meeting-agenda.md) — a timed informal agenda, proposed-role worksheet and action register.",
        "9. [Regular-pioneer review](docs/09-regular-pioneer-review.md) — elders’ working topic on hour shortfalls, assistance, exceptions, decisions and transfers.",
        "10. [Source map](docs/04-source-map.md) — original PDFs, signed evidence, generated derivatives and hashes.",
        "11. [Persistent master checklist](02-checklist.html) — existing ticks and notes plus the branch launch actions.",
        "12. [Search](search.html) — search forms, requirements, statistics, communications, roles, checklist items and official references.",
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
        '<blockquote class="notice success">',
        "",
        "**Approved:** The official name is **Ashburton Tagalog Congregation of Jehovah’s Witnesses, Ashburton, New Zealand**. Congregation **3814** begins functioning **1 November 2026** in **Circuit NZ-2** under **Anthony Radi**. The confidential launch instructions are now the controlling workstream.",
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
        "> **Current sequence:** The recommendation package was submitted and the branch approved congregation 3814 on 2 September 2026. These forms are now the evidence record for the approved congregation and its 1 November 2026 launch.",
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
        "5. The requested package was submitted on 30 August 2026, and the branch approval and launch instructions were received on 2 September 2026.",
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
        "> **Confirmed position:** All S-50 gates, including par. 6, are confirmed. The official approval letter sets 1 November 2026 as the start date and supplies the transition instructions.",
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
        "## S-50 par. 6 outcome",
        "",
        "The branch approved the congregation on 2 September 2026. Congregation 3814 begins functioning on 1 November 2026 in Circuit NZ-2. The remaining work is implementation of the confidential postscript, not further approval.",
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


def build_organisation(data: dict) -> str:
    organisation = data["organisation"]
    groups = organisation["groups"]
    eligibility = organisation["eligibility"]
    eligibility_by_id = {item["id"]: item for item in eligibility["legend"]}
    role_categories = eligibility["role_categories"]
    roles = [role for group in groups for role in group["roles"]]
    roles_by_id = {role["id"]: role for role in roles}
    oversight = organisation["oversight"]
    confirmed = sum(role["status"] == "confirmed" for role in roles)
    to_fill = sum(role["status"] == "to-fill" for role in roles)
    optional = sum(role["status"] == "if-needed" for role in roles)
    lines = [
        "# Congregation Organisation Chart",
        "",
        '<div class="org-summary">',
        f'<div><strong>{confirmed}</strong><span>confirmed</span></div>',
        f'<div><strong>{to_fill}</strong><span>to fill</span></div>',
        f'<div><strong>{optional}</strong><span>if needed</span></div>',
        '<div><strong>1 Nov 2026</strong><span>begins functioning</span></div>',
        "</div>",
        "",
        '<div class="eligibility-legend" aria-label="Ministerial servant eligibility legend">',
    ]
    for item in eligibility["legend"]:
        lines.append(
            f'<span class="eligibility-badge {item["id"]}" title="{html.escape(item["label"])}">'
            f'<b>{html.escape(item["symbol"])}</b><small>{html.escape(item["label"])}</small></span>'
        )
    lines.extend([
        "</div>",
        "",
        '<blockquote class="notice info">',
        "",
        f"**Planning boundary:** {organisation['scope_note']}",
        "",
        "</blockquote>",
        "",
        '<div class="org-chart">',
        '<div class="org-root"><span>Ashburton Tagalog Congregation</span><strong>3814 · Circuit NZ-2</strong><small>Effective 1 November 2026</small></div>',
        '<div class="org-trunk" aria-hidden="true"></div>',
        '<div class="org-columns">',
    ])
    for group in groups:
        lines.extend([
            f'<section class="org-branch" id="{group["id"]}">',
            f'<header><h2>{html.escape(group["title"])}</h2><p>{html.escape(group["description"])}</p></header>',
            '<div class="org-role-list">',
        ])
        for role in group["roles"]:
            label = role["status"].replace("-", " ").title()
            eligibility_id = role_categories[role["id"]]
            role_eligibility = eligibility_by_id[eligibility_id]
            lines.extend([
                f'<article class="org-card {role["status"]}" id="role-{role["id"]}">',
                f'<div class="org-card-top"><span class="org-role-status">{html.escape(label)}</span>'
                f'<span class="eligibility-badge compact {eligibility_id}" title="{html.escape(role_eligibility["label"])}">'
                f'{html.escape(role_eligibility["symbol"])}</span><small>{html.escape(role["reference"])}</small></div>',
                f'<h3>{html.escape(role["title"])}</h3>',
                f'<strong class="org-name">{html.escape(role["name"])}</strong>',
                f'<p>{html.escape(role["note"])}</p>',
                '</article>',
            ])
        lines.extend(['</div>', '</section>'])
    lines.extend([
        "</div>",
        "</div>",
        "",
        "## Oversight and responsibility view",
        "",
        '<section class="oversight-view" id="oversight-view">',
        f'<div class="oversight-principle"><strong>{html.escape(oversight["title"])}</strong><p>{html.escape(oversight["principle"])}</p></div>',
        '<div class="oversight-top">',
        f'<div class="oversight-root"><span>{html.escape(oversight["root"]["subtitle"])}</span><strong>{html.escape(oversight["root"]["title"])}</strong><small>{html.escape(oversight["root"]["reference"])}</small></div>',
        f'<div class="appointment-note">{html.escape(oversight["appointment_note"])}</div>',
        '</div>',
        '<div class="oversight-connector" aria-hidden="true"></div>',
        '<div class="service-committee-map">',
        f'<div><span>{html.escape(oversight["service_committee"]["title"])}</span><strong>'
        + " · ".join(html.escape(roles_by_id[role_id]["title"]) for role_id in oversight["service_committee"]["members"])
        + f'</strong><small>{html.escape(oversight["service_committee"]["note"])} · {html.escape(oversight["service_committee"]["reference"])}</small></div>',
        '</div>',
        '<div class="oversight-lanes">',
    ])
    for lane in oversight["lanes"]:
        owner_status = ""
        if lane.get("owner_role_id"):
            owner_role = roles_by_id[lane["owner_role_id"]]
            owner_status = status(owner_role["status"])
        lines.extend([
            f'<section class="oversight-lane" id="{html.escape(lane["id"])}">',
            f'<header><span>{html.escape(lane["reference"])}</span><h3>{html.escape(lane["title"])}</h3><strong>{html.escape(lane["name"])}</strong>{owner_status}</header>',
            '<div class="oversight-items">',
        ])
        for item in lane["items"]:
            title_value = html.escape(item["title"])
            title_html = f'<a href="#role-{html.escape(item["role_id"])}">{title_value}</a>' if item.get("role_id") else f'<span>{title_value}</span>'
            lines.append(
                f'<article><div>{title_html}<b>{html.escape(item["relationship"])}</b></div>'
                f'<small>{html.escape(item["reference"])}</small></article>'
            )
        lines.extend(['</div>', '</section>'])
    lines.extend([
        '</div>',
        '<div class="oversight-clarifications"><h3>How to read the lines</h3><ul>',
    ])
    for note in oversight["clarifications"]:
        lines.append(f'<li>{html.escape(note)}</li>')
    lines.extend([
        '</ul></div>',
        '</section>',
        "",
        "## Assignment register",
        "",
        "| Area | Role | Name | Status | MS eligibility | Reference | Notes |",
        "|---|---|---|---|---|---|---|",
    ])
    for group in groups:
        for role in group["roles"]:
            eligibility_id = role_categories[role["id"]]
            role_eligibility = eligibility_by_id[eligibility_id]
            lines.append(
                f"| {md_cell(group['title'])} | **{md_cell(role['title'])}** | {md_cell(role['name'])} | "
                f"{status(role['status'])} | <span class=\"eligibility-badge compact {eligibility_id}\" title=\"{html.escape(role_eligibility['label'])}\">{html.escape(role_eligibility['symbol'])}</span> | "
                f"{md_cell(role['reference'])} | {md_cell(role['note'])} |"
            )
    lines.extend([
        "",
        "## Important launch notes",
        "",
        "- Adamson dela Cruz and Dave Asuncion are the only names currently recorded as confirmed in this chart.",
        "- The service overseer is the first vacancy to settle because that assignment completes the Congregation Service Committee.",
        "- The branch letter says S-62 recommendations are submitted after the new congregation begins functioning for elders and ministerial servants who transfer. No S-62 is needed for the brothers assigned as coordinator and secretary.",
        "- Because the Kingdom Hall is shared, the chart records a Kingdom Hall Operating Committee representative or liaison, not a separate maintenance coordinator for the new congregation.",
        "- Public talk chairmen and Watchtower readers are rosters, not single offices; additional assistants are assigned only if needed.",
        "",
        "## Ministerial-servant eligibility notes",
        "",
    ])
    for note in eligibility["notes"]:
        lines.append(f"- {note}")
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
<body><header class="hero"><p class="eyebrow">Ashburton Tagalog · Working project portal</p><h1>Communications</h1><p>Circuit-overseer and branch correspondence, attachments, replies and action status. Mailbox inspection is read-only; this page sends nothing.</p></header>
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
        "- `docs/06-organisation-chart.md/.html/.pdf` — congregation roles, confirmed names, vacancies and planning notes.",
        "- `docs/07-congregation-start-checklist.md/.html/.pdf` — phase-based launch, legal, banking, records and first-month checklist.",
        "- `docs/08-preparation-meeting-agenda.md/.html/.pdf` — timed informal agenda, responsibility worksheet and action register.",
        "- `docs/09-regular-pioneer-review.md/.html/.pdf` — confidential elders’ working topic on pioneer hour review and shepherding.",
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
    body = body.replace("](06-organisation-chart.md", "](docs/06-organisation-chart.md")
    body = body.replace("](07-congregation-start-checklist.md", "](docs/07-congregation-start-checklist.md")
    body = body.replace("](09-regular-pioneer-review.md", "](docs/09-regular-pioneer-review.md")
    return body.replace("](../", "](")


def build_startup(data: dict) -> str:
    startup = data["startup"]
    lines = [
        "# Congregation Start Checklist",
        "",
        f"**Official start:** {data['project']['effective_date']} · **Congregation:** {data['project']['congregation_number']} · **Circuit:** {data['project']['circuit']}",
        "",
        '<blockquote class="notice warning">',
        "",
        f"**Legal and banking control:** {startup['legal_control']}",
        "",
        "</blockquote>",
        "",
        "## The short version",
        "",
        startup["short_version"],
        "",
        "Use the [persistent master checklist](../02-checklist.html) to tick these tasks and save notes. This page is the meeting-friendly launch view; the branch letter and current official direction remain controlling.",
        "",
        "## Launch gates",
        "",
        "| Gate | Meaning |",
        "|---|---|",
    ]
    for gate in startup["gates"]:
        lines.append(f"| {status(gate['id'])} | {md_cell(gate['meaning'])} |")
    for phase in startup["phases"]:
        lines.extend([
            "",
            f"## {md_cell(phase['title'])}",
            "",
            md_cell(phase["purpose"]),
            "",
            "| Done | Task | Owner | Gate | Source / evidence |",
            "|:---:|---|---|---|---|",
        ])
        for item in phase["items"]:
            refs = "; ".join(item["references"])
            lines.append(
                f"| ☐ | **{md_cell(item['title'])}**<br>{md_cell(item.get('detail', ''))} | "
                f"{md_cell(item['owner'])} | {status(item['gate'])} | {md_cell(refs)} |"
            )
    lines.extend([
        "",
        "## Forms and instructions to have at hand",
        "",
        "| Reference | What it controls | Availability |",
        "|---|---|---|",
    ])
    for item in startup["guidelines"]:
        lines.append(f"| **{md_cell(item['code'])}** | {md_cell(item['purpose'])} | {md_cell(item['availability'])} |")
    lines.extend([
        "",
        "## New Zealand official references",
        "",
        "These are decision support for a structure approved by the branch—not authority to create a separate entity independently.",
        "",
    ])
    for item in startup["external_sources"]:
        lines.append(f"- [{md_cell(item['title'])}]({item['url']}) — {md_cell(item['use'])}")
    lines.extend([
        "",
        '<blockquote class="notice">',
        "",
        "**Research conclusion:** Charities Services says registration is voluntary. Public-register research located nationwide Jehovah’s Witnesses charitable entities, but did not establish that congregation 3814 must register separately. Therefore the safe first action is written confirmation from the branch Accounting/Legal function of the correct entity, IRD, charity and bank arrangement.",
        "",
        "</blockquote>",
    ])
    return "\n".join(lines) + "\n"


def build_preparation_agenda(data: dict) -> str:
    meeting = data["preparation_meeting"]
    organisation = data["organisation"]
    roles = {role["id"]: role for group in organisation["groups"] for role in group["roles"]}
    categories = organisation["eligibility"]["role_categories"]
    symbols = {item["id"]: item["symbol"] for item in organisation["eligibility"]["legend"]}
    confirmation = {
        "service-overseer": "Authorised body / current direction",
        "group-overseers": "Body of elders",
        "group-assistants": "Body of elders",
        "khoc-representative": "Combined bodies of elders",
    }
    lines = [
        f"# {meeting['title']}",
        "",
        '<div class="meeting-fields">',
        '<p><strong>Date:</strong> ____________________</p>',
        '<p><strong>Time:</strong> ____________________</p>',
        '<p><strong>Location:</strong> ____________________</p>',
        '<p><strong>Chairman:</strong> ____________________</p>',
        '</div>',
        "",
        f"**Suggested duration:** {meeting['recommended_duration']}<br>",
        f"**Purpose:** {meeting['purpose']}",
        "",
        '<blockquote class="notice warning">',
        "",
        f"**Meeting boundary:** {meeting['authority_note']}",
        "",
        "</blockquote>",
        "",
        "## What this meeting should produce",
        "",
        "- Proposed names or follow-up owners for every priority responsibility.",
        "- Owners and deadlines for the first month of meetings, ministry, records and Kingdom Hall arrangements.",
        "- A clear list of matters requiring formal approval or outside direction.",
        "- One action owner for the Branch Accounting/Legal inquiry; no unauthorised charity, tax or banking action.",
        "",
        "## Timed agenda",
        "",
        "| Time | Agenda item | Discussion | Required result |",
        "|---:|---|---|---|",
    ]
    for item in meeting["agenda"]:
        lines.append(f"| **{md_cell(item['minutes'])}** | **{md_cell(item['topic'])}** | {md_cell(item['discussion'])} | {md_cell(item['outcome'])} |")
    lines.extend([
        "",
        "## Responsibility worksheet",
        "",
        "**Eligibility key:** ✓ MS = qualified ministerial servant may be assigned · △ MS = conditional/only when the stated need applies · Elder = elder assignment.",
    ])
    for group in meeting["role_groups"]:
        lines.extend([
            "",
            f"### {md_cell(group['title'])}",
            "",
            "| Responsibility | Current position | Eligibility | Proposed name / action | Formal confirmation | Reference |",
            "|---|---|---|---|---|---|",
        ])
        for role_id in group["role_ids"]:
            role = roles[role_id]
            eligibility = symbols[categories[role_id]]
            approver = confirmation.get(role_id, "Body of elders")
            lines.append(
                f"| **{md_cell(role['title'])}** | {md_cell(role['name'])} | **{md_cell(eligibility)}** | "
                f"____________________ | {md_cell(approver)} | {md_cell(role['reference'])} |"
            )
    lines.extend([
        "",
        "## Questions to work through",
        "",
    ])
    for question in meeting["discussion_questions"]:
        lines.append(f"- ☐ {question}")
    lines.extend([
        "",
        "## Optional discussion — charity, tax, bank and accounts",
        "",
        '<blockquote class="notice info">',
        "",
        meeting["optional_finance_note"],
        "",
        "</blockquote>",
        "",
        "Suggested discussion only:",
        "",
        "1. Who will ask Branch Accounting/Legal which legal entity, official account name, charity/IRD identifiers and bank process apply to congregation 3814?",
        "2. Who will obtain the current S-27 and accounting tutorials?",
        "3. Who can prepare—but not yet submit—the likely bank documents, identity evidence and draft minutes?",
        "4. If the Branch directs a separate registration, who will coordinate the approved governing documents, officers and statutory calendar?",
        "",
        "## Action register",
        "",
        "| Action | Owner | Approver / consulted party | Due date | Status / notes |",
        "|---|---|---|---|---|",
    ])
    for _ in range(10):
        lines.append("| &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; |")
    lines.extend([
        "",
        "## Park for the next meeting",
        "",
        "- ________________________________________________________________________________",
        "- ________________________________________________________________________________",
        "- ________________________________________________________________________________",
        "",
        "**Next preparation review:** ____________________<br>",
        "**Closing prayer:** ____________________",
        "",
        "Useful working links: [organisation chart](06-organisation-chart.md) · [congregation start checklist](07-congregation-start-checklist.md) · [regular-pioneer review](09-regular-pioneer-review.md) · [persistent checklist](../02-checklist.html)",
    ])
    return "\n".join(lines) + "\n"


def build_pioneer_review(data: dict) -> str:
    review = data["regular_pioneer_review"]
    lines = [
        f"# {review['title']}",
        "",
        f"**Audience:** {review['audience']} · **Reviewed:** {review['as_of']}",
        "",
        '<blockquote class="notice danger">',
        "",
        f"**Confidentiality:** {review['confidentiality_note']}",
        "",
        "</blockquote>",
        "",
        '<blockquote class="notice warning">',
        "",
        f"**Authority boundary:** {review['authority_note']}",
        "",
        "</blockquote>",
        "",
        '<div class="dashboard pioneer-metrics">',
        '<div class="metric"><strong>600</strong><span>annual requirement</span></div>',
        '<div class="metric"><strong>50</strong><span>monthly review average</span></div>',
        '<div class="metric"><strong>560</strong><span>year-end continuation benchmark</span></div>',
        '<div class="metric"><strong>Prompt</strong><span>Service Committee review below 560</span></div>',
        '</div>',
        "",
        "## Bottom line",
        "",
        review["bottom_line"],
        "",
        "## Thresholds and what they mean",
        "",
        "| Measure | Figure | Direction | Reference |",
        "|---|---:|---|---|",
    ]
    for item in review["thresholds"]:
        lines.append(f"| **{md_cell(item['measure'])}** | **{md_cell(item['value'])}** | {md_cell(item['meaning'])} | {md_cell(item['reference'])} |")
    lines.extend([
        "",
        '<blockquote class="notice info">',
        "",
        "**Important:** 600 hours is the annual requirement; 560 hours is the separate year-end benchmark stated in Shepherd for continuation. Do not replace either figure with a locally invented rule.",
        "",
        "</blockquote>",
        "",
        "## Decision flow",
        "",
    ])
    for item in review["decision_flow"]:
        lines.extend([
            f"### {item['step']}. {md_cell(item['title'])}",
            "",
            f"**Owner:** {md_cell(item['owner'])} · **Reference:** {md_cell(item['reference'])}",
            "",
        ])
        for action in item["actions"]:
            lines.append(f"- ☐ {action}")
        lines.append("")
    lines.extend([
        "## Provisions and circumstances to distinguish",
        "",
        "| Situation | Criteria | Possible outcome | Reference |",
        "|---|---|---|---|",
    ])
    for item in review["exceptions"]:
        lines.append(f"| **{md_cell(item['title'])}** | {md_cell(item['criteria'])} | {md_cell(item['outcome'])} | {md_cell(item['reference'])} |")
    lines.extend([
        "",
        "## How to conduct the conversation",
        "",
        "### Principles",
        "",
    ])
    for item in review["conversation"]["principles"]:
        lines.append(f"- {item}")
    lines.extend([
        "",
        "### Questions that invite an honest assessment",
        "",
    ])
    for item in review["conversation"]["questions"]:
        lines.append(f"- {item}")
    lines.extend([
        "",
        "### Suggested opening",
        "",
        "> " + review["conversation"]["sample_opening"],
        "",
        "### Avoid",
        "",
        "- Beginning with a predetermined request that the person discontinue.",
        "- Saying, “You failed to make your time,” or implying that the congregation was let down.",
        "- Equating hours or a pioneer appointment with Jehovah’s approval of the person.",
        "- Pressuring the pioneer to pursue an unsafe or unrealistic catch-up schedule.",
        "- Leaving a year-end case below 560 hours unresolved.",
        "",
        "## If discontinuation is determined",
        "",
        "1. Obtain and consider the appropriate group overseer’s comments.",
        "2. Check whether special consideration or the infirm-pioneer provision applies.",
        "3. The Congregation Service Committee makes the determination using balanced judgment.",
        "4. Update the body of elders before any announcement.",
        "5. Two Service Committee members inform the pioneer personally before the announcement.",
        "6. Use the current JW Hub procedure and only the prescribed announcement.",
        "7. Continue warm shepherding; a temporary discontinuation is not discipline and does not diminish the person’s faithful service.",
        "",
        "## Ashburton transition application",
        "",
        f"- **Who handles the completed service year:** {review['ashburton_transfer']['current_owner']}",
        f"- **What the transfer letter must resolve:** {review['ashburton_transfer']['transfer_requirement']}",
        f"- **What the new congregation does:** {review['ashburton_transfer']['new_congregation_action']}",
        f"- **Reference:** {review['ashburton_transfer']['reference']}",
        "",
        '<blockquote class="notice success">',
        "",
        "**Practical control:** Resolve or clearly document each regular pioneer’s recommendation before the 1 November transfer. The new congregation should not inherit an ambiguous pioneer status.",
        "",
        "</blockquote>",
        "",
        "## Sources",
        "",
    ])
    for source in review["sources"]:
        if source.get("path"):
            label = f"[{md_cell(source['title'])}]({qpath(source['path'])})"
        else:
            label = f"[{md_cell(source['title'])}]({source['url']})"
        lines.append(f"- {label} — {md_cell(source['reference'])}; {md_cell(source['kind'])}.")
    return "\n".join(lines) + "\n"


def build_meeting_pack(data: dict, actual_hashes: dict[str, str]) -> str:
    project = data["project"]
    sections = [
        ("Preparation Meeting Agenda", build_preparation_agenda(data)),
        ("Congregation Organisation Chart", build_organisation(data)),
        ("Congregation Start Checklist", build_startup(data)),
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
<body><header class="hero"><p class="eyebrow">Ashburton Tagalog · Working project portal</p><h1>Search the project</h1><p>Search forms, requirements, statistics, communications, roles, agendas, pioneer guidance, start tasks, checklist items and deep-linked S-50/S-51 references.</p></header>
{common_nav(0, 'search')}
<main class="search-page"><form class="search-panel" id="search-form" role="search"><label for="search-input">Search words or an exact phrase</label><div class="search-row"><input id="search-input" type="search" placeholder="Try S-29, Adamson, service overseer, or par. 6" autocomplete="off" autofocus><button type="submit">Search</button></div><div class="search-options"><label for="search-type">Limit to</label><select id="search-type"><option value="">All project sources</option><option value="communications">Communications</option><option value="official">Official references</option><option value="forms">Forms and submissions</option><option value="organisation">Organisation and roles</option><option value="checklist">Checklist</option><option value="portal">Project guidance</option></select><span id="search-meta"></span></div></form><p class="search-status" id="search-status" aria-live="polite"></p><div class="search-empty" id="search-empty"><h2>One search box for the whole project</h2><p>Use ordinary words, a form code, a name, or an exact phrase in quotation marks. Press <kbd>/</kbd> anywhere on this page to focus the search box.</p></div><div class="search-results" id="search-results"></div></main>
<p class="footer">The index is built only from local project files. Search results are working aids and do not replace the official source.</p></body></html>'''
    SEARCH_HTML.write_text(page, encoding="utf-8")


def build_search_index() -> None:
    sources = [
        {"id": "communications", "name": "Communications", "title": "Circuit-overseer and branch correspondence", "type": "communications", "priority": 0, "path": COMMS_HTML, "url": "docs/05-communications.html"},
        {"id": "s50", "name": "S-50", "title": "Instructions for Recommending New Congregations", "type": "official", "priority": 1, "path": REFS_DIR / "00-S-50-reference.html", "url": "references/00-S-50-reference.html"},
        {"id": "s51", "name": "S-51", "title": "Congregation Application/Information", "type": "official", "priority": 2, "path": REFS_DIR / "01-S-51-reference.html", "url": "references/01-S-51-reference.html"},
        {"id": "forms", "name": "Forms", "title": "Forms register", "type": "forms", "priority": 3, "path": DOCS_DIR / "00-forms-register.html", "url": "docs/00-forms-register.html"},
        {"id": "submissions", "name": "Submissions", "title": "Submission register", "type": "forms", "priority": 4, "path": DOCS_DIR / "03-submissions.html", "url": "docs/03-submissions.html"},
        {"id": "organisation", "name": "Organisation", "title": "Congregation organisation chart", "type": "organisation", "priority": 5, "path": ORG_HTML, "url": "docs/06-organisation-chart.html"},
        {"id": "startup", "name": "Start", "title": "Congregation start checklist", "type": "checklist", "priority": 5, "path": START_HTML, "url": "docs/07-congregation-start-checklist.html"},
        {"id": "agenda", "name": "Agenda", "title": "Informal congregation preparation meeting", "type": "organisation", "priority": 5, "path": AGENDA_HTML, "url": "docs/08-preparation-meeting-agenda.html"},
        {"id": "pioneers", "name": "Pioneers", "title": "Regular pioneer hour review and shepherding guide", "type": "organisation", "priority": 5, "path": PIONEER_HTML, "url": "docs/09-regular-pioneer-review.html"},
        {"id": "requirements", "name": "Requirements", "title": "Requirements and evidence", "type": "portal", "priority": 6, "path": DOCS_DIR / "01-requirements.html", "url": "docs/01-requirements.html"},
        {"id": "statistics", "name": "Statistics", "title": "Statistics and provenance", "type": "portal", "priority": 7, "path": DOCS_DIR / "02-statistics.html", "url": "docs/02-statistics.html"},
        {"id": "checklist", "name": "Checklist", "title": "Forming a New Congregation checklist", "type": "checklist", "priority": 8, "path": ROOT / "02-checklist.html", "url": "02-checklist.html"},
        {"id": "overview", "name": "Overview", "title": "Project overview", "type": "portal", "priority": 9, "path": ROOT_HTML, "url": "00-project-overview.html"},
        {"id": "sources", "name": "Sources", "title": "Source map and integrity register", "type": "portal", "priority": 10, "path": DOCS_DIR / "04-source-map.html", "url": "docs/04-source-map.html"},
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
    validate_checklist_contract(data)
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
        (ORG_MD, ORG_HTML, "organisation", 1, build_organisation(data)),
        (START_MD, START_HTML, "startup", 1, build_startup(data)),
        (AGENDA_MD, AGENDA_HTML, "agenda", 1, build_preparation_agenda(data)),
        (PIONEER_MD, PIONEER_HTML, "pioneers", 1, build_pioneer_review(data)),
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
        print_pdf(ORG_HTML, ORG_PDF)
        print_pdf(START_HTML, START_PDF)
        print_pdf(AGENDA_HTML, AGENDA_PDF)
        print_pdf(PIONEER_HTML, PIONEER_PDF)

    hashes_after = verify_preserved_files(data)
    if hashes_after[data["checklist"]["progress_json"]] != progress_hash:
        raise RuntimeError("Checklist progress JSON changed during generation; refusing handoff.")
    print(f"Built index.html, search, {len(documents) + 1} Markdown/HTML portal documents, 2 deep-reference pages" + (" and 6 PDFs." if not args.no_pdf else "."))
    print("Verified immutable source hashes and preserved checklist progress JSON.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
