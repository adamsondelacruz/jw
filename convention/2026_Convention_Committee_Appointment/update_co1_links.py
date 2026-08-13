#!/usr/bin/env python3
"""Install the reusable CO-1 linker in convention HTML documents."""

from pathlib import Path
import os
import re


ROOT = Path(__file__).resolve().parent


def update(path: Path) -> bool:
    html = path.read_text(encoding="utf-8")
    if "CO-1" not in html or "</body>" not in html or path.name == "CO-1.html":
        return False
    relative = Path(os.path.relpath(ROOT / "co1-links.js", path.parent)).as_posix()
    tag = f'<script src="{relative}" data-co1="CO-1.html"></script>'
    if "co1-links.js" in html:
        updated = re.sub(r'<script src="[^"]*co1-links\.js"[^>]*></script>', tag, html)
    else:
        updated = html.replace("</body>", f"{tag}\n</body>")
    if updated != html:
        path.write_text(updated, encoding="utf-8")
        return True
    return False


changed = sum(update(path) for path in ROOT.rglob("*.html"))
print(f"Updated {changed} HTML files with reusable CO-1 links.")
