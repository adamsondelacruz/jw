(() => {
  "use strict";
  const VERSION = 1;
  const EVENT = "2026 Auckland Tagalog Convention";
  const STORAGE_KEY = "jw-convention-checklist-state:v1:auckland-tg-2026";
  const script = document.currentScript;
  const projectRoot = new URL(".", script.src);
  const page = decodeURIComponent(location.pathname.slice(new URL(projectRoot).pathname.length)).replace(/^\//, "");
  const seed = window.CONVENTION_CHECKLIST_SEED?.version === VERSION ? window.CONVENTION_CHECKLIST_SEED : {items:{}};
  let storageAvailable = true;
  let state = loadState();

  convertTableGlyphs();
  const boxes = [...document.querySelectorAll('input[type="checkbox"]')];
  if (!boxes.length) return;

  const occurrences = new Map();
  for (const box of boxes) {
    const label = itemLabel(box);
    const base = `${page}::${hash(normalize(label))}`;
    const count = (occurrences.get(base) || 0) + 1;
    occurrences.set(base, count);
    const id = count === 1 ? base : `${base}-${count}`;
    box.dataset.checklistId = id;
    box.dataset.defaultChecked = String(box.checked);
    box.id ||= `check-${hash(id)}`;
    box.disabled = false;
    const saved = newest(seed.items[id], state.items[id]);
    if (saved) box.checked = saved.checked;
    state.items[id] = {
      checked: box.checked,
      label,
      page,
      updatedAt: saved?.updatedAt || null,
    };
    updateRow(box);
    box.addEventListener("change", () => {
      state.items[id] = {checked:box.checked,label,page,updatedAt:new Date().toISOString()};
      state.updatedAt = new Date().toISOString();
      updateRow(box);
      persist();
      updateProgress();
      announce("Saved automatically in this browser.");
    });
  }
  persist();
  const bar = createToolbar();
  const nav = document.querySelector(".site-nav, body>nav");
  (nav || document.body.firstElementChild)?.insertAdjacentElement("afterend", bar);
  updateProgress();

  function loadState() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (value?.version === VERSION && value.items && typeof value.items === "object") return value;
    } catch (_) {
      storageAvailable = false;
    }
    return {version:VERSION,event:EVENT,updatedAt:null,items:{}};
  }

  function persist() {
    if (!storageAvailable) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (_) { storageAvailable = false; }
  }

  function newest(left, right) {
    if (!left) return right;
    if (!right) return left;
    return String(right.updatedAt || "") >= String(left.updatedAt || "") ? right : left;
  }

  function normalize(value) {
    return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function hash(value) {
    let result = 2166136261;
    for (let index = 0; index < value.length; index++) {
      result ^= value.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    return (result >>> 0).toString(36);
  }

  function itemLabel(box) {
    const label = box.closest("label")?.innerText;
    if (label?.trim()) return label.trim();
    const row = box.closest("tr");
    if (row) return [...row.cells].filter(cell => !cell.contains(box)).map(cell => cell.innerText.trim()).filter(Boolean).join(" — ");
    return box.getAttribute("aria-label") || `Checklist item ${boxes.indexOf(box) + 1}`;
  }

  function convertTableGlyphs() {
    for (const cell of document.querySelectorAll("td")) {
      const value = cell.textContent.trim();
      if (!/^[☐☑□]$/.test(value)) continue;
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = value === "☑";
      input.className = "checklist-table-box";
      const rowText = [...cell.parentElement.cells].filter(item => item !== cell).map(item => item.textContent.trim()).filter(Boolean).join(" — ");
      input.setAttribute("aria-label", `Complete: ${rowText}`);
      cell.replaceChildren(input);
    }
  }

  function updateRow(box) {
    const container = box.closest("li, tr");
    container?.classList.toggle("checklist-complete", box.checked);
  }

  function createToolbar() {
    const container = document.createElement("section");
    container.className = "checklist-state-bar";
    container.setAttribute("aria-label", "Checklist state controls");
    container.innerHTML = `<div class="checklist-progress"><strong id="checklist-progress">Checklist progress</strong><small>${storageAvailable ? "Changes persist automatically on this browser." : "Browser storage unavailable; export JSON before closing."}</small></div><div class="checklist-state-actions"><button type="button" data-action="export">Export JSON</button><button type="button" data-action="import">Import JSON</button><button type="button" class="checklist-reset" data-action="reset">Reset this page</button><input type="file" accept="application/json,.json" hidden></div><p class="checklist-toast" role="status" aria-live="polite"></p>`;
    container.querySelector('[data-action="export"]').addEventListener("click", exportJson);
    const file = container.querySelector('input[type="file"]');
    container.querySelector('[data-action="import"]').addEventListener("click", () => file.click());
    file.addEventListener("change", () => importJson(file.files[0], file));
    container.querySelector('[data-action="reset"]').addEventListener("click", resetPage);
    return container;
  }

  function updateProgress() {
    const complete = boxes.filter(box => box.checked).length;
    document.getElementById("checklist-progress").textContent = `${complete} of ${boxes.length} complete (${Math.round(complete / boxes.length * 100)}%)`;
  }

  function announce(message, kind = "success") {
    const node = document.querySelector(".checklist-toast");
    if (!node) return;
    node.textContent = message;
    node.dataset.kind = kind;
  }

  function exportJson() {
    state.updatedAt = new Date().toISOString();
    const blob = new Blob([JSON.stringify(state, null, 2) + "\n"], {type:"application/json"});
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "2026-convention-checklist-state.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    announce("Checklist state exported as JSON.");
  }

  async function importJson(file, input) {
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      if (imported.version !== VERSION || !imported.items || typeof imported.items !== "object") throw new Error("Expected a version 1 checklist state file.");
      let importedCount = 0;
      for (const [id, item] of Object.entries(imported.items)) {
        if (!item || typeof item.checked !== "boolean") continue;
        state.items[id] = newest(state.items[id], item);
        importedCount++;
      }
      state.updatedAt = new Date().toISOString();
      for (const box of boxes) {
        const item = state.items[box.dataset.checklistId];
        if (item) { box.checked = item.checked; updateRow(box); }
      }
      persist(); updateProgress();
      announce(`Imported ${importedCount} checklist item${importedCount === 1 ? "" : "s"}.`);
    } catch (error) {
      announce(`Import failed: ${error.message}`, "error");
    } finally { input.value = ""; }
  }

  function resetPage() {
    if (!confirm("Reset every checkbox on this page to the document defaults?")) return;
    for (const box of boxes) {
      box.checked = box.dataset.defaultChecked === "true";
      state.items[box.dataset.checklistId] = {checked:box.checked,label:itemLabel(box),page,updatedAt:new Date().toISOString()};
      updateRow(box);
    }
    state.updatedAt = new Date().toISOString();
    persist(); updateProgress(); announce("This page was reset to its document defaults.");
  }
})();
