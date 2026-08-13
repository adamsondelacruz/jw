(() => {
  const script = document.currentScript;
  const co1Url = new URL(script.dataset.co1 || "CO-1.html", script.src).href;
  const referencePattern = /\bCO-1(?!\d)(?:\s+(?:(\d):([0-9]+)(?:[-–][0-9]+)?|Appendix\s+([A-F])))?/g;

  function openReference(event) {
    event.preventDefault();
    const target = event.currentTarget.href;
    const popup = window.open(target, "co1_reference");
    if (popup) popup.focus();
  }

  function makeLink(label, chapter, paragraph, appendix) {
    const link = document.createElement("a");
    const fragment = chapter ? `#co1-${chapter}-${paragraph}` : appendix ? `#appendix-${appendix.toLowerCase()}` : "";
    link.href = `${co1Url}${fragment}`;
    link.className = "co1-reference";
    link.textContent = label;
    link.title = `Open ${label} in the reusable CO-1 window`;
    link.addEventListener("click", openReference);
    return link;
  }

  function linkTextNodes(root, pattern = referencePattern) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const parent = walker.currentNode.parentElement;
      if (parent && !parent.closest("a, script, style, code, pre")) nodes.push(walker.currentNode);
    }
    for (const node of nodes) {
      pattern.lastIndex = 0;
      const text = node.nodeValue;
      let match;
      let cursor = 0;
      const fragment = document.createDocumentFragment();
      let changed = false;
      while ((match = pattern.exec(text))) {
        changed = true;
        fragment.append(text.slice(cursor, match.index));
        fragment.append(makeLink(match[0], match[1], match[2], match[3]));
        cursor = match.index + match[0].length;
      }
      if (changed) {
        fragment.append(text.slice(cursor));
        node.replaceWith(fragment);
      }
    }
  }

  for (const link of document.querySelectorAll('a[href*="CO-1_s-BrAUS_E.pdf"]')) {
    link.href = co1Url;
    link.target = "co1_reference";
    link.addEventListener("click", openReference);
  }

  linkTextNodes(document.body);

  for (const table of document.querySelectorAll("table")) {
    const headers = [...table.querySelectorAll("th")];
    const sourceIndex = headers.findIndex((header) => /CO-1 source|CO-1 reference/i.test(header.textContent));
    if (sourceIndex < 0) continue;
    for (const row of table.querySelectorAll("tbody tr")) {
      const cell = row.children[sourceIndex];
      if (!cell) continue;
      linkTextNodes(cell, /(?<![\w-])(\d):([0-9]+)(?:[-–][0-9]+)?/g);
    }
  }
})();
