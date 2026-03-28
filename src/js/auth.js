/**
 * Authentication module — Microsoft Entra ID via MSAL Browser v5.
 *
 * Uses the redirect flow which is the only reliable approach inside
 * Capacitor WebViews (popups do not work on native platforms).
 *
 * CORS on native platforms is handled by enabling CapacitorHttp in
 * capacitor.config.json so MSAL's token requests go through the
 * native HTTP layer instead of the browser fetch.
 */

import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';
import { Capacitor } from '@capacitor/core';

// ---------------------------------------------------------------------------
// Android – mirror MSAL's sessionStorage writes to localStorage
// ---------------------------------------------------------------------------
// MSAL v5 stores temporary interaction state (PKCE verifier, request params,
// interaction status) in sessionStorage even when cacheLocation is
// 'localStorage'.  Android WebView can lose sessionStorage during
// cross-origin navigation to the Microsoft login page and back.  The mirror
// lets MSAL's built-in fallback in getTemporaryCache() find the items in
// localStorage.

if (Capacitor.getPlatform() === 'android') {
  const origSet = window.sessionStorage.setItem.bind(window.sessionStorage);
  const origRemove = window.sessionStorage.removeItem.bind(window.sessionStorage);

  window.sessionStorage.setItem = function (key, value) {
    origSet(key, value);
    if (typeof key === 'string' && key.startsWith('msal.')) {
      window.localStorage.setItem(key, value);
    }
  };

  window.sessionStorage.removeItem = function (key) {
    origRemove(key);
    if (typeof key === 'string' && key.startsWith('msal.')) {
      window.localStorage.removeItem(key);
    }
  };
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Azure AD app-registration client ID.
 *
 * In an SPA the client ID is public (no secret), so embedding it in the
 * bundle is the standard approach.
 *
 * @see https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app
 */
const CLIENT_ID = '65702384-9248-47a3-80d9-bcf5abb69424';
const AUTHORITY = 'https://login.microsoftonline.com/organizations';

/** Platform-aware redirect URI. */
function getRedirectUri() {
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') return 'capacitor://localhost';
  if (platform === 'android') return 'https://localhost';
  // Web — use the current origin so it works on any hosted domain
  return window.location.origin;
}

const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: AUTHORITY,
    redirectUri: getRedirectUri(),
    postLogoutRedirectUri: getRedirectUri(),
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: 'localStorage',
  },
};

const loginRequest = {
  scopes: ['User.Read'],
};

// ---------------------------------------------------------------------------
// Singleton MSAL instance
// ---------------------------------------------------------------------------

let msalInstance = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise MSAL and process any pending redirect response.
 * Must be called once on every page load (before login / getAccount).
 *
 * @returns {Promise<import('@azure/msal-browser').AccountInfo|null>}
 *   The authenticated account, or null if not yet signed in.
 */
export async function initAuth() {
  msalInstance = new PublicClientApplication(msalConfig);
  await msalInstance.initialize();

  // On Android the MSAL redirect to https://localhost may fail because the
  // WebView bypasses Capacitor's local-asset server.  The native fallback in
  // MainActivity saves the hash fragment (#code=…) to localStorage before
  // reloading.  Restore it so handleRedirectPromise() can process the token.
  if (Capacitor.getPlatform() === 'android') {
    const savedHash = localStorage.getItem('__msal_hash');
    const savedTs = Number(localStorage.getItem('__msal_hash_ts') || '0');
    localStorage.removeItem('__msal_hash');
    localStorage.removeItem('__msal_hash_ts');
    if (savedHash && Date.now() - savedTs < 120_000) {
      window.location.hash = savedHash;
    }
  }

  // Process the redirect response (no-op if we didn't just come back from one).
  const response = await msalInstance.handleRedirectPromise();

  if (response && response.account) {
    msalInstance.setActiveAccount(response.account);
    return response.account;
  }

  // Check if there's already a cached / SSO session.
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    msalInstance.setActiveAccount(accounts[0]);
    return accounts[0];
  }

  return null;
}

/**
 * Start an interactive login via redirect.
 * The page will navigate away to Microsoft's login page and return to the
 * configured redirectUri, at which point initAuth() will pick up the result.
 */
export async function login() {
  if (!msalInstance) throw new Error('Call initAuth() first');
  await msalInstance.loginRedirect(loginRequest);
}

/**
 * Log the current user out via redirect.
 */
export async function logout() {
  if (!msalInstance) return;
  await msalInstance.logoutRedirect();
}

/**
 * Return the currently signed-in account, or null.
 * @returns {import('@azure/msal-browser').AccountInfo|null}
 */
export function getAccount() {
  if (!msalInstance) return null;
  return msalInstance.getActiveAccount() ?? null;
}

/**
 * Silently acquire an access token for the given scopes.
 * Falls back to an interactive redirect if the silent call fails
 * (e.g. because consent is required or the refresh token expired).
 *
 * @param {string[]} [requestedScopes] – defaults to ['User.Read']
 * @returns {Promise<string>} access token
 */
export async function getAccessToken(requestedScopes) {
  if (!msalInstance) throw new Error('Call initAuth() first');

  const account = getAccount();
  if (!account) throw new Error('No signed-in account');

  const request = { scopes: requestedScopes || loginRequest.scopes, account };

  try {
    const result = await msalInstance.acquireTokenSilent(request);
    return result.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      // Token cache empty / consent needed — fall back to redirect
      await msalInstance.acquireTokenRedirect(request);
      // The page will navigate away; we won't reach this line.
    }
    throw err;
  }
}
