#!/usr/bin/env python3
"""Create the prefilled official CO-53 master from verified local assignments."""

from pathlib import Path
import fitz

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parent / "CO-53_E.pdf"
OUTPUT = ROOT / "forms" / "01-CO-53-master_Auckland-NS-TG-2026.pdf"

# The contact workbook supplies the congregation groupings below but does not
# contain birth or baptism dates. Those fields intentionally remain blank until
# the coordinator verifies them through an authorised source.
people = [
    (13, "Adamson dela Cruz", "Ashburton", "Convention Committee coordinator"),
    (29, "Israel Mendoza Vinuya", "Auckland", "Program overseer"),
    (45, "Wilfredo M Calaunan Jr", "Christchurch", "Rooming overseer"),
    (61, "Ron Kenneth Jahaziel Cruz Mariano", "Takanini", "Coordinator assistant"),
    (77, "Kent Morata", "Auckland", "Program overseer assistant"),
    (93, "Daveson Asuncion", "Ashburton", "Rooming overseer assistant"),
    (109, "Louie Joy Vea", "Christchurch", "Attendant overseer"),
    (125, "Ramon Ruiz", "Takanini", "Cleaning overseer"),
]

values = {
    "901_9_Text": "Auckland NS (TG) — 2026",
    "901_10_Text": "30 Oct.–1 Nov. 2026",
    "901_11_Text": "Tagalog",
    "901_12_Text": "Adamson dela Cruz",
}
for base, name, congregation, assignment in people:
    values[f"901_{base}_Text"] = name
    # base+1 and base+2 are birth and baptism date fields: deliberately blank.
    values[f"901_{base + 3}_Text"] = congregation
    values[f"901_{base + 4}_Text"] = assignment

document = fitz.open(SOURCE)
page = document[0]
found = set()
for widget in page.widgets() or []:
    if widget.field_name not in values:
        continue
    widget.field_value = values[widget.field_name]
    widget.text_fontsize = 7 if len(str(widget.field_value)) > 22 else 8
    widget.update()
    found.add(widget.field_name)

missing = sorted(set(values) - found)
if missing:
    raise RuntimeError(f"Official CO-53 field mapping changed; missing: {', '.join(missing)}")

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
document.save(OUTPUT, garbage=4, deflate=True, clean=True)
print(f"Created official prefilled CO-53 master: {OUTPUT}")
print("Birth and baptism dates remain blank pending secure verification.")
