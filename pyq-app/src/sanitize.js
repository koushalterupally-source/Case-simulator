// sanitize.js — the ONLY module allowed to hand explanation HTML to the DOM.
//
// Approach: parse `dirty` with a DOMParser into a detached document, walk the resulting tree
// (never the raw string) building a small allowlisted "safe tree" of plain descriptor objects,
// then serialize that safe tree back into an HTML string ourselves. Nothing here uses a regex
// against the HTML source to strip anything — regex cannot correctly parse nested/broken HTML
// and is exactly the class of bug that lets a crafted payload slip through. The only regexes in
// this file are for entity-escaping known-plain strings during serialization, which is safe.
//
// Testability: this module has no build-time DOM dependency. Both `sanitizeHTML` and
// `stripTags` take an optional `{ parser }` in their second argument; when omitted they fall
// back to the browser's global `DOMParser`. `tests/infra.test.mjs` injects a minimal hand-rolled
// stub parser (built in the test file, not here) so the exact same allowlist/attribute-filter/
// tree-walk code paths run unmodified under `node --test`, with no DOM and no dependencies.

const ALLOWED_TAGS = new Set([
  'P', 'BR', 'STRONG', 'EM', 'B', 'I', 'U', 'UL', 'OL', 'LI', 'IMG', 'DIV', 'SPAN',
  'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'SUB', 'SUP', 'CODE', 'PRE',
]);

// Elements whose entire subtree must be discarded — their text content is code/markup/UI, not
// content, so even the "unwrap and keep the text" leniency given to other disallowed tags does
// not apply here.
const DROP_CONTENT_TAGS = new Set([
  'SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'NOSCRIPT',
]);

// Tags that never carry children in the safe tree (mirrors real HTML void-element behavior for
// the two void tags on the allowlist).
const VOID_TAGS = new Set(['BR', 'IMG']);

// Per-tag attribute allowlist. Every attribute not listed here, on every tag, is dropped —
// which is also how every `on*` handler and every stray `style=`/`class=`/`href=` disappears.
const ATTR_ALLOW = {
  TD: new Set(['colspan', 'rowspan']),
  TH: new Set(['colspan', 'rowspan']),
};

function isSafeImgSrc(src) {
  if (typeof src !== 'string') return false;
  const trimmed = src.trim();
  return /^https:\/\//i.test(trimmed) || /^data:image\//i.test(trimmed);
}

function getTagName(node) {
  return (node.tagName || node.nodeName || '').toUpperCase();
}

function getAttr(node, name) {
  if (typeof node.getAttribute === 'function') return node.getAttribute(name);
  const attrs = node.attributes;
  if (attrs) {
    for (const a of Array.from(attrs)) {
      if (a.name === name) return a.value;
    }
  }
  return null;
}

function getTextContent(node) {
  return node.textContent != null ? node.textContent : (node.nodeValue || '');
}

/**
 * Sanitize one DOM node into zero, one, or many "safe tree" descriptor nodes.
 * Returns: `null` (drop it), a single descriptor object, or an array of descriptors (used when
 * a disallowed-but-not-dangerous tag is unwrapped and its children take its place).
 */
function sanitizeNode(node) {
  if (!node) return null;

  const nodeType = node.nodeType;
  if (nodeType === 3) {
    const text = getTextContent(node);
    return text.length ? { type: 'text', value: text } : null;
  }
  if (nodeType !== 1) {
    // Comments, doctypes, processing instructions, CDATA — none of it is renderable content.
    return null;
  }

  const tag = getTagName(node);

  if (DROP_CONTENT_TAGS.has(tag)) return null;

  if (!ALLOWED_TAGS.has(tag)) {
    // Not dangerous, just not on the allowlist (e.g. <a>, <font>, <b color="">'s wrapper if it
    // were disallowed) — unwrap it and keep its sanitized children so legitimate inline text
    // isn't lost.
    return sanitizeChildren(node.childNodes);
  }

  const attrs = [];
  if (tag === 'IMG') {
    const src = getAttr(node, 'src');
    if (!isSafeImgSrc(src)) return null; // drop the whole <img> if its src isn't https:/data:image:
    attrs.push(['src', src]);
    const alt = getAttr(node, 'alt');
    if (typeof alt === 'string') attrs.push(['alt', alt]);
  } else {
    const allowedForTag = ATTR_ALLOW[tag];
    if (allowedForTag) {
      for (const name of allowedForTag) {
        const v = getAttr(node, name);
        if (typeof v === 'string') attrs.push([name, v]);
      }
    }
  }

  const children = VOID_TAGS.has(tag) ? [] : sanitizeChildren(node.childNodes);
  return { type: 'element', tag: tag.toLowerCase(), attrs, children };
}

function sanitizeChildren(nodeList) {
  const out = [];
  for (const child of Array.from(nodeList || [])) {
    const result = sanitizeNode(child);
    if (result === null) continue;
    if (Array.isArray(result)) out.push(...result);
    else out.push(result);
  }
  return out;
}

function escapeText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function serialize(nodes) {
  let out = '';
  for (const n of nodes) {
    if (n.type === 'text') {
      out += escapeText(n.value);
      continue;
    }
    out += '<' + n.tag;
    for (const [name, value] of n.attrs) {
      out += ` ${name}="${escapeAttr(value)}"`;
    }
    if (VOID_TAGS.has(n.tag.toUpperCase())) {
      out += '>';
      continue;
    }
    out += '>' + serialize(n.children) + '</' + n.tag + '>';
  }
  return out;
}

function resolveParserCtor(opts) {
  if (opts && opts.parser) return opts.parser;
  if (typeof DOMParser !== 'undefined') return DOMParser;
  return null;
}

/**
 * Sanitize an explanation-HTML string down to a safe allowlisted subset.
 *
 * Allowed tags: p br strong em b i u ul ol li img div span table thead tbody tr td th sub sup
 * code pre. Every attribute is stripped except `src`/`alt` on `img` and `colspan`/`rowspan` on
 * td/th. An `img` is dropped entirely unless its `src` is `https:` or `data:image/`.
 * `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<input>` are removed with
 * their entire contents; any other disallowed tag is unwrapped (its safe children survive, the
 * tag itself does not) — which is also how every `on*` handler and every `javascript:` URL is
 * eliminated, since no attribute carrying either is ever on the allowlist.
 *
 * Never returns anything but a string; never re-injects unsanitized input on any code path.
 *
 * @param {string} dirty
 * @param {{parser?: {new(): {parseFromString(html: string, type: string): {body: any}}}}} [opts]
 *   Inject a DOMParser-compatible constructor (used by the Node test suite, which has no DOM).
 */
export function sanitizeHTML(dirty, opts) {
  if (dirty == null) return '';
  const input = String(dirty);
  const ParserCtor = resolveParserCtor(opts);
  if (!ParserCtor) {
    // Fail closed, never fail open: with no way to parse, there is no safe way to return the
    // input verbatim, so refuse rather than risk shipping unsanitized markup.
    throw new Error('sanitizeHTML: no DOMParser available (browser) and none injected via opts.parser');
  }
  const parser = new ParserCtor();
  const doc = parser.parseFromString(input, 'text/html');
  const body = doc.body || doc;
  return serialize(sanitizeChildren(body.childNodes));
}

function collectText(nodeList) {
  let out = '';
  for (const node of Array.from(nodeList || [])) {
    if (node.nodeType === 3) {
      out += getTextContent(node);
    } else if (node.nodeType === 1) {
      const tag = getTagName(node);
      if (DROP_CONTENT_TAGS.has(tag)) continue;
      out += collectText(node.childNodes);
    }
  }
  return out;
}

/**
 * Return the plain-text content of an HTML string, used for length/heuristic checks (e.g. the
 * `hasExplanation` 60-character rule). Not a security boundary by itself — callers still need
 * `sanitizeHTML` before inserting anything into the DOM — but it never executes the markup.
 *
 * @param {string} html
 * @param {{parser?: any}} [opts] Same DOMParser injection point as `sanitizeHTML`.
 */
export function stripTags(html, opts) {
  if (html == null) return '';
  const input = String(html);
  const ParserCtor = resolveParserCtor(opts);
  if (!ParserCtor) {
    // Crude fallback used only when nothing capable of real parsing is available. This path is
    // never used for anything security-sensitive — only for a plain-text length estimate.
    return input
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
  const parser = new ParserCtor();
  const doc = parser.parseFromString(input, 'text/html');
  const body = doc.body || doc;
  return collectText(body.childNodes);
}
