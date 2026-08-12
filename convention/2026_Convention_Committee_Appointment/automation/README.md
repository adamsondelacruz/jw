# JW Hub Convention Responsibility Automation

Guarded Playwright implementation of [`plans/00-jw-hub-convention-assignments-playwright-plan.md`](../../../plans/00-jw-hub-convention-assignments-playwright-plan.md).

The initial Accounts Overseer trial was completed successfully. The reviewed manifest now covers the unambiguous mappings in the reorganised chart for convention `5ff3cade-fc3a-4423-bb88-f6bc983a1d1c`. It will not replace an occupied single-person assignment and defaults to dry-run mode.

## Security boundaries

- Authentication is performed manually in a dedicated visible Chrome profile.
- No username, password, or MFA code is accepted or stored by these scripts.
- `.browser-profile/` contains a reusable authenticated session and must be treated like a password.
- The profile, `node_modules/`, screenshots, and audit artifacts are ignored by Git.
- Only `hub.jw.org`, `login.jw.org`, the exact convention ID, the Responsibilities section, and Accounts Overseer are allowed.
- Never run two commands against the profile simultaneously.

## Install

```bash
cd convention/2026_Convention_Committee_Appointment/automation
npm install
```

The implementation uses the installed branded Google Chrome through Playwright's `channel: "chrome"`, so a separate Playwright browser download is not required on this workstation.

## 1. Establish or refresh the session

```bash
npm run login
```

A dedicated Chrome window opens. Sign in manually and complete MFA. When the exact Responsibilities page is visible, return to the terminal and press Enter. The browser then closes cleanly and retains its authenticated profile.

## 2. Check the session headlessly

```bash
npm run check-session
```

This only navigates and validates the event/section. It performs no assignment.

## 3. Inspect responsibilities read-only

```bash
npm run inspect
```

This inventories responsibility action controls, verifies Accounts Overseer uniquely, reports its state, captures read-only evidence, and never opens an assignment control.

## 4. Run the Accounts Overseer dry run

```bash
npm run assign -- --role "Accounts Overseer" --dry-run
```

The script:

1. validates the exact convention and event label;
2. requires Accounts Overseer to be uniquely present and unassigned;
3. opens only that role;
4. searches the jwpub account from `assignments/approved-assignments.json`;
5. verifies the returned identity and confirmation summary;
6. stops without selecting the final confirmation button; and
7. writes a local audit record.

Optional `--email` and `--expected-name` arguments are accepted only if they exactly match the approved manifest. Prefer omitting them so private details do not appear in process listings.

## 5. Submit exactly one assignment

Run this only after reviewing the successful dry-run result:

```bash
npm run assign -- --role "Accounts Overseer" --confirm
```

The script repeats every precondition, submits once, reloads the Responsibilities page, verifies the expected person, checks that exactly one responsibility record changed, writes evidence, and exits. It never moves on to another role.

Independently verify the final state at any time:

```bash
npm run verify
```

For the initial trial this requires Accounts Overseer to show Jerus Joaquin, Accounts Overseer to be absent from the unassigned controls, exactly 33 other controls to remain unassigned, and no other ordinary responsibility to appear in the Assigned section.

## Reviewed chart sync

Dry-run the complete manifest or a resumable slice:

```bash
npm run sync -- --dry-run
npm run sync -- --dry-run --from 0 --limit 3
```

After every selected mapping has passed dry run, sync a small serial slice:

```bash
npm run sync -- --confirm --from 0 --limit 3
```

Run the consolidated live-state reconciliation:

```bash
npm run verify-all
```

The manifest records explicit exclusions for TBC positions and chart roles without a distinct Hub responsibility. Each Save is followed by a fresh-page identity check before the runner advances.

## Tests

```bash
npm test
npm run check
```

## Private artifacts

Run records are created under `artifacts/` with mode `0600`. They include screenshots, expected person/role, source-workbook checksum, checks, result, and errors. They never intentionally include passwords, MFA codes, cookies, headers, tokens, storage state, or page source.

Review retention requirements before keeping screenshots. Delete them only after the assignment has been independently verified and the records are no longer required.

## Failure handling

- Login redirect: run `npm run login` again.
- Role already assigned: stop; replacement is prohibited.
- No/multiple person result or identity mismatch: stop without confirming.
- Unclear submission: inspect/reload before any retry; never blindly resubmit.
- Wrong assignment: stop and document it; do not automatically remove or replace it.
- Suspected profile compromise: sign out/revoke the JW session first, then remove the dedicated profile.
