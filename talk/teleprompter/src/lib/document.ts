import DOMPurify from "dompurify";
import { marked } from "marked";
import type { TalkFile } from "../types";

const allowedClasses = [
  "kw",
  "kw-green",
  "kw-orange",
  "kw-blue",
  "subtle",
  "highlight-legend",
  "level1",
  "level2",
  "level3",
];

export type LoadedDocument =
  | {
      kind: "html";
      html: string;
      plainText: string;
      blockCount: number;
      blocks: TalkBlock[];
      words: TalkWord[];
    }
  | {
      kind: "pdf";
      url: string;
    };

export type TalkBlock = {
  id: string;
  text: string;
  startWordIndex: number;
  endWordIndex: number;
};

export type TalkWord = {
  index: number;
  blockId: string;
  text: string;
  normalized: string;
};

export async function loadTalkDocument(file: TalkFile): Promise<LoadedDocument> {
  if (file.kind === "pdf") {
    return { kind: "pdf", url: file.path };
  }

  const response = await fetch(file.path);
  if (!response.ok) {
    throw new Error(`Could not load ${file.name}: ${response.status}`);
  }

  const source = await response.text();
  const html = file.kind === "markdown" ? await marked.parse(source) : extractBody(source);
  const sanitized = DOMPurify.sanitize(html, {
    ADD_ATTR: ["target"],
    ALLOWED_ATTR: ["class", "href", "id", "target", "rel", "title"],
  });

  const document = new DOMParser().parseFromString(sanitized, "text/html");
  pruneClasses(document.body);
  const { blocks, words } = markBlocksAndWords(document.body);

  return {
    kind: "html",
    html: document.body.innerHTML,
    plainText: document.body.textContent?.replace(/\s+/g, " ").trim() ?? "",
    blockCount: blocks.length,
    blocks,
    words,
  };
}

function extractBody(html: string) {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] : html;
}

function pruneClasses(root: HTMLElement) {
  root.querySelectorAll("[class]").forEach((element) => {
    const kept = Array.from(element.classList).filter((className) =>
      allowedClasses.includes(className),
    );
    if (kept.length) {
      element.className = kept.join(" ");
    } else {
      element.removeAttribute("class");
    }
  });
}

function markBlocksAndWords(root: HTMLElement) {
  const blocks: TalkBlock[] = [];
  const words: TalkWord[] = [];
  const selectors = "h1,h2,h3,h4,p,li,blockquote";
  root.querySelectorAll(selectors).forEach((element, index) => {
    const id = `block-${index + 1}`;
    element.setAttribute("data-block-id", id);
    const startWordIndex = words.length;
    wrapTextNodes(element, id, words);
    const text = element.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const endWordIndex = words.length - 1;
    if (text) blocks.push({ id, text, startWordIndex, endWordIndex });
  });
  return { blocks, words };
}

function wrapTextNodes(element: Element, blockId: string, words: TalkWord[]) {
  const document = element.ownerDocument;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
      if (node.parentElement?.closest("script,style")) return NodeFilter.FILTER_REJECT;
      if (node.parentElement?.closest("[data-word-index]")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

  textNodes.forEach((node) => {
    const fragment = document.createDocumentFragment();
    const parts = node.textContent?.match(/\S+|\s+/g) ?? [];
    parts.forEach((part) => {
      if (/^\s+$/.test(part)) {
        fragment.append(document.createTextNode(part));
        return;
      }

      const normalized = normalizeWord(part);
      if (!normalized) {
        fragment.append(document.createTextNode(part));
        return;
      }

      const span = document.createElement("span");
      const wordIndex = words.length;
      span.dataset.wordIndex = String(wordIndex);
      span.dataset.blockId = blockId;
      span.className = "talk-word";
      span.textContent = part;
      words.push({
        index: wordIndex,
        blockId,
        text: part,
        normalized,
      });
      fragment.append(span);
    });
    node.replaceWith(fragment);
  });
}

function normalizeWord(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
