#!/usr/bin/env python3
"""Render the department email communication register from JSON."""

from html import escape
from pathlib import Path
from urllib.parse import quote
from datetime import datetime
from zoneinfo import ZoneInfo
import json

from portal_links import COMMUNICATION_ROLES, person_id, preferred_name

ROOT = Path(__file__).resolve().parent
data = json.loads((ROOT / "communications.json").read_text(encoding="utf-8"))


def people(values):
    rendered = []
    for person in values:
        email = person["email"]
        name = preferred_name(person["name"], email)
        rendered.append(
            f'<span class="person-reference"><a class="person-name" href="contact-masterlist.html#{person_id(name, email)}">{escape(name)}</a>'
            f'<a class="person-email" href="mailto:{quote(email)}">{escape(email)}</a></span>'
        )
    return "".join(rendered) or "—"


def sent_label(value):
    if not value:
        return ""
    instant = datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(ZoneInfo("Pacific/Auckland"))
    return instant.strftime("%-d %B %Y, %-I:%M %p NZST")


def message(record):
    lead = record["to"][0]["name"].split()[0]
    greeting = "Dear Brothers," if len(record["to"]) > 1 else f"Dear Brother {escape(lead)},"
    if record.get("variant") == "committee-meeting":
        return '''<p>Dear Brothers,</p>
<p>We will have a Convention Committee meeting on <strong>Wednesday, 19 August 2026, at 10:00 PM</strong>.</p>
<p>The main matters for discussion and decision are:</p>
<ol><li>Selecting a Program Overseer Assistant.</li><li>Selecting an Attendant Overseer to replace Ron Mariano following his appointment as Coordinator Assistant.</li><li>Reviewing the CO-53 process, including who participates in the observations and postconvention evaluation.</li></ol>
<p>I have attached the meeting agenda and the CO-53 form. Please review both documents before the meeting and consider qualified brothers for the two open assignments.</p>
<p><strong>Zoom meeting details</strong><br>
Join meeting: <a href="https://us02web.zoom.us/j/81627326064?pwd=OpPjXo5VzUECMUoA3JxviZ3NstKHwh.1">https://us02web.zoom.us/j/81627326064?pwd=OpPjXo5VzUECMUoA3JxviZ3NstKHwh.1</a><br>
Meeting chat: <a href="https://us02web.zoom.us/launch/jc/81627326064">https://us02web.zoom.us/launch/jc/81627326064</a><br>
Meeting ID: <strong>816 2732 6064</strong><br>
Passcode: <strong>2026RC</strong></p>
<p>Please confirm that you are available for the meeting.</p>
<p>Your brother,<br>Adamson dela Cruz<br>Convention Committee Coordinator<br>Auckland NS (TG) — 2026</p>'''
    if record.get("variant") == "receipt-check":
        return '''<p>Dear Brother Daveson,</p>
<p>I am checking whether you received the convention documents for your assignment as Rooming Overseer Assistant from Brother Wilfredo Calaunan.</p>
<p>Could you please confirm whether you received them and whether you are able to open the files? If anything is missing or cannot be opened, please let me know which documents so we can arrange for them to be forwarded.</p>
<p>Thank you.</p>
<p>Your brother,<br>Adamson dela Cruz<br>Convention Committee Coordinator<br>Auckland NS (TG) — 2026</p>'''
    introduction = ("Thank you for accepting the appointment to serve as Convention Committee Coordinator Assistant for the Auckland Tagalog Convention at the South Auckland Assembly Hall, 30 October–1 November 2026."
                    if record.get("variant") == "committee-assistant" else
                    f'Thank you for accepting the assignment to serve with the <strong>{escape(record["department"])}</strong> for the Auckland Tagalog Convention at the South Auckland Assembly Hall, 30 October–1 November 2026.')
    special = ""
    if record.get("variant") == "committee":
        special = "<p>Please review these committee and event-oversight documents together. The confidential department diagram is a controlled document and must not be forwarded.</p>"
    elif record.get("variant") == "committee-assistant":
        special = "<p>This package follows your appointment as Convention Committee Coordinator Assistant. Please review the committee and event-oversight material. The confidential department diagram is a controlled document and must not be forwarded.</p>"
    elif record.get("variant") == "confidential":
        special = "<p>The emergency plan, evacuation material, site plan, and confidential department diagram are controlled operational documents. Please review them with your assistant, keep them secure, and do not forward the confidential diagram.</p>"
    elif record["id"] == "information-lost-found":
        special = "<p>The attached M-285 documents apply specifically to the Lost &amp; Found portion of your assignment. Dedicated venue instructions for Information and Volunteer Service were not included in the supplied folder. I will forward further instructions when available.</p>"
    elif record["id"] == "rooming":
        special = "<p>The venue folder did not contain dedicated Rooming Department instructions. The facility documents are for venue orientation only and do not replace the current Convention Rooming Guidelines (CO-80). Additional rooming direction will follow when obtained.</p>"
    return f'''<p>{greeting}</p>
<p>{introduction}</p>
<p>Attached are CO-1 and the venue instructions, checklist, and supporting documents relevant to your assignment. Please review the material with your assistant(s) and use the checklist to organise the department.</p>
{special}
<p>Please:</p><ol><li>Confirm that you and your assistants can open all attached files.</li><li>Review the department manual and checklist together.</li><li>Identify any staffing, equipment, safety, or scheduling matters requiring committee assistance.</li><li>Keep these documents within the brothers authorised to use them. CO-1 should not be distributed beyond those authorised in paragraph 1:3; keymen should read only the portions relevant to their assignments.</li></ol>
<p>Please send me an initial status update by <strong>{escape(data["response_due"])}</strong>, including whether the department is adequately staffed, whether assigned brothers have been contacted, any equipment or facility requirements, any safety matters requiring attention, and any assistance needed from the Convention Committee.</p>
<p>Thank you for your willing cooperation and for the work you are doing in support of the convention.</p>
<p>Your brother,<br>Adamson dela Cruz<br>Convention Committee Coordinator<br>Auckland NS (TG) — 2026</p>'''


records_by_group = {group["id"]: [] for group in data["communication_groups"]}
cards = []
for record in data["communications"]:
    records_by_group.setdefault(record["group"], []).append(record)
    attachments = []
    for filename in record["attachments"]:
        path = ROOT.parent / filename
        state = "ready" if path.exists() else "missing"
        label = filename.split("/")[-1]
        href = "../" + quote(filename)
        attachments.append(f'<li class="{state}"><a href="{href}">{escape(label)}</a><span>{"Ready" if state == "ready" else "Missing"}</span></li>')
    cards.append(f'''<article class="comm-detail" id="{escape(record["id"])}" data-status="{escape(record["status"])}">
<header><div><p class="eyebrow">Department communication</p><h2>{escape(record["department"])}</h2><a class="chart-backlink" href="organisation-chart.html#{COMMUNICATION_ROLES[record['id']]}">View responsibility on chart</a></div><span class="status">{escape(record["status"])}</span></header>
<dl><dt>To</dt><dd>{people(record["to"])}</dd><dt>CC</dt><dd>{people(record["cc"])}</dd><dt>Subject</dt><dd>{escape(record.get("subject", f'2026 Auckland Tagalog Convention — {record["department"]} Instructions and Checklist'))}</dd><dt>Response due</dt><dd>{escape(record.get("response_due", data["response_due"]))}</dd>{f'<dt>Sent</dt><dd>{escape(sent_label(record.get("sent_at")))}</dd>' if record.get("sent_at") else ''}<dt>Last updated</dt><dd>{escape(data["updated"])}</dd></dl>
{f'<p class="record-note">{escape(record["note"])}</p>' if record.get("note") else ''}
<details open><summary>Attachments <span>{len(attachments)}</span></summary><ul class="attachments">{''.join(attachments)}</ul></details>
<details open><summary>Email draft</summary><div class="email-body">{message(record)}</div></details>
</article>''')

tree = []
for group in data["communication_groups"]:
    records = records_by_group.get(group["id"], [])
    sent = sum(record["status"] == "Sent" for record in records)
    links = []
    for record in records:
        recipient = preferred_name(record["to"][0]["name"], record["to"][0]["email"])
        links.append(
            f'<a class="comm-select" href="#{escape(record["id"])}" data-target="{escape(record["id"])}" '
            f'data-search="{escape((record["department"] + " " + recipient + " " + record["status"]).lower(), quote=True)}">'
            f'<span>{escape(record["department"])}</span><small>{escape(recipient)}</small>'
            f'<b class="status-mini {"sent" if record["status"] == "Sent" else "draft"}">{escape(record["status"])}</b></a>'
        )
    tree.append(
        f'<details class="comm-group" data-group="{escape(group["id"])}" {"open" if group.get("open") else ""}>'
        f'<summary><span><strong>{escape(group["label"])}</strong><small>{escape(group["description"])}</small></span>'
        f'<b>{sent}/{len(records)} sent</b></summary><div class="comm-children">{"".join(links)}</div></details>'
    )

html = f'''<!doctype html><html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Department Communications — 2026 Auckland Tagalog Convention</title><link rel="stylesheet" href="assets/coordinator.css"><style>
body{{max-width:1500px}}.comm-shell{{display:grid;grid-template-columns:340px minmax(0,1fr);gap:1.25rem;align-items:start}}.comm-sidebar{{position:sticky;top:4.4rem;max-height:calc(100vh - 5.5rem);overflow:auto;padding:.75rem;border:1px solid var(--line);border-radius:.7rem;background:var(--wash)}}.comm-sidebar h2{{margin:.2rem .2rem .65rem;font-size:1rem}}.comm-search{{box-sizing:border-box;width:100%;margin-bottom:.65rem;padding:.6rem .7rem;border:1px solid #91a4b1;border-radius:.45rem;font:inherit}}.comm-group{{margin:.45rem 0;border:1px solid var(--line);border-radius:.55rem;background:#fff}}.comm-group>summary{{display:flex;justify-content:space-between;gap:.6rem;align-items:center;padding:.65rem .7rem;list-style:none;cursor:pointer}}.comm-group>summary::-webkit-details-marker{{display:none}}.comm-group>summary::before{{content:'▸';color:var(--blue);font-size:1rem}}.comm-group[open]>summary::before{{content:'▾'}}.comm-group>summary>span{{display:grid;flex:1}}.comm-group>summary small{{color:var(--muted);font-weight:500}}.comm-group>summary>b{{color:var(--muted);font-size:.72rem;white-space:nowrap}}.comm-children{{padding:0 .45rem .45rem}}.comm-select{{display:grid;width:100%;margin:.3rem 0;padding:.6rem .65rem;border:1px solid transparent;border-radius:.45rem;background:var(--wash);color:var(--ink);text-align:left;text-decoration:none}}.comm-select span{{font-weight:800}}.comm-select small{{color:var(--muted)}}.status-mini{{width:max-content;margin-top:.25rem;font-size:.68rem;text-transform:uppercase}}.status-mini.sent{{color:#1f6f32}}.status-mini.draft{{color:#805b10}}.comm-select:hover,.comm-select:focus-visible,.comm-select.active{{border-color:var(--blue);background:var(--blue-pale)}}.comm-select[hidden],.comm-group[hidden]{{display:none}}.comm-detail{{display:none;padding:1.2rem;border:1px solid var(--line);border-radius:.75rem;background:#fff;scroll-margin-top:5rem}}.comm-detail.active{{display:block}}.comm-detail>header{{display:flex;justify-content:space-between;gap:1rem;align-items:start;padding-bottom:.75rem;border-bottom:1px solid var(--line)}}.eyebrow{{margin:0;color:var(--muted);font-size:.78rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em}}.comm-detail h2{{margin:.15rem 0 .2rem}}.chart-backlink{{font-size:.82rem;font-weight:750}}.status{{padding:.35rem .65rem;border-radius:999px;background:#fff3cd;color:#664d03;font-weight:800;white-space:nowrap}}dl{{display:grid;grid-template-columns:8rem 1fr;gap:.55rem 1rem}}dt{{font-weight:800}}dd{{margin:0;overflow-wrap:anywhere}}.person-reference{{display:inline-grid;margin:0 .9rem .3rem 0}}.person-name{{font-weight:750}}.person-email{{font-size:.82rem;color:var(--muted)}}.comm-detail details{{margin:1rem 0;border:1px solid var(--line);border-radius:.5rem}}.comm-detail summary{{padding:.65rem .8rem;background:var(--wash);font-weight:800;cursor:pointer}}.comm-detail summary span{{float:right}}.attachments{{margin:0;padding:.5rem 1rem;list-style:none}}.attachments li{{display:flex;justify-content:space-between;gap:1rem;padding:.4rem 0;border-top:1px solid var(--line)}}.attachments li:first-child{{border-top:0}}.attachments span{{color:#1f6f32;font-size:.8rem;font-weight:800}}.attachments .missing span{{color:#9b2c2c}}.email-body{{padding:1rem 1.2rem;max-width:820px;background:#fff}}.record-note{{padding:.7rem .8rem;border-left:4px solid #d69e2e;background:#fffaf0}}.dry-run{{padding:.8rem 1rem;border:2px solid #d69e2e;border-radius:.55rem;background:#fffaf0;font-weight:750}}@media(max-width:800px){{.comm-shell{{grid-template-columns:1fr}}.comm-sidebar{{position:static;max-height:none}}dl{{grid-template-columns:1fr}}dt{{margin-top:.4rem}}}}
</style></head><body><nav class="site-nav"><a href="index.html">Index</a><a href="search.html">Search</a><a href="organisation-chart.html">Chart</a><a href="contact-masterlist.html">Contacts</a><a href="communications.html" aria-current="page">Communications</a></nav>
<h1>Department Communications</h1><p>{escape(data["event"])} · {escape(data["venue"])} · {escape(data["dates"])}</p><p class="dry-run">Communication register — sent records show their delivery time. Draft records have not been sent and require explicit approval.</p>
<div class="comm-shell"><aside class="comm-sidebar"><h2>Communication tree</h2><input class="comm-search" id="comm-search" type="search" placeholder="Search people, departments or status" aria-label="Search communications">{''.join(tree)}</aside><main>{''.join(cards)}</main></div>
<script>(()=>{{const links=[...document.querySelectorAll('.comm-select')],cards=[...document.querySelectorAll('.comm-detail')],groups=[...document.querySelectorAll('.comm-group')],search=document.getElementById('comm-search');function show(id,push=false){{const target=document.getElementById(id);if(!target)return;links.forEach(link=>link.classList.toggle('active',link.dataset.target===id));cards.forEach(card=>card.classList.toggle('active',card.id===id));const link=links.find(item=>item.dataset.target===id);if(link)link.closest('.comm-group').open=true;if(push&&location.hash!=='#'+id)history.pushState(null,'','#'+id)}}links.forEach(link=>link.addEventListener('click',event=>{{event.preventDefault();show(link.dataset.target,true)}}));function route(){{const id=location.hash.slice(1);show(document.getElementById(id)?.classList.contains('comm-detail')?id:links[0].dataset.target)}}addEventListener('hashchange',route);search.addEventListener('input',()=>{{const terms=search.value.toLowerCase().trim().split(/\\s+/).filter(Boolean);links.forEach(link=>link.hidden=!terms.every(term=>link.dataset.search.includes(term)));groups.forEach(group=>{{const visible=group.querySelector('.comm-select:not([hidden])');group.hidden=!visible;if(terms.length&&visible)group.open=true}})}});route()}})();</script><script src="portal-link-data.js"></script><script src="../co1-links.js" data-co1="CO-1.html"></script></body></html>'''
(ROOT / "communications.html").write_text(html, encoding="utf-8")
print(f'Rendered {len(data["communications"])} communication drafts.')
