// infra.test.mjs — Node's built-in test runner (`node --test`), zero dependencies.
//
// sanitize.js has no build-time DOM dependency: `sanitizeHTML`/`stripTags` accept an optional
// `{ parser }` and only fall back to the browser global `DOMParser` when none is injected. Node
// has no DOMParser, so this file builds a small hand-rolled HTML tokenizer (`MinimalDOMParser`,
// below) that produces the minimum node shape sanitize.js actually reads — nodeType, tagName,
// textContent, childNodes, getAttribute() — and injects it. This exercises the exact same
// allowlist/attribute-filter/tree-walk code in sanitize.js, unmodified, headlessly.
//
// Run: node --test /home/user/Case-simulator/pyq-app/tests/

import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeHTML, stripTags } from '../src/sanitize.js';

// ---------------------------------------------------------------------------
// Minimal DOMParser stub — good enough for the well-formed-ish explanation HTML this app
// actually stores, not a general-purpose HTML5 parser. Handles: nested elements, attributes
// (quoted/unquoted), void elements, raw-text elements (script/style), comments, and the five
// named entities used anywhere in this app's fixtures.
// ---------------------------------------------------------------------------

const VOID_TAGS = new Set(['br', 'img', 'input', 'hr', 'meta', 'link', 'embed']);
const RAW_TEXT_TAGS = new Set(['script', 'style']);

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function makeElement(tagName) {
  return {
    nodeType: 1,
    tagName,
    attributes: [],
    childNodes: [],
    getAttribute(name) {
      const found = this.attributes.find((a) => a.name === name.toLowerCase());
      return found ? found.value : null;
    },
  };
}

function makeText(raw) {
  return { nodeType: 3, textContent: decodeEntities(raw) };
}

function parseHTMLFragment(html) {
  const root = makeElement('BODY');
  const stack = [root];
  const top = () => stack[stack.length - 1];
  const len = html.length;
  let i = 0;

  while (i < len) {
    if (html.startsWith('<!--', i)) {
      const end = html.indexOf('-->', i + 4);
      i = end === -1 ? len : end + 3;
      continue;
    }

    if (html[i] === '<') {
      if (html[i + 1] === '/') {
        const end = html.indexOf('>', i);
        const name = html.slice(i + 2, end === -1 ? len : end).trim().toLowerCase();
        for (let j = stack.length - 1; j > 0; j--) {
          if (stack[j].tagName.toLowerCase() === name) {
            stack.length = j;
            break;
          }
        }
        i = end === -1 ? len : end + 1;
        continue;
      }

      const tagMatch = /^<([a-zA-Z][a-zA-Z0-9]*)/.exec(html.slice(i));
      if (!tagMatch) {
        top().childNodes.push(makeText('<'));
        i++;
        continue;
      }
      const tagName = tagMatch[1];
      let j = i + 1 + tagName.length;
      const attrs = [];

      while (j < len && html[j] !== '>') {
        while (j < len && /\s/.test(html[j])) j++;
        if (j >= len || html[j] === '>') break;
        if (html[j] === '/') {
          j++;
          continue;
        }
        const attrMatch = /^([a-zA-Z_:][-a-zA-Z0-9_:.]*)/.exec(html.slice(j));
        if (!attrMatch) {
          j++;
          continue;
        }
        const attrName = attrMatch[1];
        j += attrName.length;
        while (j < len && /\s/.test(html[j])) j++;
        let attrValue = '';
        if (html[j] === '=') {
          j++;
          while (j < len && /\s/.test(html[j])) j++;
          if (html[j] === '"' || html[j] === "'") {
            const quote = html[j];
            j++;
            const start = j;
            while (j < len && html[j] !== quote) j++;
            attrValue = html.slice(start, j);
            j++;
          } else {
            const start = j;
            while (j < len && !/\s/.test(html[j]) && html[j] !== '>') j++;
            attrValue = html.slice(start, j);
          }
        }
        attrs.push({ name: attrName.toLowerCase(), value: decodeEntities(attrValue) });
      }

      const selfClosing = j > 0 && html[j - 1] === '/';
      i = j < len ? j + 1 : len;

      const el = makeElement(tagName.toUpperCase());
      el.attributes = attrs;
      top().childNodes.push(el);

      const lower = tagName.toLowerCase();
      if (RAW_TEXT_TAGS.has(lower)) {
        const closeTag = '</' + lower;
        const idx = html.toLowerCase().indexOf(closeTag, i);
        const rawEnd = idx === -1 ? len : idx;
        const raw = html.slice(i, rawEnd);
        if (raw.length) el.childNodes.push(makeText(raw));
        if (idx !== -1) {
          const closeEnd = html.indexOf('>', idx);
          i = closeEnd === -1 ? len : closeEnd + 1;
        } else {
          i = len;
        }
        continue;
      }

      if (!VOID_TAGS.has(lower) && !selfClosing) stack.push(el);
      continue;
    }

    const nextLt = html.indexOf('<', i);
    const end = nextLt === -1 ? len : nextLt;
    const raw = html.slice(i, end);
    if (raw.length) top().childNodes.push(makeText(raw));
    i = end;
  }

  return root;
}

class MinimalDOMParser {
  parseFromString(html) {
    return { body: parseHTMLFragment(html) };
  }
}

const parserOpts = { parser: MinimalDOMParser };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('legitimate markup survives intact', () => {
  const input = '<p><strong>Ans. D</strong></p><ul><li>a</li></ul>';
  assert.equal(sanitizeHTML(input, parserOpts), input);
});

test('img onerror XSS: attribute dropped and img itself dropped (unsafe src)', () => {
  const out = sanitizeHTML('<img src=x onerror=alert(1)>', parserOpts);
  assert.ok(!out.includes('onerror'), 'onerror handler must not survive');
  assert.ok(!out.includes('alert'), 'payload text must not survive');
  assert.equal(out, '', 'img with a non-https/non-data:image src must be dropped entirely');
});

test('script tags are removed with their entire content', () => {
  const out = sanitizeHTML('<script>alert(1)</script>', parserOpts);
  assert.ok(!out.toLowerCase().includes('<script'), 'no script tag must survive');
  assert.ok(!out.includes('alert'), 'script content must not survive as text either');
  assert.equal(out, '');
});

test('script embedded alongside safe content: only the script is removed', () => {
  const out = sanitizeHTML('<p>safe</p><script>alert(1)</script>', parserOpts);
  assert.equal(out, '<p>safe</p>');
});

test('javascript: URL on a disallowed tag: tag is unwrapped, text survives, no href anywhere', () => {
  const out = sanitizeHTML('<a href="javascript:alert(1)">x</a>', parserOpts);
  assert.ok(!out.includes('javascript:'), 'javascript: scheme must never survive');
  assert.ok(!out.includes('href'), 'no href attribute is ever on the allowlist');
  assert.ok(!out.includes('<a'), '<a> is not an allowed tag and must not survive');
  assert.equal(out, 'x', 'the unwrapped text content should still be readable');
});

test('http (non-https) image src is dropped', () => {
  const out = sanitizeHTML('<img src="http://evil/x">', parserOpts);
  assert.equal(out, '', 'http: image sources must be dropped, only https: and data:image/ are allowed');
});

test('https image src is kept, with only src/alt surviving', () => {
  const out = sanitizeHTML('<img src="https://example.com/a.png" alt="diagram" class="x" onclick="evil()">', parserOpts);
  assert.equal(out, '<img src="https://example.com/a.png" alt="diagram">');
});

test('data:image/ src is kept', () => {
  const src = 'data:image/png;base64,AAAA';
  const out = sanitizeHTML(`<img src="${src}">`, parserOpts);
  assert.equal(out, `<img src="${src}">`);
});

test('data: src that is not an image is dropped', () => {
  const out = sanitizeHTML('<img src="data:text/html,<script>alert(1)</script>">', parserOpts);
  assert.equal(out, '');
});

test('on* handlers are stripped from allowed tags', () => {
  const out = sanitizeHTML('<div onclick="alert(1)" onmouseover="evil()">hi</div>', parserOpts);
  assert.equal(out, '<div>hi</div>');
});

test('style, iframe, object, embed, form, input are all removed with their content', () => {
  const out = sanitizeHTML(
    '<style>body{background:url(x)}</style>' +
      '<iframe src="https://evil"></iframe>' +
      '<object data="evil"></object>' +
      '<embed src="evil">' +
      '<form action="evil"><input type="text" value="x"></form>' +
      '<p>kept</p>',
    parserOpts
  );
  assert.equal(out, '<p>kept</p>');
});

test('table structure and colspan/rowspan survive, other attributes on td/th do not', () => {
  const input =
    '<table><thead><tr><th colspan="2" style="color:red">H</th></tr></thead>' +
    '<tbody><tr><td rowspan="2" class="x">A</td></tr></tbody></table>';
  const out = sanitizeHTML(input, parserOpts);
  assert.equal(
    out,
    '<table><thead><tr><th colspan="2">H</th></tr></thead><tbody><tr><td rowspan="2">A</td></tr></tbody></table>'
  );
});

test('sub, sup, code, pre survive with no attributes', () => {
  const input = '<pre class="hl"><code>x = 1</code></pre><sub>2</sub><sup>3</sup>';
  const out = sanitizeHTML(input, parserOpts);
  assert.equal(out, '<pre><code>x = 1</code></pre><sub>2</sub><sup>3</sup>');
});

test('text is HTML-escaped on the way back out', () => {
  const out = sanitizeHTML('<p>1 < 2 && "yes"</p>', parserOpts);
  assert.equal(out, '<p>1 &lt; 2 &amp;&amp; "yes"</p>');
});

test('null/undefined/empty input returns an empty string, never throws', () => {
  assert.equal(sanitizeHTML(null, parserOpts), '');
  assert.equal(sanitizeHTML(undefined, parserOpts), '');
  assert.equal(sanitizeHTML('', parserOpts), '');
});

test('sanitizeHTML throws (fails closed) rather than returning unsanitized input when no parser is available', () => {
  assert.throws(() => sanitizeHTML('<p>x</p>'));
});

// ---------------------------------------------------------------------------
// stripTags
// ---------------------------------------------------------------------------

test('stripTags returns plain text with tags removed', () => {
  assert.equal(stripTags('<p><strong>Ans. D</strong></p>', parserOpts), 'Ans. D');
});

test('stripTags drops script/style content entirely, not just the tags', () => {
  assert.equal(stripTags('<p>a</p><script>alert(1)</script><p>b</p>', parserOpts), 'ab');
});

test('stripTags decodes entities', () => {
  assert.equal(stripTags('<p>1 &lt; 2 &amp; 3</p>', parserOpts), '1 < 2 & 3');
});

test('stripTags on empty/null input', () => {
  assert.equal(stripTags(''), '');
  assert.equal(stripTags(null), '');
});
