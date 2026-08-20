(() => {
  const script = document.currentScript;
  const co1Url = new URL(script.dataset.co1 || "CO-1.html", script.src).href;
  const conventionRoot = new URL(".", script.src);
  const coordinatorRoot = new URL("coordinator/", conventionRoot);
  const referencePattern = /\bCO-1(?!\d)(?:\s+(?:(\d):([0-9]+)(?:[-–][0-9]+)?|Appendix\s+([A-F])))?/g;
  const bareReferencePattern = /(?<![\w:])([1-3]):([1-9][0-9]?)(?:[-–]([1-9][0-9]?))?/g;
  const appendixPattern = /\bAppendix\s+([A-F])\b/g;

  const localForms = {
    "CO-68": "forms/00-CO-68_E.pdf",
    "CO-53": "forms/01-CO-53_E.pdf",
    "TO-5": "forms/02-TO-5_E.pdf",
    "TO-5i": "forms/03-TO-5i_E.pdf",
    "DC-85": "forms/04-DC-85_E.pdf",
  };
  const formPattern = /\b(?:CO-(?:100|161|68|65|63|62|53|24|23|19a|14|5a)|TO-5i?|DC-85)\b/g;
  const venueDocuments = {
    "M-270": "event%20oversight", "M-270c": "event%20oversight", "M-286": "event%20oversight",
    "M-281": "accounts", "M-282": "attendants", "M-272": "audio%20video", "M-272a": "audio%20video",
    "M-272b": "audio%20video", "M-283": "baptism", "M-273": "cleaning", "M-284": "first%20aid",
    "M-285": "lost%20and%20found", "M-274": "parking",
  };
  const venuePattern = /\bM-(?:270c?|286|281|282|272[ab]?|283|273|284|285|274)\b/g;
  const pageTerms = {
    "coordinator overview": "coordinator-overview.html",
    "departments and personnel": "departments-and-personnel.html",
    "organisation chart": "organisation-chart.html",
    "organization chart": "organisation-chart.html",
    "contact masterlist": "contact-masterlist.html",
    "department communications": "communications.html",
    "forms register": "forms-register.html",
    "operational guidance": "operational-guidance.html",
    "coordinator checklist": "coordinator-checklist.html",
    "source map": "source-map.html",
    "co-53 easy guide": "co-53-guide.html",
    "jw hub convention information": "https://hub.jw.org/convention-information/en/conventions/5ff3cade-fc3a-4423-bb88-f6bc983a1d1c/responsibilities",
    "convention information": "https://hub.jw.org/convention-information/en/conventions/5ff3cade-fc3a-4423-bb88-f6bc983a1d1c/responsibilities",
    "department tracker": "templates/department-status-tracker-template.html",
    "submissions register": "templates/submissions-register-template.html",
    "appointment letter": "../CNV_03_Convention%20Committee%20Appointment-E%20Au.pdf",
    "venue department instructions and checklists": "../templates/index.html",
    "venue instructions": "../templates/index.html",
    "working chart": "organisation-chart.html",
  };
  const roleTerms = {
    "convention committee coordinator": "role-coordinator",
    "coordinator assistant": "role-coordinator-assistant",
    "program overseer assistant": "role-program-overseer-assistant",
    "program overseer": "role-program-overseer",
    "rooming overseer assistant": "role-rooming-overseer-assistant",
    "rooming overseer": "role-rooming-overseer",
    "accounts overseer": "role-accounts",
    "attendant overseer": "role-attendant",
    "first aid overseer": "role-first-aid",
    "parking overseer": "role-parking",
    "safety coordinator": "role-safety",
    "audio/video overseer": "role-audio-video",
    "baptism overseer": "role-baptism",
    "cleaning overseer": "role-cleaning",
  };

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

  function genericLink(label, href, className, title) {
    const link = document.createElement("a");
    link.href = href;
    link.className = className;
    link.textContent = label;
    link.title = title;
    return link;
  }

  function linkTextNodes(root, pattern = referencePattern, factory = (match) => makeLink(match[0], match[1], match[2], match[3])) {
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
        fragment.append(factory(match));
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

  // Once CO-1 establishes the source context, compact references such as
  // “1:36” and “Appendix C” can safely point to the same publication.
  linkTextNodes(document.body, bareReferencePattern, (match) =>
    makeLink(match[0], match[1], match[2], null));
  linkTextNodes(document.body, appendixPattern, (match) =>
    makeLink(match[0], null, null, match[1]));

  linkTextNodes(document.body, formPattern, (match) => {
    const code = match[0];
    const local = localForms[code];
    const href = local
      ? new URL(local, coordinatorRoot).href
      : new URL(`forms-register.html#form-${code.toLowerCase()}`, coordinatorRoot).href;
    return genericLink(code, href, "document-reference", local ? `Open the staged local ${code} file` : `Open ${code} in the forms register`);
  });

  linkTextNodes(document.body, venuePattern, (match) => {
    const code = match[0];
    return genericLink(code, new URL(`templates/index.html#${venueDocuments[code]}`, conventionRoot).href,
      "document-reference", `Open the venue files for ${code}`);
  });

  const termPattern = new RegExp(`\\b(${Object.keys(pageTerms).sort((a, b) => b.length - a.length).map(escapePattern).join("|")})\\b`, "gi");
  linkTextNodes(document.body, termPattern, (match) => {
    const href = new URL(pageTerms[match[0].toLowerCase()], coordinatorRoot).href;
    if (sameDocument(href, location.href)) return document.createTextNode(match[0]);
    return genericLink(match[0], href, "portal-reference", `Open ${match[0]}`);
  });

  const rolePattern = new RegExp(`\\b(${Object.keys(roleTerms).sort((a, b) => b.length - a.length).map(escapePattern).join("|")})\\b`, "gi");
  linkTextNodes(document.body, rolePattern, (match) => {
    const href = new URL(`organisation-chart.html#${roleTerms[match[0].toLowerCase()]}`, coordinatorRoot).href;
    if (new URL(href).pathname === location.pathname) return document.createTextNode(match[0]);
    return genericLink(match[0], href, "role-reference-link", `View ${match[0]} on the organisation chart`);
  });

  linkTextNodes(document.body, /\\bConvention Organization Guidelines\\b/g, (match) => {
    const link = genericLink(match[0], co1Url, "co1-reference", "Open Convention Organization Guidelines in the reusable CO-1 window");
    link.addEventListener("click", openReference);
    return link;
  });

  const people = window.COORDINATOR_LINK_DATA?.people || [];
  if (people.length) {
    const personPattern = new RegExp(`\\b(${people.map(person => person.name).sort((a, b) => b.length - a.length).map(escapePattern).join("|")})\\b`, "gi");
    const ids = new Map(people.map(person => [person.name.toLowerCase(), person.id]));
    linkTextNodes(document.body, personPattern, (match) => genericLink(match[0],
      new URL(`contact-masterlist.html#${ids.get(match[0].toLowerCase())}`, coordinatorRoot).href,
      "person-reference-link", `Open ${match[0]}'s contact record`));
  }

  for (const table of document.querySelectorAll("table")) {
    const headers = [...table.querySelectorAll("th")];
    const sourceIndex = headers.findIndex((header) => /CO-1 source|CO-1 reference/i.test(header.textContent));
    if (sourceIndex < 0) continue;
    for (const row of table.querySelectorAll("tbody tr")) {
      const cell = row.children[sourceIndex];
      if (!cell) continue;
      linkTextNodes(cell, /(?<![\w-])([1-3]):([1-9][0-9]?)(?:[-–][1-9][0-9]?)?/g);
    }
  }

  function escapePattern(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function sameDocument(left, right) {
    const a = new URL(left);
    const b = new URL(right);
    return a.origin === b.origin && a.pathname === b.pathname && !a.hash;
  }
})();
