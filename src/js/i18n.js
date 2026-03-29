import en from '../locales/en.json';
import no from '../locales/no.json';
import sv from '../locales/sv.json';
import da from '../locales/da.json';
import pl from '../locales/pl.json';

/**
 * Lightweight i18n module.
 *
 * To add a new language:
 *   1. Create src/locales/<code>.json with the same keys as en.json
 *   2. Import it here and add an entry to `locales`
 *   3. Add an <option value="<code>"> to the language selector in index.html
 */

const locales = { en, no, sv, da, pl };
const DEFAULT_LOCALE = 'no';
const STORAGE_KEY = 'app_locale';

let current = DEFAULT_LOCALE;

/** Return the saved locale or the default. */
function getSavedLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && locales[saved]) return saved;
  } catch (_) { /* storage unavailable */ }
  return DEFAULT_LOCALE;
}

/** Persist the chosen locale. */
function saveLocale(code) {
  try { localStorage.setItem(STORAGE_KEY, code); } catch (_) { /* ignore */ }
}

/** Look up a translation key in the current locale (falls back to English). */
export function t(key) {
  const bundle = locales[current] || locales[DEFAULT_LOCALE];
  return bundle[key] ?? locales[DEFAULT_LOCALE][key] ?? key;
}

/** Return the current locale code. */
export function getLocale() {
  return current;
}

/**
 * Apply translations to every element that has a `data-i18n` attribute.
 * Supports `data-i18n-attr` to translate an attribute instead of textContent.
 */
export function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const attr = el.getAttribute('data-i18n-attr');
    if (attr) {
      el.setAttribute(attr, t(key));
    } else {
      el.textContent = t(key);
    }
  });
}

/**
 * Switch to a different locale and re-render all translated strings.
 * @param {string} code – locale code (e.g. "en", "no")
 */
export function setLocale(code) {
  if (!locales[code]) return;
  current = code;
  saveLocale(code);
  document.documentElement.lang = code;
  applyTranslations();
}

/**
 * Initialise the i18n system: restore the saved locale, wire up the
 * language selector, and apply translations for the first time.
 */
export function initI18n() {
  current = getSavedLocale();
  document.documentElement.lang = current;

  const selector = document.getElementById('language-selector');
  if (selector) {
    selector.value = current;
    selector.addEventListener('change', (e) => setLocale(e.target.value));
  }

  applyTranslations();
}
