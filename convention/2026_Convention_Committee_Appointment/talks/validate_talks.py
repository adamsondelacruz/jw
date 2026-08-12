#!/usr/bin/env python3
"""Validate the prepared talk packages and their local navigation."""

from __future__ import annotations

import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parent


class Links(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.hrefs: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a":
            return
        for name, value in attrs:
            if name == "href" and value:
                self.hrefs.append(value)


def require_in_order(text: str, phrases: list[str], label: str, errors: list[str]) -> None:
    positions = [text.find(phrase) for phrase in phrases]
    if any(position < 0 for position in positions) or positions != sorted(positions):
        errors.append(f"{label}: missing or out-of-order structure: {phrases}")


def validate_talk(talk: str, expected_reads: int, structure: list[str], errors: list[str]) -> None:
    talk_dir = ROOT / talk
    draft = (talk_dir / "01-draft-talk.md").read_text(encoding="utf-8")
    read_count = len(re.findall(r"^\*\*(?:Read|READ) ", draft, re.MULTILINE))
    video_count = len(re.findall(r"^<div class=\"video\">", draft, re.MULTILINE))
    if read_count != expected_reads:
        errors.append(f"{talk}: expected {expected_reads} formal readings, found {read_count}")
    if video_count != 2:
        errors.append(f"{talk}: expected 2 video cues, found {video_count}")
    require_in_order(draft, structure, talk, errors)

    for required in (
        "00-index.md",
        "00-index.html",
        "01-draft-talk.html",
        "01-draft-talk.pdf",
        "02-extemp-guide.html",
        "02-extemp-guide.pdf",
        "03-draft-talk-TG.md",
        "03-draft-talk-TG.html",
        "03-draft-talk-TG.pdf",
        "04-extemp-guide-TG.md",
        "04-extemp-guide-TG.html",
        "04-extemp-guide-TG.pdf",
        "05-extemp-delivery-tips.html",
        "05-extemp-delivery-tips.pdf",
        "06-metrics-index.html",
        "resources/00-index.html",
    ):
        path = talk_dir / required
        if not path.is_file() or path.stat().st_size == 0:
            errors.append(f"{talk}: missing or empty {required}")

    tagalog = (talk_dir / "03-draft-talk-TG.md").read_text(encoding="utf-8")
    tg_reads = len(re.findall(r"^\*\*(?:Basahin|BASAHIN) ", tagalog, re.MULTILINE))
    tg_videos = len(re.findall(r"^<div class=\"video\">", tagalog, re.MULTILINE))
    if tg_reads != expected_reads:
        errors.append(f"{talk}: Tagalog expected {expected_reads} formal readings, found {tg_reads}")
    if tg_videos != 2:
        errors.append(f"{talk}: Tagalog expected 2 video cues, found {tg_videos}")

    for path in talk_dir.iterdir():
        if path.is_file() and path.suffix in {".md", ".html", ".pdf", ".css"}:
            if not re.match(r"^\d{2}-", path.name):
                errors.append(f"{talk}: unnumbered deliverable {path.name}")
        if "TG" in path.name and not re.search(r"-TG\.(?:md|html|pdf)$", path.name):
            errors.append(f"{talk}: incorrect Tagalog suffix {path.name}")


def validate_links(errors: list[str]) -> None:
    for html in sorted(path for talk in ("004", "013") for path in (ROOT / talk).rglob("*.html")):
        parser = Links()
        parser.feed(html.read_text(encoding="utf-8"))
        for href in parser.hrefs:
            split = urlsplit(href)
            if split.scheme or split.netloc or not split.path:
                continue
            target = (html.parent / unquote(split.path)).resolve()
            if not target.exists():
                errors.append(f"{html.relative_to(ROOT)}: broken link {href}")


def main() -> None:
    errors: list[str] = []
    validate_talk(
        "004",
        1,
        [
            "WHAT WAS PROPHESIED?",
            "HOW WAS THE PROPHECY FULFILLED?",
            "WHAT CAN WE LEARN FROM THE MESSIAH?",
            "Without an Illustration He Would Not Speak",
        ],
        errors,
    )
    require_in_order(
        (ROOT / "004" / "03-draft-talk-TG.md").read_text(encoding="utf-8"),
        [
            "ANO ANG INIHULA?",
            "PAANO NATUPAD ANG HULA?",
            "ANO ANG MATUTUTUHAN NATIN SA MESIYAS?",
            "Hindi Siya Nagtuturo Nang Walang Ilustrasyon",
        ],
        "004-TG",
        errors,
    )
    validate_talk(
        "013",
        0,
        [
            "WHAT IS THE DIFFERENCE BETWEEN A LAW AND A PRINCIPLE?",
            "1. Murder",
            "2. Adultery",
            "3. Divorce",
            "4. Oaths",
            "5. “Eye for eye”",
            "6. Love your enemies",
            "LOVE THE PERSON BEHIND THE PRINCIPLE",
        ],
        errors,
    )
    require_in_order(
        (ROOT / "013" / "03-draft-talk-TG.md").read_text(encoding="utf-8"),
        [
            "ANG PAGKAKAIBA NG BATAS AT PRINSIPYO",
            "1. Huwag kang papatay",
            "2. Huwag kang mangangalunya",
            "3. Kasulatan ng diborsiyo",
            "4. Huwag kang susumpa nang hindi mo gagawin",
            "5. Mata para sa mata",
            "6. Mahalin ang iyong kapuwa",
            "MAHALIN ANG ISA NA NAGBIGAY NG MGA PRINSIPYO",
        ],
        "013-TG",
        errors,
    )
    validate_links(errors)

    if errors:
        print("Validation failed:")
        print("\n".join(f"- {error}" for error in errors))
        raise SystemExit(1)
    print("Validation passed: structure, cue counts, deliverables, and local links are complete.")


if __name__ == "__main__":
    main()
