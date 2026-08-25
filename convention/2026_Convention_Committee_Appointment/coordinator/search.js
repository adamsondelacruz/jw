(() => {
  "use strict";
  const data = window.CONVENTION_SEARCH_INDEX;
  const input = document.getElementById("search-input");
  const form = document.getElementById("search-form");
  const resultsNode = document.getElementById("search-results");
  const emptyNode = document.getElementById("search-empty");
  const statusNode = document.getElementById("search-status");
  const sourceSelect = document.getElementById("source-select");
  const scopeButtons = [...document.querySelectorAll("[data-scope]")];
  let scope = "all";
  let timer;

  if (!data) {
    statusNode.textContent = "The search index could not be loaded. Rebuild search-index.js and reload this page.";
    return;
  }

  const sourceMap = new Map(data.sources.map(source => [source.id, source]));
  for (const source of [...data.sources].sort((a, b) => a.priority - b.priority)) {
    const option = document.createElement("option");
    option.value = source.id;
    option.textContent = `${source.name} — ${source.title}`;
    sourceSelect.append(option);
  }
  document.getElementById("index-meta").textContent = `${data.entries.length.toLocaleString()} searchable passages from ${data.sources.length} local sources.`;

  function normalized(value) {
    return String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function termsFor(query) {
    const matches = [...query.matchAll(/"([^"]+)"|([^\s]+)/g)];
    return matches.map(match => normalized(match[1] || match[2]).replace(/^[^a-z0-9]+|[^a-z0-9-]+$/g, "")).filter(Boolean);
  }

  function score(entry, query, terms) {
    const title = normalized(`${entry.source} ${entry.title} ${entry.reference}`);
    const text = normalized(entry.text);
    if (!terms.every(term => title.includes(term) || text.includes(term))) return -1;
    let value = 0;
    const phrase = normalized(query.trim().replace(/^"|"$/g, ""));
    if (phrase && text.includes(phrase)) value += 100;
    if (phrase && title.includes(phrase)) value += 160;
    const positions = [];
    for (const term of terms) {
      if (title.includes(term)) value += 45;
      const position = text.indexOf(term);
      if (position >= 0) positions.push(position);
      value += Math.min(8, text.split(term).length - 1) * 5;
    }
    if (positions.length > 1) value += Math.max(0, 35 - (Math.max(...positions) - Math.min(...positions)) / 15);
    if (entry.type === "co1" && /^\d+:\d+$/.test(normalized(query))) value += entry.reference === query ? 300 : 0;
    return value;
  }

  function excerpt(text, terms) {
    const lower = normalized(text);
    let first = Math.min(...terms.map(term => lower.indexOf(term)).filter(index => index >= 0));
    if (!Number.isFinite(first)) first = 0;
    let start = Math.max(0, first - 105), end = Math.min(text.length, first + 230);
    if (start) start = text.lastIndexOf(" ", start) + 1;
    if (end < text.length) end = text.indexOf(" ", end) > 0 ? text.indexOf(" ", end) : end;
    const passage = text.slice(start, end);
    return `${start ? "…" : ""}${highlight(passage, terms)}${end < text.length ? "…" : ""}`;
  }

  function escape(value) {
    return value.replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]);
  }

  function highlight(value, terms) {
    const pattern = new RegExp(`(${terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a,b) => b.length-a.length).join("|")})`, "gi");
    let cursor = 0, output = "", match;
    while ((match = pattern.exec(value))) {
      output += escape(value.slice(cursor, match.index));
      output += `<mark>${escape(match[0])}</mark>`;
      cursor = match.index + match[0].length;
    }
    return output + escape(value.slice(cursor));
  }

  function renderGroup(source, matches, terms, index) {
    const visible = matches.slice(0, 8);
    const details = document.createElement("details");
    details.className = "result-group";
    details.open = index < 3 || terms.every(term => normalized(source.name).includes(term));
    details.innerHTML = `<summary><span class="source-heading"><strong>${escape(source.name)}</strong><small>${escape(source.title)}</small></span><span class="result-count">${matches.length} result${matches.length === 1 ? "" : "s"}</span></summary><div class="result-list"></div>`;
    const list = details.querySelector(".result-list");
    function append(items) {
      for (const {entry} of items) {
        const article = document.createElement("article");
        article.className = "search-result";
        const target = entry.type === "co1" ? ' target="co1_reference"' : (entry.type === "form" || /\.pdf(?:$|#)/i.test(entry.url)) ? ' target="_blank" rel="noopener"' : "";
        const label = entry.type === "co1" ? `CO-1 ${entry.reference}` : `${entry.source} · ${entry.reference}`;
        article.innerHTML = `<div class="result-topline"><a class="result-title" href="${escape(entry.url)}"${target}>${escape(label)} — ${escape(entry.title)}</a><span class="result-reference">${escape(entry.type === "co1" ? entry.title : entry.source)}</span></div><p class="result-context">${excerpt(entry.text, terms)}</p>`;
        if (entry.type === "co1") article.querySelector(".result-title").addEventListener("click", event => {
          event.preventDefault();
          const reference = window.open(event.currentTarget.href, "co1_reference");
          if (reference) reference.focus();
        });
        list.append(article);
      }
    }
    append(visible);
    if (matches.length > visible.length) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "show-more";
      button.textContent = `Show ${matches.length - visible.length} more from ${source.name}`;
      button.addEventListener("click", () => { append(matches.slice(visible.length)); button.remove(); });
      details.append(button);
    }
    return details;
  }

  function run(updateUrl = true) {
    const query = input.value.trim();
    const terms = termsFor(query);
    const selectedSource = sourceSelect.value;
    resultsNode.replaceChildren();
    if (query.length < 2 || !terms.length) {
      statusNode.textContent = "";
      emptyNode.hidden = false;
      if (updateUrl) setUrl(query);
      return;
    }
    emptyNode.hidden = true;
    const matches = data.entries
      .filter(entry => (scope === "all" || entry.type === scope) && (!selectedSource || entry.sourceId === selectedSource))
      .map(entry => ({entry, score: score(entry, query, terms)}))
      .filter(item => item.score >= 0);
    const groups = new Map();
    for (const item of matches) {
      if (!groups.has(item.entry.sourceId)) groups.set(item.entry.sourceId, []);
      groups.get(item.entry.sourceId).push(item);
    }
    const ordered = [...groups.entries()].sort((a, b) => sourceMap.get(a[0]).priority - sourceMap.get(b[0]).priority);
    for (const [, items] of ordered) items.sort((a, b) => b.score - a.score || a.entry.reference.localeCompare(b.entry.reference, undefined, {numeric:true}));
    statusNode.textContent = matches.length ? `${matches.length} result${matches.length === 1 ? "" : "s"} in ${groups.size} source${groups.size === 1 ? "" : "s"} for “${query}”` : `No results for “${query}”`;
    if (!matches.length) resultsNode.innerHTML = `<div class="no-results"><h2>No matching passages</h2><p>Try fewer words, a form code, or a broader term.</p></div>`;
    else ordered.forEach(([sourceId, items], index) => resultsNode.append(renderGroup(sourceMap.get(sourceId), items, terms, index)));
    if (updateUrl) setUrl(query);
  }

  function setUrl(query) {
    const url = new URL(location.href);
    query ? url.searchParams.set("q", query) : url.searchParams.delete("q");
    scope === "all" ? url.searchParams.delete("scope") : url.searchParams.set("scope", scope);
    sourceSelect.value ? url.searchParams.set("source", sourceSelect.value) : url.searchParams.delete("source");
    history.replaceState(null, "", url);
  }

  form.addEventListener("submit", event => { event.preventDefault(); clearTimeout(timer); run(); });
  input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(run, 120); });
  sourceSelect.addEventListener("change", run);
  scopeButtons.forEach(button => button.addEventListener("click", () => {
    scope = button.dataset.scope;
    scopeButtons.forEach(item => item.setAttribute("aria-pressed", String(item === button)));
    if (sourceSelect.value && sourceMap.get(sourceSelect.value)?.type !== scope && scope !== "all") sourceSelect.value = "";
    run();
  }));
  document.querySelectorAll("[data-query]").forEach(button => button.addEventListener("click", () => { input.value = button.dataset.query; run(); input.focus(); }));
  document.addEventListener("keydown", event => {
    if (event.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName)) { event.preventDefault(); input.focus(); }
    if (event.key === "Escape" && document.activeElement === input) { input.value = ""; run(); }
  });

  const initial = new URLSearchParams(location.search);
  input.value = initial.get("q") || "";
  const requestedScope = initial.get("scope");
  if (["co1", "form", "guidance"].includes(requestedScope)) {
    scope = requestedScope;
    scopeButtons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.scope === scope)));
  }
  if (sourceMap.has(initial.get("source"))) sourceSelect.value = initial.get("source");
  run(false);
})();
