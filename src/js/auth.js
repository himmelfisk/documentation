import { PublicClientApplication } from '@azure/msal-browser';
import { Capacitor } from '@capacitor/core';

/**
 * MSAL authentication module.
 *
 * Wraps @azure/msal-browser to provide a simple login gate for the app.
 * Replace the clientId and authority below with values from your Azure AD
 * (Entra ID) app registration.
 *
 * The following redirect URIs must be registered in your Azure AD app
 * registration as **Single-page application (SPA)** redirect URIs:
 *
 *   Android : https://localhost
 *   iOS     : capacitor://localhost
 *   Web     : your web server origin (e.g. http://localhost:3000)
 *
 * On native platforms (Android/iOS) the redirect-based auth flow is used
 * because popup windows do not work reliably inside Capacitor WebViews.
 */

/** Resolve the correct redirect URI for the current platform. */
function getRedirectUri() {
  switch (Capacitor.getPlatform()) {
    case 'android':
      return 'https://localhost';
    case 'ios':
      return 'capacitor://localhost';
    default:
      return window.location.origin;
  }
}

const isNative = Capacitor.isNativePlatform();

/*
 * On native platforms, mirror MSAL's sessionStorage writes to localStorage.
 *
 * MSAL stores temporary interaction state (PKCE code-verifier, request params,
 * interaction status) in sessionStorage regardless of the cacheLocation config.
 * Capacitor's WebView may lose sessionStorage across navigations (e.g. when
 * returning from the identity provider).  MSAL's internal getTemporaryCache()
 * already contains a fallback that checks localStorage when cacheLocation is
 * 'localStorage', so mirroring the writes here is enough to make the redirect
 * flow succeed.
 */
if (isNative) {
  const _setItem = sessionStorage.setItem.bind(sessionStorage);
  const _removeItem = sessionStorage.removeItem.bind(sessionStorage);

  sessionStorage.setItem = function (key, value) {
    _setItem(key, value);
    if (key.startsWith('msal')) {
      try { localStorage.setItem(key, value); } catch (_) { /* quota exceeded */ }
    }
  };

  sessionStorage.removeItem = function (key) {
    _removeItem(key);
    if (key.startsWith('msal')) {
      try { localStorage.removeItem(key); } catch (_) { /* ignore */ }
    }
  };
}

const msalConfig = {
  auth: {
    clientId: '65702384-9248-47a3-80d9-bcf5abb69424',
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: getRedirectUri(),
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
};

const loginRequest = {
  scopes: ['openid', 'profile', 'email'],
};

let msalInstance = null;
let currentAccount = null;

/** Max time (ms) to wait for the native layer to inject the auth hash. */
const AUTH_HASH_TIMEOUT_MS = 3000;

/**
 * Wait for the auth-response hash fragment to be injected by the native
 * layer (see MainActivity.java onPageFinished).  Returns as soon as
 * window.location.hash contains "code=" or after {@link timeoutMs}.
 */
function waitForAuthHash(timeoutMs) {
  return new Promise((resolve) => {
    if (window.location.hash.includes('code=')) {
      resolve();
      return;
    }

    const onHash = () => {
      clearTimeout(timer);
      resolve();
    };
    window.addEventListener('hashchange', onHash, { once: true });

    const timer = setTimeout(() => {
      window.removeEventListener('hashchange', onHash);
      resolve();
    }, timeoutMs);
  });
}

/**
 * Initialise MSAL and check for an existing session.
 * @returns {Promise<import('@azure/msal-browser').AccountInfo|null>}
 */
export async function initAuth() {
  msalInstance = new PublicClientApplication(msalConfig);
  await msalInstance.initialize();

  /*
   * On native platforms the auth redirect to https://localhost may fail
   * with ERR_CONNECTION_REFUSED.  The native layer (MainActivity)
   * captures the hash fragment, reloads the app, and injects the hash
   * via evaluateJavascript in onPageFinished.
   *
   * Because the hash is injected AFTER the page scripts start running
   * we must wait for it before calling handleRedirectPromise().
   * We only wait when a redirect is actually pending (flagged by
   * login() below) to avoid a startup delay on normal launches.
   */
  if (isNative && localStorage.getItem('__auth_redirect_pending') === 'true') {
    if (!window.location.hash.includes('code=')) {
      await waitForAuthHash(AUTH_HASH_TIMEOUT_MS);
    }
    localStorage.removeItem('__auth_redirect_pending');
  }

  // Handle redirect response (when returning from a redirect-based login).
  // On native platforms, disable navigateToLoginRequestUrl to avoid an
  // unnecessary extra navigation inside the Capacitor WebView.
  const redirectOpts = isNative
    ? { navigateToLoginRequestUrl: false }
    : undefined;

  try {
    const response = await msalInstance.handleRedirectPromise(redirectOpts);
    if (response) {
      currentAccount = response.account;
    }
  } catch (err) {
    console.error('MSAL handleRedirectPromise failed:', err);
  }

  // Fallback: check for a cached session even if the redirect handling
  // returned nothing or threw an error.
  if (!currentAccount) {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      currentAccount = accounts[0];
    }
  }

  return currentAccount;
}

/**
 * Start an interactive login.
 * Uses redirect flow on native platforms (Android/iOS) because popups
 * do not work reliably inside Capacitor WebViews.
 * Returns the account on web (popup) or null on native (redirect navigates away).
 * @returns {Promise<import('@azure/msal-browser').AccountInfo|null>}
 */
export async function login() {
  if (isNative) {
    // Flag that a redirect is about to happen so initAuth() knows to
    // wait for the hash fragment on the next page load.
    localStorage.setItem('__auth_redirect_pending', 'true');
    await msalInstance.loginRedirect(loginRequest);
    return null;
  }
  const response = await msalInstance.loginPopup(loginRequest);
  currentAccount = response.account;
  return currentAccount;
}

/**
 * Log the current user out.
 * Uses redirect flow on native, popup on web.
 */
export async function logout() {
  if (isNative) {
    await msalInstance.logoutRedirect();
  } else {
    await msalInstance.logoutPopup();
  }
  currentAccount = null;
}

/**
 * Return the currently signed-in account, or null.
 * @returns {import('@azure/msal-browser').AccountInfo|null}
 */
export function getAccount() {
  return currentAccount;
}
