/**
 * Authentication module – placeholder.
 *
 * The previous MSAL / Microsoft login implementation has been removed.
 * Replace this file with a new authentication provider when ready.
 */

/**
 * Initialise authentication.
 * @returns {Promise<null>} Always resolves to null (no auth provider configured).
 */
export async function initAuth() {
  return null;
}

/**
 * Start an interactive login.
 * @returns {Promise<null>}
 */
export async function login() {
  return null;
}

/**
 * Log the current user out.
 */
export async function logout() {
  // no-op
}

/**
 * Return the currently signed-in account, or null.
 * @returns {null}
 */
export function getAccount() {
  return null;
}
