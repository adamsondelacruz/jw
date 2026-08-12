# JW Hub Convention Assignments — Playwright Automation Plan

**Plan number:** 00  
**Created:** 12 August 2026  
**Status:** Implemented and live trial verified — 12 August 2026  
**Convention:** Auckland NS (TG), 2026  
**Convention ID:** `5ff3cade-fc3a-4423-bb88-f6bc983a1d1c`

## Purpose

Create a controlled Playwright workflow for assigning convention responsibilities in JW Hub from the approved local organisation chart and contact workbook.

The first implementation trial will handle **Accounts Overseer only**. No other responsibility will be changed until the trial has been reviewed and explicitly approved.

## Source records

- `convention/2026_Convention_Committee_Appointment/2026 CONVENTION COMMITTEE.xlsx`
  - Worksheet: `Elder & MS Contact List`
  - Supplies names, congregation/area groupings, mobile numbers, and jwpub email addresses.
- `convention/2026_Convention_Committee_Appointment/coordinator/organisation-chart.html`
  - Working responsibility assignments.
- `convention/2026_Convention_Committee_Appointment/coordinator/contact-masterlist.html`
  - Searchable contact view generated from the workbook.
- JW Hub Responsibilities page:
  - `https://hub.jw.org/convention-information/en/conventions/5ff3cade-fc3a-4423-bb88-f6bc983a1d1c/responsibilities`

## Core design

```text
Interactive login in dedicated Playwright profile
                         ↓
Validate convention ID and Responsibilities page
                         ↓
Read one explicitly approved assignment
                         ↓
Locate the exact responsibility and inspect current state
                         ↓
Find person using verified jwpub email
                         ↓
Compare returned identity with expected name/details
                         ↓
Produce dry-run preview and evidence
                         ↓
Require explicit confirmation mode
                         ↓
Submit one assignment
                         ↓
Reload and verify persisted result; write audit record
```

## Security model

### Authentication

- Use `chromium.launchPersistentContext()` with a dedicated profile directory.
- The user signs in interactively and completes any MFA.
- Do not store the JW Hub username or password in source code, environment files, AWS Secrets Manager, shell history, or logs.
- Reuse only the authenticated session stored in the dedicated Playwright profile.
- If the session expires, reopen the visible login workflow.

### Profile location

Proposed directory:

```text
convention/2026_Convention_Committee_Appointment/automation/.browser-profile/
```

This directory must:

- be excluded from Git;
- have restrictive local permissions;
- never be copied, synchronised, archived, or shared;
- never be used concurrently by more than one browser process;
- be treated as an authentication credential.

### Scope restrictions

The automation must enforce:

- host allowlist: `hub.jw.org` and required JW login hosts only;
- exact convention ID allowlist;
- Responsibilities section only;
- one assignment per invocation;
- dry-run mode by default;
- no removal or replacement of an occupied responsibility without separate approval;
- no bulk mode during the initial trial;
- no parallel assignment operations.

## Proposed project structure

```text
convention/2026_Convention_Committee_Appointment/automation/
├── package.json
├── README.md
├── login.mjs
├── check-session.mjs
├── inspect-responsibilities.mjs
├── assign-responsibility.mjs
├── lib/
│   ├── browser.mjs
│   ├── guardrails.mjs
│   ├── identity.mjs
│   └── audit.mjs
├── assignments/
│   └── approved-assignments.json
├── artifacts/
└── .browser-profile/
```

The `.browser-profile/` and `artifacts/` directories must be ignored by Git. Audit records may contain names and assignment details, so their retention and access must also be controlled.

## Command interface

Proposed commands:

```bash
# Open a visible browser for manual login/MFA.
npm run login

# Confirm that the saved session can reach the exact convention page.
npm run check-session

# Read-only inventory of responsibility names and assignment states.
npm run inspect

# Default: preview only; never submit.
npm run assign -- \
  --role "Accounts Overseer" \
  --email "<approved-jwpub-email>" \
  --expected-name "<approved-name>" \
  --dry-run

# Mutating run, used only after reviewing the dry-run evidence.
npm run assign -- \
  --role "Accounts Overseer" \
  --email "<approved-jwpub-email>" \
  --expected-name "<approved-name>" \
  --confirm
```

The implementation should avoid putting private contact information in process listings where practical. A controlled assignment file may be preferable once multiple assignments are approved.

## Phase 1 — Environment and authentication

- [ ] Create the isolated automation directory and Node package.
- [ ] Install Playwright and its supported Chromium browser.
- [ ] Add `.browser-profile/` and sensitive artifacts to `.gitignore`.
- [ ] Implement `login.mjs` using a visible persistent context.
- [ ] Require the user to sign in and complete MFA manually.
- [ ] Implement `check-session.mjs`.
- [ ] Confirm an expired session fails closed and instructs the user to log in again.
- [ ] Confirm the ordinary Chrome profile is never used.

### Phase 1 acceptance criteria

- A new browser can reach the exact Responsibilities page after one interactive login.
- A later headless run reuses the session without a stored password.
- The session check performs no assignment or other mutation.

## Phase 2 — Read-only page inspection

- [ ] Validate the final host, convention ID, and page heading before reading controls.
- [ ] Discover responsibility rows using accessible labels/roles rather than screen coordinates.
- [ ] Record each responsibility’s title and whether it is assigned or unassigned.
- [ ] Refuse to continue if the expected role is missing, duplicated, or already occupied.
- [ ] Capture a redacted/read-only screenshot for review.
- [ ] Do not click a `+` control during inventory mode.

### Phase 2 acceptance criteria

- The script identifies **Accounts Overseer** uniquely.
- It correctly reports whether the role is unassigned.
- No server-side state changes occur.

## Phase 3 — Accounts Overseer dry run

Expected local mapping at the time this plan was created:

- Responsibility: **Accounts Overseer**
- Expected person: **Jerus Joaquin**
- Source: working organisation chart and `Elder & MS Contact List`

The actual jwpub email must be read from the approved source at run time or supplied through the controlled assignment input. It should not be repeated in general logs or screenshots unless necessary.

- [ ] Verify the source workbook and chart still agree.
- [ ] Open only the Accounts Overseer assignment workflow.
- [ ] Enter the verified jwpub email in Find Person.
- [ ] Submit the search only.
- [ ] Inspect the returned name and available identity details.
- [ ] Compare the returned identity with the expected person.
- [ ] Stop before confirmation.
- [ ] Produce a dry-run report showing pass/fail checks and the pending action.

### Phase 3 fail-closed conditions

Stop without assigning if:

- the convention ID differs;
- the responsibility title differs or is ambiguous;
- Accounts Overseer is already assigned;
- no person is found;
- multiple people are returned;
- the returned identity does not match the expected name/details;
- the page requires an unexpected permission, acknowledgement, or workflow;
- the session becomes unauthenticated;
- any other responsibility would be affected.

## Phase 4 — Single confirmed assignment

This phase is run only after the Phase 3 dry-run report is reviewed.

- [ ] Require the explicit `--confirm` option.
- [ ] Repeat all convention, role, state, and identity checks immediately before mutation.
- [ ] Capture the pre-assignment state.
- [ ] Select the verified person.
- [ ] If JW Hub presents a separate final confirmation, verify its exact role/person summary.
- [ ] Submit once.
- [ ] Wait for the success response or navigation back to Responsibilities.
- [ ] Reload the Responsibilities page independently.
- [ ] Verify Accounts Overseer now shows the expected person.
- [ ] Capture the post-assignment state.
- [ ] Write a timestamped audit result.
- [ ] Stop; do not proceed to another responsibility.

### Phase 4 acceptance criteria

- Exactly one responsibility changes.
- Accounts Overseer displays the expected person after a fresh reload.
- No other responsibility differs from the pre-run inventory.
- Evidence and audit output contain no credentials or session cookies.

## Audit record

Each run should record:

- timestamp and local timezone;
- automation version or Git commit when available;
- convention ID and event label;
- requested responsibility;
- expected person’s name;
- source workbook modification time or checksum;
- dry-run versus confirmed mode;
- precondition results;
- final result and verified post-state;
- screenshot paths, if retained;
- error category when stopped.

Never record:

- passwords;
- MFA codes;
- cookies, authorization headers, access tokens, or full browser storage;
- unrelated contact records;
- page source containing authentication material.

## Phase 5 — Later controlled expansion

Only after the Accounts Overseer trial succeeds:

- [ ] Reconcile the entire chart with the latest appointment letter and JW Hub state.
- [ ] Resolve all `To be confirmed` and `TBC` entries.
- [ ] Create an approved assignment manifest with exact role/name/email mappings.
- [ ] Validate every mapping against the workbook before any mutation.
- [ ] Generate a full dry-run report for human review.
- [ ] Require explicit approval for the reviewed manifest.
- [ ] Apply assignments serially, verifying after each one.
- [ ] Stop on the first discrepancy; do not continue partially without review.
- [ ] Produce a final reconciliation report comparing requested and actual assignments.

## Recovery and rollback

- A failed search requires no rollback because no assignment has occurred.
- If submission status is unclear, reload and inspect before retrying. Never blindly resubmit.
- If the wrong person is assigned, stop immediately and document the state. Do not automatically remove or replace the assignment without explicit approval.
- If the profile appears compromised, close the browser, revoke/sign out the session through the authorised account controls, and delete the dedicated profile only after confirming the session is invalidated.

## Decisions to revisit before implementation

- Whether Playwright’s bundled Chromium or branded Chrome works more reliably with JW Hub authentication.
- Whether the JW Hub login persists fully in the dedicated profile or requires additional session-state handling.
- Whether the final confirmation button itself performs the mutation or opens another review step.
- Which identity attributes JW Hub returns after Find Person and which are safe/reliable for matching.
- Whether audit screenshots should be retained or deleted immediately after verification.
- How long the dedicated browser profile and audit records should be retained.

## Completion definition

This plan is complete when:

1. the dedicated profile is established through manual login;
2. the exact convention Responsibilities page is accessible in a later headless run;
3. the Accounts Overseer dry run correctly finds and verifies the intended person without mutation;
4. a separately approved confirmed run changes only Accounts Overseer;
5. a fresh reload verifies the expected assignment; and
6. the audit record proves the result without exposing authentication material.

## Implementation record — 12 August 2026

Implemented under:

```text
convention/2026_Convention_Committee_Appointment/automation/
```

Verified outcomes:

- Dedicated Playwright persistent profile created through interactive login/MFA.
- Later headless session check reached the exact authenticated Responsibilities page.
- Read-only inventory found 34 initially unassigned responsibility controls and uniquely identified Accounts Overseer.
- Accounts Overseer dry run found **Joaquin, Jerus**, confirmed the expected role and identity, and stopped before Save.
- Confirmed run submitted Accounts Overseer once.
- Independent fresh-page verification proved:
  - Accounts Overseer is assigned to Jerus Joaquin;
  - Accounts Overseer is absent from the unassigned controls;
  - 33 other responsibilities remain unassigned; and
  - no other ordinary responsibility appears in the Assigned section.
- Latest completion-audit verification: `2026-08-12T04-27-02-222Z-audit.json` in the private, Git-ignored `automation/artifacts/` directory.

Operational note: JW Hub persisted the Save asynchronously. The implementation now waits for search completion, records submission metadata, fails closed on uncertain state, and provides a separate read-only `npm run verify` command for independent reconciliation.

## Plan numbering convention

Plans in this folder use a two-digit sequential prefix:

```text
00-jw-hub-convention-assignments-playwright-plan.md
01-next-plan.md
02-following-plan.md
```

Do not renumber existing plans when adding a new one. Use the next unused integer.
