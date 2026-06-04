/**
 * store.js
 * 
 * This file serves as the centralized state manager for user authentication.
 * It holds the current active user's credentials (JWT token and profile information)
 * and synchronizes them with the browser's local storage so that sessions persist
 * even if the user refreshes the page.
 */

// Central state store
export const store = {
  // Retrieve the stored JWT token (if any) from localStorage on app startup
  token: localStorage.getItem('ewallet_token') || null,
  
  // Retrieve and parse user details (name, email, role, balance) on app startup
  user: JSON.parse(localStorage.getItem('ewallet_user') || 'null'),
};

/**
 * Updates the authentication state in the store and in the browser's localStorage.
 * Triggers the navigation bar UI to update accordingly.
 * 
 * @param {string|null} token - The JWT authorization token returned from the backend.
 * @param {object|null} user - The user details object.
 */
export function setAuth(token, user) {
  // Update state in memory
  store.token = token;
  store.user = user;

  // Persist or clean up JWT Token in localStorage
  if (token) {
    localStorage.setItem('ewallet_token', token);
  } else {
    localStorage.removeItem('ewallet_token');
  }

  // Persist or clean up user profile JSON in localStorage
  if (user) {
    localStorage.setItem('ewallet_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('ewallet_user');
  }
  
  // Notify the application entry point (main.js) to re-render the Top Navigation Bar
  if (window.__onAuthChange) {
    window.__onAuthChange();
  }
}

/**
 * Logs out the user by clearing authentication tokens/user data and redirecting them
 * to the login screen.
 */
export function logout() {
  // Clear memory and localStorage storage
  setAuth(null, null);
  
  // Dynamically load router.js to avoid circular dependencies and redirect to login screen
  import('./router.js').then(m => m.goto('login'));
}
