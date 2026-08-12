import test from "node:test";
import assert from "node:assert/strict";
import { CONVENTION_ID } from "../lib/config.mjs";
import { diffSnapshots, findUniqueResponsibility } from "../lib/page-model.mjs";

const root = `https://hub.jw.org/convention-information/en/conventions/${CONVENTION_ID}/responsibilities`;

test("finds one unassigned Accounts Overseer control", () => {
  const result = findUniqueResponsibility([
    { text: "Accounts Overseer", actionText: "Accounts Overseer", href: `${root}/abc/assign` },
    { text: "Accounts Overseer Assistant", actionText: "Accounts Overseer Assistant", href: `${root}/assistant/assign` },
    { text: "Attendant Overseer", actionText: "Attendant Overseer", href: `${root}/def/assign` },
  ], "Accounts Overseer");
  assert.equal(result.unassigned, true);
});

test("refuses missing, duplicate, and occupied roles", () => {
  assert.throws(() => findUniqueResponsibility([], "Accounts Overseer"), { code: "role-ambiguity" });
  assert.throws(() => findUniqueResponsibility([
    { text: "Accounts Overseer", actionText: "Accounts Overseer", href: `${root}/a/assign` },
    { text: "Accounts Overseer", actionText: "Accounts Overseer", href: `${root}/b/assign` },
  ], "Accounts Overseer"), { code: "role-ambiguity" });
  const occupied = findUniqueResponsibility([
    { text: "Accounts Overseer Jerus Joaquin", actionText: "Accounts Overseer", href: `${root}/a/unassign` },
  ], "Accounts Overseer");
  assert.equal(occupied.unassigned, false);
});

test("snapshot diff exposes exact scope", () => {
  const before = [{ text: "Accounts Overseer", actionText: "Accounts Overseer", href: `${root}/a/assign` }];
  const after = [{ text: "Accounts Overseer Jerus Joaquin", actionText: "Accounts Overseer", href: `${root}/a/unassign` }];
  assert.deepEqual(diffSnapshots(before, after), { removed: before, added: after });
});
