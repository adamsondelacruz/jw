(() => {
  const data = window.FORMING_CONG_SEARCH_INDEX;
  const input = document.getElementById("search-input");
  const form = document.getElementById("search-form");
  const type = document.getElementById("search-type");
  const results = document.getElementById("search-results");
  const empty = document.getElementById("search-empty");
  const status = document.getElementById("search-status");
  const meta = document.getElementById("search-meta");
  let timer;

  if (!data || !input || !form || !results) return;
  meta.textContent = `${data.entries.length} searchable passages from ${data.sources.length} local sources`;

  const normalize = value => String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const escape = value => String(value).replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]);
  const termsFor = query => [...query.matchAll(/"([^"]+)"|([^\s]+)/g)]
    .map(match => normalize(match[1] || match[2]).replace(/^[^a-z0-9]+|[^a-z0-9-]+$/g, ""))
    .filter(Boolean);

  function score(entry, query, terms) {
    const heading = normalize(`${entry.source} ${entry.title} ${entry.reference}`);
    const text = normalize(entry.text);
    if (!terms.every(term => heading.includes(term) || text.includes(term))) return -1;
    let value = Math.max(0, 40 - entry.priority);
    const phrase = normalize(query.trim().replace(/^"|"$/g, ""));
    if (phrase && heading.includes(phrase)) value += 140;
    if (phrase && text.includes(phrase)) value += 100;
    for (const term of terms) {
      if (heading.includes(term)) value += 45;
      value += Math.min(6, text.split(term).length - 1) * 6;
    }
    return value;
  }

  function highlight(value, terms) {
    if (!terms.length) return escape(value);
    const pattern = new RegExp(`(${terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, b) => b.length - a.length).join("|")})`, "gi");
    let cursor = 0;
    let output = "";
    let match;
    while ((match = pattern.exec(value))) {
      output += escape(value.slice(cursor, match.index));
      output += `<mark>${escape(match[0])}</mark>`;
      cursor = match.index + match[0].length;
    }
    return output + escape(value.slice(cursor));
  }

  function excerpt(value, terms) {
    const lower = normalize(value);
    const positions = terms.map(term => lower.indexOf(term)).filter(position => position >= 0);
    const first = positions.length ? Math.min(...positions) : 0;
    let start = Math.max(0, first - 95);
    let end = Math.min(value.length, first + 270);
    if (start) start = value.lastIndexOf(" ", start) + 1;
    if (end < value.length) {
      const next = value.indexOf(" ", end);
      if (next > 0) end = next;
    }
    return `${start ? "…" : ""}${highlight(value.slice(start, end), terms)}${end < value.length ? "…" : ""}`;
  }

  function setUrl(query) {
    const url = new URL(location.href);
    query ? url.searchParams.set("q", query) : url.searchParams.delete("q");
    type.value ? url.searchParams.set("type", type.value) : url.searchParams.delete("type");
    history.replaceState(null, "", url);
  }

  function run(updateUrl = true) {
    const query = input.value.trim();
    const terms = termsFor(query);
    results.replaceChildren();
    if (query.length < 2 || !terms.length) {
      status.textContent = "";
      empty.hidden = false;
      if (updateUrl) setUrl(query);
      return;
    }
    empty.hidden = true;
    const matches = data.entries
      .filter(entry => !type.value || entry.type === type.value)
      .map(entry => ({entry, score: score(entry, query, terms)}))
      .filter(item => item.score >= 0)
      .sort((a, b) => b.score - a.score || a.entry.priority - b.entry.priority || a.entry.title.localeCompare(b.entry.title));
    status.textContent = matches.length
      ? `${matches.length} result${matches.length === 1 ? "" : "s"} for “${query}”`
      : `No results for “${query}”`;
    if (!matches.length) {
      results.innerHTML = '<div class="no-results"><h2>No matching passages</h2><p>Try fewer words, a form code, a person’s surname, or a broader term.</p></div>';
    } else {
      for (const {entry} of matches.slice(0, 100)) {
        const article = document.createElement("article");
        article.className = "search-result";
        article.innerHTML = `<div class="result-topline"><a href="${escape(entry.url)}">${escape(entry.source)} — ${escape(entry.title)}</a><span>${escape(entry.type)}</span></div><p>${excerpt(entry.text, terms)}</p>`;
        results.append(article);
      }
    }
    if (updateUrl) setUrl(query);
  }

  form.addEventListener("submit", event => { event.preventDefault(); clearTimeout(timer); run(); });
  input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(run, 120); });
  type.addEventListener("change", run);
  document.addEventListener("keydown", event => {
    if (event.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName)) {
      event.preventDefault();
      input.focus();
    }
    if (event.key === "Escape" && document.activeElement === input) {
      input.value = "";
      run();
    }
  });

  const initial = new URLSearchParams(location.search);
  input.value = initial.get("q") || "";
  if ([...type.options].some(option => option.value === initial.get("type"))) type.value = initial.get("type") || "";
  run(false);
})();
