// ui.js — presentation shell only. This module must never know anything about questions, exams,
// papers, or scores; it deals exclusively in screens, params, and DOM chrome. `practice.js`,
// `gt.js`, and `analysis.js` own the business logic and call into this module to navigate,
// notify, and show chrome.

const THEME_KEY = 'pyq.ui.theme';

function safeLocalStorage() {
  try {
    return window.localStorage || null;
  } catch {
    // Private-browsing modes and some WebView configurations throw merely touching localStorage.
    return null;
  }
}

function prefersReducedMotion() {
  try {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch {
    return false;
  }
}

let baseStylesInjected = false;
function injectBaseStyles() {
  if (baseStylesInjected) return;
  baseStylesInjected = true;
  const style = document.createElement('style');
  style.setAttribute('data-pyq-ui', 'base');
  style.textContent = `
:focus-visible { outline: 2px solid var(--pyq-accent, #2563eb); outline-offset: 2px; }
.pyq-toast-container { position: fixed; left: 50%; bottom: 1.5rem; transform: translateX(-50%);
  display: flex; flex-direction: column; gap: 0.5rem; z-index: 9999; pointer-events: none;
  align-items: center; }
.pyq-toast { background: var(--pyq-toast-bg, #222); color: var(--pyq-toast-fg, #fff);
  padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.9rem; box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  opacity: 0; transition: opacity 150ms ease; max-width: 90vw; }
.pyq-busy-indicator { position: fixed; top: 0; left: 0; right: 0; height: 3px;
  background: var(--pyq-accent, #2563eb); z-index: 10001; display: none;
  animation: pyq-busy-pulse 1.1s ease-in-out infinite; }
@keyframes pyq-busy-pulse { 0% { opacity: .3; } 50% { opacity: 1; } 100% { opacity: .3; } }
.pyq-dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex;
  align-items: center; justify-content: center; z-index: 10000; padding: 1rem; }
.pyq-dialog { background: var(--pyq-surface, #fff); color: var(--pyq-text, #111);
  border-radius: 12px; padding: 1.25rem; max-width: 90vw; width: 360px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.3); }
.pyq-dialog h2 { margin: 0 0 0.5rem 0; font-size: 1.1rem; }
.pyq-dialog p { margin: 0 0 1rem 0; }
.pyq-dialog-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
@media (prefers-reduced-motion: reduce) {
  .pyq-toast { transition: none !important; }
  .pyq-busy-indicator { animation: none !important; }
}
`;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');
}

/**
 * Apply the persisted theme choice (if any) to `documentElement`. Safe to call before first
 * paint / before `document.body` exists — localStorage access is wrapped in try/catch, and if
 * nothing was persisted the app falls back to the OS `prefers-color-scheme`, which is left to
 * CSS media queries (no `data-theme` attribute is forced in that case).
 */
export function initTheme() {
  injectBaseStyles();
  let theme = null;
  const ls = safeLocalStorage();
  try {
    theme = ls ? ls.getItem(THEME_KEY) : null;
  } catch {
    theme = null;
  }
  applyTheme(theme === 'light' || theme === 'dark' ? theme : null);
}

/** Flip the theme (relative to system default if no explicit choice was made yet) and persist it. */
export function toggleTheme() {
  const root = document.documentElement;
  const current = root.getAttribute('data-theme');
  let next;
  if (current === 'dark') {
    next = 'light';
  } else if (current === 'light') {
    next = 'dark';
  } else {
    let prefersDark = false;
    try {
      prefersDark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    } catch {
      /* default to light->dark below */
    }
    next = prefersDark ? 'light' : 'dark';
  }
  applyTheme(next);
  try {
    const ls = safeLocalStorage();
    if (ls) ls.setItem(THEME_KEY, next);
  } catch {
    // Theme is still applied for the current session even if persistence failed.
  }
  return next;
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

const TOAST_MS = 3000;
let toastContainer = null;

function ensureToastContainer() {
  if (toastContainer && document.body.contains(toastContainer)) return toastContainer;
  injectBaseStyles();
  toastContainer = document.createElement('div');
  toastContainer.className = 'pyq-toast-container';
  toastContainer.setAttribute('role', 'status');
  toastContainer.setAttribute('aria-live', 'polite');
  document.body.appendChild(toastContainer);
  return toastContainer;
}

/** Show a transient message that auto-dismisses. Calling it repeatedly stacks toasts safely. */
export function toast(msg) {
  const container = ensureToastContainer();
  const el = document.createElement('div');
  el.className = 'pyq-toast';
  el.textContent = String(msg);
  container.appendChild(el);

  const reduceMotion = prefersReducedMotion();
  if (reduceMotion) el.style.transition = 'none';
  requestAnimationFrame(() => {
    el.style.opacity = '1';
  });

  let dismissed = false;
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    clearTimeout(timer);
    el.style.opacity = '0';
    if (reduceMotion) el.remove();
    else setTimeout(() => el.remove(), 180);
  }
  const timer = setTimeout(dismiss, TOAST_MS);
  return dismiss;
}

// ---------------------------------------------------------------------------
// Screen router (pushState + popstate, so Android hardware BACK works)
// ---------------------------------------------------------------------------

let rootEl = null;
const navHandlers = [];
let popstateBound = false;

/** Register the DOM element screens render into. Purely a handle for callers; ui.js does not
 * itself decide what goes inside it — that is `app.js`'s job via `onNavigate`. */
export function mount(el) {
  rootEl = el;
  return rootEl;
}

function dispatchNavigate(screenName, params, meta) {
  for (const handler of navHandlers.slice()) {
    try {
      handler(screenName, params, meta);
    } catch (err) {
      // A screen handler throwing must not break the router for every other handler/listener.
      console.error('ui.js: onNavigate handler threw', err);
    }
  }
}

function bindPopstateOnce() {
  if (popstateBound) return;
  popstateBound = true;
  window.addEventListener('popstate', (event) => {
    const state = event.state;
    if (state && typeof state.__pyqScreen === 'string') {
      dispatchNavigate(state.__pyqScreen, state.__pyqParams || {}, { source: 'popstate' });
    }
  });
}

function buildUrl(screenName, params) {
  const entries = params ? Object.entries(params).filter(([, v]) => v !== undefined) : [];
  const query = entries.length
    ? '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()
    : '';
  return '#/' + encodeURIComponent(screenName) + query;
}

/**
 * Navigate to `screenName` with `params`, pushing (or, with `{replace: true}`, replacing) a
 * browser history entry so the hardware BACK button pops back to the previous screen instead of
 * exiting the WebView.
 */
export function navigate(screenName, params = {}, { replace = false } = {}) {
  bindPopstateOnce();
  const state = { __pyqScreen: screenName, __pyqParams: params };
  const url = buildUrl(screenName, params);
  try {
    if (typeof history !== 'undefined') {
      if (replace && history.replaceState) history.replaceState(state, '', url);
      else if (history.pushState) history.pushState(state, '', url);
    }
  } catch {
    // History API blocked/unavailable (rare embedded contexts) — still dispatch in-memory so
    // the app keeps working; only BACK-button integration is lost.
  }
  dispatchNavigate(screenName, params, { source: 'navigate' });
}

/** Subscribe to every navigation (via `navigate()` or the hardware BACK button). Returns an unsubscribe function. */
export function onNavigate(handler) {
  navHandlers.push(handler);
  return () => {
    const i = navHandlers.indexOf(handler);
    if (i !== -1) navHandlers.splice(i, 1);
  };
}

// ---------------------------------------------------------------------------
// Confirm dialog (focus-trapped, accessible — not window.confirm)
// ---------------------------------------------------------------------------

function getFocusable(container) {
  return Array.from(
    container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => !el.disabled && !el.hasAttribute('aria-hidden'));
}

/**
 * A real, focus-trapped, accessible confirmation dialog. Resolves `true` on confirm, `false` on
 * cancel, Escape, or a click/tap outside the dialog. Restores focus to whatever had it before
 * the dialog opened.
 */
export function confirmDialog({ title = '', body = '', confirmLabel = 'OK', cancelLabel = 'Cancel' } = {}) {
  injectBaseStyles();
  return new Promise((resolve) => {
    const previouslyFocused = document.activeElement;
    const uid = Math.random().toString(36).slice(2);

    const overlay = document.createElement('div');
    overlay.className = 'pyq-dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'pyq-dialog';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'pyq-dialog-title-' + uid);
    dialog.setAttribute('aria-describedby', 'pyq-dialog-body-' + uid);

    const titleEl = document.createElement('h2');
    titleEl.id = 'pyq-dialog-title-' + uid;
    titleEl.textContent = title;

    const bodyEl = document.createElement('p');
    bodyEl.id = 'pyq-dialog-body-' + uid;
    bodyEl.textContent = body;

    const actions = document.createElement('div');
    actions.className = 'pyq-dialog-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = cancelLabel;

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.textContent = confirmLabel;

    actions.append(cancelBtn, confirmBtn);
    dialog.append(titleEl, bodyEl, actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    let closed = false;
    function close(result) {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKeydown, true);
      overlay.remove();
      try {
        if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
          previouslyFocused.focus();
        }
      } catch {
        /* original element may be gone — nothing more we can do */
      }
      resolve(result);
    }

    function onKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = getFocusable(dialog);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    cancelBtn.addEventListener('click', () => close(false));
    confirmBtn.addEventListener('click', () => close(true));
    overlay.addEventListener('mousedown', (event) => {
      if (event.target === overlay) close(false);
    });
    document.addEventListener('keydown', onKeydown, true);

    confirmBtn.focus();
  });
}

// ---------------------------------------------------------------------------
// Busy indicator
// ---------------------------------------------------------------------------

let busyEl = null;
let busyCount = 0;

function ensureBusyIndicator() {
  if (busyEl && document.body.contains(busyEl)) return busyEl;
  injectBaseStyles();
  busyEl = document.createElement('div');
  busyEl.className = 'pyq-busy-indicator';
  busyEl.setAttribute('aria-hidden', 'true');
  if (prefersReducedMotion()) busyEl.style.animation = 'none';
  document.body.appendChild(busyEl);
  return busyEl;
}

/** Show/hide a top-of-screen loading indicator. Calls nest safely (N `setBusy(true)` calls need N `setBusy(false)` calls to clear). */
export function setBusy(isBusy) {
  const el = ensureBusyIndicator();
  if (isBusy) {
    busyCount += 1;
  } else {
    busyCount = Math.max(0, busyCount - 1);
  }
  el.style.display = busyCount > 0 ? '' : 'none';
  try {
    document.documentElement.setAttribute('aria-busy', busyCount > 0 ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}
