// net.js — the ONLY module allowed to fetch a local JSON file.
//
// Why this exists (see ARCHITECTURE.md, "The two rules the modules exist to enforce"):
// `fetch()` does not work against the `file://` scheme in the Chromium build embedded in
// Android WebView. It resolves in a desktop browser and in a normal HTTP-served build, then
// fails *silently* (a rejected promise with no useful message, or in some WebView versions an
// opaque network error) once the app is packaged as an APK and loaded from `file:///android_asset/`.
// XMLHttpRequest against `file://` does work in WebView, so every local read in this app goes
// through XHR here — never through fetch — and if the first attempt fails for any reason we
// retry once against the `file:///android_asset/<relPath>` absolute path, which is where the
// WebView APK build actually places the bundled assets.
//
// Reference pattern studied (not copied): koushalterupally-source/medqbank's index.html,
// `xhrGetText` / `loadCerebManifest` around lines 1391-1426 — status 0 counts as success for a
// local file:// read, and there's a relative-path attempt followed by an absolute
// file:///android_asset/ fallback.

/** Thrown for any loadJSON failure. `path` is the relative path that was requested. */
export class NetError extends Error {
  constructor(message, path, cause) {
    super(`${message}: ${path}`);
    this.name = 'NetError';
    this.path = path;
    if (cause !== undefined) this.cause = cause;
  }
}

// In-flight request dedupe: two concurrent loadJSON(path) calls for the same path share one
// underlying XHR round trip (and, if needed, one fallback round trip) instead of firing twice.
const inFlight = new Map();

function xhrGetText(url) {
  return new Promise((resolve, reject) => {
    let xhr;
    try {
      xhr = new XMLHttpRequest();
    } catch (err) {
      reject(err);
      return;
    }
    let settled = false;
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4 || settled) return;
      settled = true;
      // status 0 is what a successful file:// read reports in WebView/Chromium; there is no
      // HTTP status line for a local file, so 0 has to be treated as success here.
      if (xhr.status === 200 || xhr.status === 0) {
        resolve(xhr.responseText);
      } else {
        reject(new Error('HTTP status ' + xhr.status));
      }
    };
    xhr.onerror = function () {
      if (settled) return;
      settled = true;
      reject(new Error('XHR network error'));
    };
    xhr.ontimeout = function () {
      if (settled) return;
      settled = true;
      reject(new Error('XHR timeout'));
    };
    try {
      xhr.send();
    } catch (err) {
      if (!settled) {
        settled = true;
        reject(err);
      }
    }
  });
}

function parseJSONOrThrow(text, path, causeLabel) {
  if (text === undefined || text === null || text === '') {
    throw new NetError('empty response body', path);
  }
  try {
    const value = JSON.parse(text);
    if (value === undefined) {
      // JSON.parse never actually returns undefined for a non-throwing parse, but guard the
      // "never resolve with undefined" contract explicitly and defensively.
      throw new NetError('parsed to undefined', path);
    }
    return value;
  } catch (err) {
    if (err instanceof NetError) throw err;
    throw new NetError(`malformed JSON${causeLabel ? ' (' + causeLabel + ')' : ''}`, path, err);
  }
}

/**
 * Load and parse a JSON file relative to the app root.
 *
 * Tries a plain relative XHR first (works for a desktop browser or an HTTP-served build), and
 * on ANY failure — non-200 status, network error, or a response that fails to parse — retries
 * once against `file:///android_asset/<relPath>`, which is the layout the Android WebView APK
 * actually serves assets from. Only if both attempts fail does this reject.
 *
 * Never resolves with `undefined`. Always rejects with a `NetError` (not a bare Error) that
 * names `relPath`, so a caller several layers up can log something actionable.
 *
 * Concurrent calls for the same `relPath` share a single in-flight request.
 */
export function loadJSON(relPath) {
  if (typeof relPath !== 'string' || relPath.length === 0) {
    return Promise.reject(new NetError('invalid path', String(relPath)));
  }

  const existing = inFlight.get(relPath);
  if (existing) return existing;

  const promise = (async () => {
    let primaryErr;
    try {
      const text = await xhrGetText(relPath);
      return parseJSONOrThrow(text, relPath, 'primary');
    } catch (err) {
      primaryErr = err;
    }

    const fallbackUrl = 'file:///android_asset/' + relPath.replace(/^\/+/, '');
    try {
      const text = await xhrGetText(fallbackUrl);
      return parseJSONOrThrow(text, relPath, 'fallback');
    } catch (fallbackErr) {
      throw new NetError(
        'failed to load (primary and file:///android_asset/ fallback both failed)',
        relPath,
        { primaryErr, fallbackErr }
      );
    }
  })();

  inFlight.set(relPath, promise);
  // Always clear the dedupe slot once settled, success or failure, so a later call re-fetches
  // rather than replaying a stale rejection or a stale (now possibly wrong) success forever.
  promise.finally(() => {
    if (inFlight.get(relPath) === promise) inFlight.delete(relPath);
  });

  return promise;
}
