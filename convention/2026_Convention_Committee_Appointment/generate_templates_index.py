#!/usr/bin/env python3
"""Generate a browsable index for downloaded venue department material."""

from html import escape
from pathlib import Path
from urllib.parse import quote


ROOT = Path(__file__).resolve().parent / "templates"
folders = sorted(path for path in ROOT.iterdir() if path.is_dir())


def size_label(size: int) -> str:
    if size >= 1_000_000:
        return f"{size / 1_000_000:.1f} MB"
    if size >= 1_000:
        return f"{size / 1_000:.0f} KB"
    return f"{size} B"


sections = []
file_count = 0
for folder in folders:
    files = sorted(path for path in folder.rglob("*") if path.is_file())
    file_count += len(files)
    items = []
    for path in files:
        relative = path.relative_to(ROOT).as_posix()
        label = path.relative_to(folder).as_posix()
        items.append(
            f'<li><a href="{quote(relative)}">{escape(label)}</a>'
            f'<span>{escape(path.suffix[1:].upper() or "FILE")} · {size_label(path.stat().st_size)}</span></li>'
        )
    content = "".join(items) if items else '<li class="empty">No files supplied.</li>'
    sections.append(
        f'<section id="{quote(folder.name).lower()}"><h2>{escape(folder.name)}</h2><ul>{content}</ul></section>'
    )

html = f'''<!doctype html>
<html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Venue Department Instructions and Checklists</title>
<style>
:root{{--blue:#075985;--line:#cbd5e1;--wash:#f5f8fa;--muted:#52606d}}
*{{box-sizing:border-box}}body{{max-width:1050px;margin:auto;padding:1.5rem;font:16px/1.55 system-ui,sans-serif;color:#17212b}}
a{{color:var(--blue)}}header{{padding:1rem 0 1.5rem;border-bottom:1px solid var(--line)}}h1{{margin:.2rem 0;color:var(--blue);line-height:1.2}}
.meta{{color:var(--muted)}}nav{{display:flex;flex-wrap:wrap;gap:.45rem;margin:1rem 0 2rem}}nav a{{padding:.3rem .55rem;border-radius:.3rem;background:#e0f2fe;font-weight:700;text-decoration:none}}
section{{margin:1.2rem 0;padding:1rem 1.1rem;border:1px solid var(--line);border-radius:.6rem;background:var(--wash)}}h2{{margin:0 0 .7rem;color:var(--blue)}}
ul{{margin:0;padding:0;list-style:none}}li{{display:flex;justify-content:space-between;gap:1rem;padding:.45rem 0;border-top:1px solid #dbe4ea}}li:first-child{{border-top:0}}li span{{flex:none;color:var(--muted);font-size:.88rem}}.empty{{color:var(--muted);font-style:italic}}
@media(max-width:600px){{li{{display:block}}li span{{display:block;margin-top:.15rem}}}}
</style></head><body>
<header><p><a href="../coordinator/index.html">← Coordinator home</a></p><h1>Venue Department Instructions and Checklists</h1>
<p class="meta">Downloaded from the 2026 South Auckland Assembly Hall JW Drive folder · {len(folders)} department folders · {file_count} files</p></header>
<nav>{''.join(f'<a href="#{quote(folder.name).lower()}">{escape(folder.name)}</a>' for folder in folders)}</nav>
<main>{''.join(sections)}</main></body></html>'''

(ROOT / "index.html").write_text(html, encoding="utf-8")
print(f"Generated templates/index.html for {len(folders)} folders and {file_count} files.")
