#!/usr/bin/env python3
"""Create the reviewed working S-5 overlay without changing the blank source PDF."""

from __future__ import annotations

import argparse
from pathlib import Path

import fitz


BLUE = (0.02, 0.28, 0.58)


def put(page: fitz.Page, x: float, y: float, text: str, *, size: float = 9) -> None:
    page.insert_text(
        fitz.Point(x, y),
        text,
        fontsize=size,
        fontname="helv",
        color=BLUE,
        overlay=True,
    )


def fill(source: Path, output: Path) -> None:
    if source.resolve() == output.resolve():
        raise ValueError("The blank source PDF must not be overwritten")
    if not source.is_file():
        raise FileNotFoundError(source)

    document = fitz.open(source)
    if document.page_count != 1:
        raise ValueError(f"Expected a one-page S-5, found {document.page_count} pages")

    page = document[0]

    # Required proposal details supported by the signed S-51 and project record.
    # The congregation number remains blank as directed for a proposed congregation.
    put(page, 414, 151.5, "11", size=8.5)
    put(page, 470, 151.5, "1", size=8.5)
    put(page, 514, 151.5, "2026", size=8.5)
    put(page, 168, 180.5, "Ashburton Tagalog", size=9)

    put(page, 180, 208.5, "262-264 Cameron Street", size=9)
    put(page, 180, 294.5, "Ashburton", size=8.5)
    put(page, 388, 294.5, "Canterbury", size=8.5)
    put(page, 510, 294.5, "7700", size=8.5)

    # Meeting schedule supplied by the user on 30 August 2026.
    put(page, 251, 432.5, "Thursday", size=9)
    put(page, 406, 432.5, "7:15 p.m.", size=9)
    put(page, 251, 460.5, "Saturday", size=9)
    put(page, 406, 460.5, "7:00 p.m.", size=9)

    # Check "Proposing the formation of a new congregation."
    page.draw_line(fitz.Point(47.0, 571.6), fitz.Point(53.0, 578.0), color=BLUE, width=1.2, overlay=True)
    page.draw_line(fitz.Point(53.0, 571.6), fitz.Point(47.0, 578.0), color=BLUE, width=1.2, overlay=True)

    output.parent.mkdir(parents=True, exist_ok=True)
    document.save(output, garbage=4, deflate=True, clean=True)
    document.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    fill(args.source, args.output)


if __name__ == "__main__":
    main()
