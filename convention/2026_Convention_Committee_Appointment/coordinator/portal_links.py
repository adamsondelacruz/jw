#!/usr/bin/env python3
"""Shared stable links for the coordinator chart, contacts, and communications."""

from __future__ import annotations

import re
import unicodedata


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


# Keyed by jwpub email so workbook name variants do not break existing URLs.
PEOPLE = {
    "1delacruzadamson@jwpub.org": ("Adamson dela Cruz", "adamson-dela-cruz"),
    "ivinuya@jwpub.org": ("Israel Vinuya", "israel-vinuya"),
    "wilfredocalaunan@jwpub.org": ("Wilfredo M Calaunan", "wilfredo-m-calaunan"),
    "ronkennethmariano@jwpub.org": ("Ron Mariano", "ron-mariano"),
    "jjerus2@jwpub.org": ("Jerus Joaquin", "jerus-joaquin"),
    "yasaydomingo@jwpub.org": ("Domingo Yasay", "domingo-yasay"),
    "lvea12@jwpub.org": ("Louie Vea", "louie-vea"),
    "garciajireh@jwpub.org": ("Jireh Garcia", "jireh-garcia"),
    "montemayorr1@jwpub.org": ("Ronnie Montemayor", "ronnie-montemayor"),
    "sxavier13@jwpub.org": ("Xavier Serio", "xavier-serio"),
    "arienzaf2@jwpub.org": ("Francisco Arienza", "francisco-arienza"),
    "2naturals@jwpub.org": ("Samuel Natural", "samuel-natural"),
    "javinante@jwpub.org": ("Jeric Avinante", "jeric-avinante"),
    "rjumanoy@jwpub.org": ("Ralf Jumanoy", "ralf-jumanoy"),
    "bengietalbo@jwpub.org": ("Bengie Talbo", "bengie-talbo"),
    "joanreyl@jwpub.org": ("Joan Rey Lawag", "joan-rey-lawag"),
    "melquesedet23@jwpub.org": ("Melquesedec Torzar", "melquesedec-torzar"),
    "moratakent13@jwpub.org": ("Kent Morata", "kent-morata"),
    "23fernandom@jwpub.org": ("Fernando Martinez", "fernando-martinez"),
    "joeld2@jwpub.org": ("Joel Dela Cruz", "joel-dela-cruz"),
    "georgeintic4@jwpub.org": ("George Intic", "george-intic"),
    "8laxamanaemmanuel@jwpub.org": ("Emmanuel Laxamana", "emmanuel-laxamana"),
    "asunciondaveson20@jwpub.org": ("Daveson Asuncion", "daveson-asuncion"),
    "ruizramon26@jwpub.org": ("Ramon Ruiz", "ramon-ruiz"),
    "garciacharles9@jwpub.org": ("Charles Garcia", "charles-garcia"),
    "imontemayor@jwpub.org": ("Ivander Montemayor", "ivander-montemayor"),
    "jeremiasmeru10@jwpub.org": ("Jeremias Meru", "jeremias-meru"),
    "7limacol@jwpub.org": ("Luis Limaco", "luis-limaco"),
    "sorianomeliton13@jwpub.org": ("Meliton Soriano", "meliton-soriano"),
    "rlumiguid3@jwpub.org": ("Romel Lumiguid", "romel-lumiguid"),
}

PERSON_ALIASES = {
    "Wilfredo Calaunan": "wilfredo-m-calaunan",
    "Wilfred Calaunan": "wilfredo-m-calaunan",
    "Louie Joy Vea": "louie-vea",
    "Israel M Vinuya": "israel-vinuya",
    "Jeremeias Meru": "jeremias-meru",
    "Ferdinand Martinez": "fernando-martinez",
    "Benjie Talbo": "bengie-talbo",
}


# (chart anchor, displayed role, communication record). One person may have several roles.
ROLE_LINKS = {
    "1delacruzadamson@jwpub.org": [("role-coordinator", "Convention Committee Coordinator", "committee")],
    "ivinuya@jwpub.org": [("role-program-overseer", "Program Overseer", "committee")],
    "wilfredocalaunan@jwpub.org": [("role-rooming-overseer", "Rooming Overseer", "committee")],
    "ronkennethmariano@jwpub.org": [("role-coordinator-assistant", "Coordinator Assistant", "coordinator-assistant")],
    "jjerus2@jwpub.org": [("role-accounts", "Accounts Overseer", "accounts")],
    "yasaydomingo@jwpub.org": [("role-accounts", "Accounts Assistant", "accounts")],
    "lvea12@jwpub.org": [("role-attendant", "Attendant Overseer", "attendant-overseer-louie"), ("role-baptism", "Baptism Assistant", "baptism")],
    "garciajireh@jwpub.org": [("role-attendant", "Attendant Assistant", "attendant")],
    "montemayorr1@jwpub.org": [("role-attendant", "Attendant Assistant", "attendant")],
    "sxavier13@jwpub.org": [("role-first-aid", "First Aid Overseer", "first-aid")],
    "arienzaf2@jwpub.org": [("role-first-aid", "First Aid Assistant", "first-aid")],
    "2naturals@jwpub.org": [("role-first-aid", "First Aid Assistant", "first-aid")],
    "javinante@jwpub.org": [("role-parking", "Parking Overseer", "parking")],
    "rjumanoy@jwpub.org": [("role-parking", "Parking Assistant", "parking")],
    "bengietalbo@jwpub.org": [("role-parking", "Parking Assistant", "parking")],
    "joanreyl@jwpub.org": [("role-safety", "Safety Coordinator", "safety")],
    "melquesedet23@jwpub.org": [("role-safety", "Safety Assistant", "safety")],
    "moratakent13@jwpub.org": [("role-program-overseer-assistant", "Program Overseer Assistant", "program-overseer-assistant-kent")],
    "23fernandom@jwpub.org": [("role-audio-video", "Audio/Video Overseer", "audio-video-overseer-ferdinand")],
    "joeld2@jwpub.org": [("role-audio-video", "Audio/Video Assistant", "audio-video")],
    "georgeintic4@jwpub.org": [("role-audio-video", "Audio/Video Assistant", "audio-video-assistant-george")],
    "8laxamanaemmanuel@jwpub.org": [("role-baptism", "Baptism Overseer", "baptism")],
    "asunciondaveson20@jwpub.org": [("role-rooming-overseer-assistant", "Rooming Overseer Assistant", "daveson-receipt-check")],
    "ruizramon26@jwpub.org": [("role-cleaning", "Cleaning Overseer", "cleaning")],
    "garciacharles9@jwpub.org": [("role-cleaning", "Cleaning Assistant", "cleaning")],
    "imontemayor@jwpub.org": [("role-cleaning", "Cleaning Assistant", "cleaning")],
    "jeremiasmeru10@jwpub.org": [("role-information-lost-found", "Information / Lost & Found Overseer", "information-lost-found")],
    "7limacol@jwpub.org": [("role-information-lost-found", "Information / Lost & Found Assistant", "information-lost-found")],
    "sorianomeliton13@jwpub.org": [("role-rooming-department", "Rooming Department Overseer", "rooming")],
    "rlumiguid3@jwpub.org": [("role-rooming-department", "Rooming Department Assistant", "rooming")],
}


COMMUNICATION_ROLES = {
    "committee": "role-coordinator",
    "committee-meeting-2026-08-19": "role-coordinator",
    "co53-meeting-2026-08-22": "role-coordinator",
    "program-overseer-assistant-kent": "role-program-overseer-assistant",
    "audio-video-overseer-ferdinand": "role-audio-video",
    "audio-video-assistant-george": "role-audio-video",
    "attendant-overseer-louie": "role-attendant",
    "coordinator-assistant": "role-coordinator-assistant",
    "accounts": "role-accounts",
    "attendant": "role-attendant",
    "audio-video": "role-audio-video",
    "baptism": "role-baptism",
    "cleaning": "role-cleaning",
    "first-aid": "role-first-aid",
    "parking": "role-parking",
    "information-lost-found": "role-information-lost-found",
    "safety": "role-safety",
    "rooming": "role-rooming-department",
    "daveson-receipt-check": "role-rooming-overseer-assistant",
}


def person_id(name: str, email: str = "") -> str:
    record = PEOPLE.get(email.lower())
    return f"person-{record[1] if record else slugify(name)}"


def preferred_name(name: str, email: str = "") -> str:
    record = PEOPLE.get(email.lower())
    return record[0] if record else name
