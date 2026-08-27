/**
 * Minimal DOM helpers shared by every screen.
 *
 * `el` sets text through textContent by default. Injecting corpus text as HTML is only ever done through
 * `html()`, which routes via the sanitizer — so there is exactly one place in the app where markup from
 * the question bank reaches the DOM.
 */

import { sanitizeHTML } from './sanitize.js';

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style') Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, value);
  }

  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

/** The single sanctioned path for corpus markup — question stems and explanation bodies. */
export function html(container, dirty) {
  container.innerHTML = '';
  const frag = sanitizeHTML(dirty || '');
  if (typeof frag === 'string') container.innerHTML = frag;
  else container.appendChild(frag);
  markOfflineImages(container);
  return container;
}

/**
 * Remote images are the offline failure mode of this corpus: 24,650 of them live on an S3 bucket that
 * airplane mode cannot reach. Rather than leaving a broken-image glyph, swap in a labelled placeholder
 * that can be tapped to retry once there is a connection.
 */
export function markOfflineImages(container) {
  for (const img of container.querySelectorAll('img')) {
    watchImage(img);
  }
}

function watchImage(img) {
  if (img.dataset.pyqHandled) return;
  img.dataset.pyqHandled = '1';

  // Inline data: images always render, offline included — nothing to guard against.
  if ((img.getAttribute('src') || '').startsWith('data:')) return;

  const triggerFallback = () => {
    const src = img.getAttribute('src');
    const alt = img.getAttribute('alt') || '';

    const placeholder = el('button', {
      class: 'imgfallback',
      type: 'button',
      text: navigator.onLine
        ? 'Image failed to load — tap to retry'
        : 'Image unavailable offline — tap to retry',
      onclick: () => {
        const retry = el('img', { src, alt });
        watchImage(retry);
        placeholder.replaceWith(retry);
      },
    });

    img.replaceWith(placeholder);
  };

  img.addEventListener('error', triggerFallback);

  if (img.complete && img.naturalWidth === 0) {
    triggerFallback();
  }
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function optionKey(index) {
  return String.fromCharCode(65 + index);
}

export function pct(value) {
  return `${Math.round(value * 100)}%`;
}

export function duration(ms) {
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many || one + 's'}`;
}
