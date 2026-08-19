# New-congregation browser automation

This project reuses the account-scoped Chrome session stored under the repository root `.jw-automation/` directory. Authentication is shared; project authority is not.

The current project manifest permits read-only inspection of:

- the authenticated JW Docs shared-items page;
- the JW meeting locator used for territory research.

There are **no approved mutations**. These scripts cannot submit a form, send an email, upload a document, or change a JW record.

## One-time install

```bash
cd congregation/forming-new-cong/automation
npm install
```

## Shared session

Check whether the shared session is running:

```bash
npm run session:status
```

Start or reuse the shared Chrome profile and open an approved page:

```bash
npm run session:start -- --url "https://docs.jw.org/en/-/cds-cat-docs-shared-with-you"
```

Complete login and MFA manually in the visible browser. Passwords, cookies and MFA values are never accepted by these scripts.

## Read-only checks

```bash
npm run check-session -- --page jw-docs-shared
npm run inspect -- --page jw-docs-shared
npm run inspect -- --page meeting-locator
```

The inspection records only sanitized metadata and a private screenshot under `.jw-automation/artifacts/forming-new-cong/`. It does not retain page source, body text, cookies, request headers or tokens.

## Safety

- The exact URLs and operations come from `../data/00-project.json`.
- Login redirects fail closed and require manual intervention.
- Unknown page keys and path changes are refused.
- `--confirm` and other mutation language are rejected.
- Do not run two browser commands simultaneously.
- A future external write requires a separately reviewed manifest, dry run, explicit confirmation, fresh-state check and independent verification implementation.

Run local checks with:

```bash
npm test
npm run check
```
