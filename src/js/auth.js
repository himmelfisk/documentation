import { PublicClientApplication } from '@azure/msal-browser';

/**
 * MSAL authentication module.
 *
 * Wraps @azure/msal-browser to provide a simple login gate for the app.
 * Replace the clientId and authority below with values from your Azure AD
 * (Entra ID) app registration.
 */

const msalConfig = {
  auth: {
    clientId: 'YOUR_CLIENT_ID', // TODO: replace with real Azure AD app client ID
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: window.location.origin,
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

/**
 * Initialise MSAL and check for an existing session.
 * @returns {Promise<import('@azure/msal-browser').AccountInfo|null>}
 */
export async function initAuth() {
  msalInstance = new PublicClientApplication(msalConfig);
  await msalInstance.initialize();

  // Handle redirect response (when returning from a redirect-based login)
  const response = await msalInstance.handleRedirectPromise();
  if (response) {
    currentAccount = response.account;
  } else {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      currentAccount = accounts[0];
    }
  }

  return currentAccount;
}

/**
 * Start an interactive login (popup).
 * @returns {Promise<import('@azure/msal-browser').AccountInfo>}
 */
export async function login() {
  const response = await msalInstance.loginPopup(loginRequest);
  currentAccount = response.account;
  return currentAccount;
}

/**
 * Log the current user out (popup).
 */
export async function logout() {
  await msalInstance.logoutPopup();
  currentAccount = null;
}

/**
 * Return the currently signed-in account, or null.
 * @returns {import('@azure/msal-browser').AccountInfo|null}
 */
export function getAccount() {
  return currentAccount;
}
