import test from "node:test";
import assert from "node:assert/strict";
import { assertApprovedDestination, assertReadOnlyArguments, normalizeUrl, selectApprovedPage } from "../02-guardrails.mjs";

const manifest = {
  default_mode: "dry-run",
  approved_pages: [{ id: "docs", url: "https://docs.jw.org/en/example", operations: ["inspect"] }],
  approved_mutations: [],
};

test("selects exactly one reviewed page", () => {
  assert.equal(selectApprovedPage(manifest, "docs").url, "https://docs.jw.org/en/example");
  assert.throws(() => selectApprovedPage(manifest, "missing"), /Expected one approved page/);
});

test("requires HTTPS and the exact approved path", () => {
  assert.throws(() => normalizeUrl("http://docs.jw.org/en/example"), /Only HTTPS/);
  assert.equal(assertApprovedDestination("https://docs.jw.org/en/example?view=1", "https://docs.jw.org/en/example"), true);
  assert.throws(() => assertApprovedDestination("https://docs.jw.org/en/other", "https://docs.jw.org/en/example"), /Expected/);
  assert.throws(() => assertApprovedDestination("https://login.jw.org/login", "https://docs.jw.org/en/example"), /manually/);
});

test("defaults to read-only and rejects mutation flags", () => {
  assert.equal(assertReadOnlyArguments([]), "dry-run");
  for (const flag of ["--confirm", "--submit", "--send", "--upload", "--assign", "--save"]) {
    assert.throws(() => assertReadOnlyArguments([flag]), /prohibited/);
  }
});
