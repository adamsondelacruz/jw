import { CONVENTION_ID, EVENT_LABEL, RESPONSIBILITIES_URL } from "./config.mjs";
import { GuardrailError, assertAllowedUrl, assertEventText, normalizeSpace } from "./guardrails.mjs";

export async function gotoResponsibilities(page) {
  await page.goto(RESPONSIBILITIES_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(
    () => /auckland\s+ns\s*\(tg\).*2026/i.test(document.body?.innerText ?? ""),
    null,
    { timeout: 15_000 },
  ).catch(() => {});
  assertAllowedUrl(page.url());
  const body = normalizeSpace(await page.locator("body").innerText());
  assertEventText(body);
  if (!/responsibilities/i.test(body)) throw new GuardrailError("missing-heading", "Responsibilities heading was not found.");
  return body;
}

export async function snapshotResponsibilities(page) {
  assertAllowedUrl(page.url());
  return page.evaluate(() => {
    const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
    const candidates = [...document.querySelectorAll('a[href*="/responsibilities/"]')]
      .filter(a => /\/(?:assign|unassign)(?:\/|$)/.test(a.getAttribute("href") || ""));
    return candidates.map(anchor => {
      const card = anchor.closest("article.card");
      const cardRole = clean(card?.querySelector("h3")?.innerText);
      let container = anchor;
      for (let i = 0; i < 6 && container.parentElement; i += 1) {
        container = container.parentElement;
        const text = clean(container.innerText);
        if (text.length > 3 && text.length < 500) break;
      }
      return {
        href: new URL(anchor.getAttribute("href"), location.href).href,
        actionText: cardRole || clean(anchor.getAttribute("aria-label") || anchor.title || anchor.innerText),
        text: clean(container.innerText),
        section: (() => {
          const headings = [...document.querySelectorAll("h2")].filter(heading =>
            Boolean(heading.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_FOLLOWING));
          return clean(headings.at(-1)?.innerText);
        })(),
      };
    });
  });
}

export function findUniqueResponsibility(snapshot, role, section = undefined) {
  const roleLower = role.toLowerCase();
  const matches = snapshot.filter(item =>
    item.actionText.toLowerCase() === roleLower && (!section || item.section === section));
  if (matches.length !== 1) {
    throw new GuardrailError("role-ambiguity", `Expected one ${role} control; found ${matches.length}.`);
  }
  const match = matches[0];
  const parsed = assertAllowedUrl(match.href);
  if (!parsed.url.pathname.includes(`/conventions/${CONVENTION_ID}/responsibilities/`)) {
    throw new GuardrailError("wrong-role-link", "Responsibility action points outside the approved convention.");
  }
  const unassigned = /\/assign(?:\/|$)/.test(parsed.url.pathname) && !/\/unassign(?:\/|$)/.test(parsed.url.pathname);
  return { ...match, unassigned };
}

export function diffSnapshots(before, after) {
  const key = item => `${item.href}|${item.text}|${item.actionText}`;
  const beforeSet = new Set(before.map(key));
  const afterSet = new Set(after.map(key));
  return {
    removed: before.filter(item => !afterSet.has(key(item))),
    added: after.filter(item => !beforeSet.has(key(item))),
  };
}

export async function assignedResponsibility(page, role, section = undefined) {
  assertAllowedUrl(page.url());
  const exact = await page.evaluate(({ role, section }) => {
    const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
    return [...document.querySelectorAll("article.card")].flatMap((card, index) => {
      if (clean(card.querySelector("h3")?.innerText) !== role) return [];
      const preceding = [...document.querySelectorAll("h2")].filter(heading =>
        Boolean(heading.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING));
      const cardSection = clean(preceding.at(-1)?.innerText);
      if (section && cardSection !== section) return [];
      return [{ text: clean(card.innerText), index, section: cardSection }];
    });
  }, { role, section });
  if (exact.length > 1) throw new GuardrailError("assigned-role-ambiguity", `Expected at most one assigned ${role} card; found ${exact.length}.`);
  return exact[0] ?? null;
}

export async function openAssignment(page, responsibility, role) {
  if (!responsibility.unassigned) throw new GuardrailError("already-assigned", `${role} is already occupied; no replacement is allowed.`);
  await page.goto(responsibility.href, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => /find person/i.test(document.body?.innerText ?? ""), null, { timeout: 15_000 });
  assertAllowedUrl(page.url());
  const body = normalizeSpace(await page.locator("body").innerText());
  assertEventText(body);
  if (!body.toLowerCase().includes(`select ${role}`.toLowerCase())) {
    throw new GuardrailError("wrong-assignment-page", `Expected Select ${role} page.`);
  }
}

export async function findPerson(page, email) {
  const input = page.getByRole("textbox", { name: /username/i });
  if (await input.count() !== 1) throw new GuardrailError("username-field-ambiguity", "Expected one Username field.");
  await input.fill(email);
  const find = page.getByRole("button", { name: /^find$/i });
  if (await find.count() !== 1) throw new GuardrailError("find-button-ambiguity", "Expected one Find button.");
  await find.click();
  await page.waitForFunction(
    () => !/please wait/i.test(document.body?.innerText ?? ""),
    null,
    { timeout: 30_000 },
  );
  assertAllowedUrl(page.url());
  return normalizeSpace(await page.locator("body").innerText());
}

export async function confirmationSummary(page) {
  const body = normalizeSpace(await page.locator("body").innerText());
  if (!/confirm/i.test(body)) throw new GuardrailError("missing-confirmation", "JW Hub did not present the expected Confirm step.");
  return body;
}

export async function submitConfirmation(page) {
  const buttons = page.getByRole("button", { name: /^(confirm|assign|save)$/i });
  const count = await buttons.count();
  if (count !== 1) throw new GuardrailError("confirm-button-ambiguity", `Expected one final confirmation button; found ${count}.`);
  const responses = [];
  const failures = [];
  const onResponse = response => {
    if (response.request().method() === "GET") return;
    const url = new URL(response.url());
    responses.push({ method: response.request().method(), status: response.status(), origin: url.origin, path: url.pathname });
  };
  const onFailure = request => {
    if (request.method() === "GET") return;
    const url = new URL(request.url());
    failures.push({ method: request.method(), origin: url.origin, path: url.pathname, error: request.failure()?.errorText ?? "unknown" });
  };
  page.on("response", onResponse);
  page.on("requestfailed", onFailure);
  await buttons.click();
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  if (!page.url().includes(`/conventions/${CONVENTION_ID}/responsibilities`)) {
    await page.waitForURL(`**/conventions/${CONVENTION_ID}/responsibilities`, { timeout: 20_000 }).catch(() => {});
  }
  await page.waitForTimeout(2_000);
  page.off("response", onResponse);
  page.off("requestfailed", onFailure);
  return {
    responses,
    failures,
    finalUrl: page.url(),
    pageText: (await page.locator("body").innerText()).replace(/\s+/g, " ").trim().slice(0, 1_000),
  };
}

export function safeInventory(snapshot) {
  return snapshot.map(({ text, unassigned, actionText }) => ({ text, state: unassigned ? "unassigned" : "assigned", actionText }));
}

export { EVENT_LABEL };
