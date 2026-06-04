/**
 * api.js
 * 
 * This file contains the networking client logic for the e-wallet frontend.
 * It provides a single utility, `apiFetch`, that wraps the standard web `fetch` API.
 * 
 * Features:
 * 1. Automatically attaches the user's JWT Authorization token to backend requests.
 * 2. Resolves the server's base URL (localhost for dev, window origin for deployment).
 * 3. Gracefully logs users out if their session is expired (intercepts 401 errors).
 * 4. Standardizes error extraction from JSON backend responses.
 */

import { store, logout } from './store.js';

// Resolve the backend API root path.
// Looks at window.__API_BASE__ (set in index.html index configuration), falling back to localhost.
export let API_BASE = (window.__API_BASE__ || 'http://localhost:4000/api').replace(/\/$/, '');

/**
 * Perform an HTTP Request to the backend server with dynamic auth headers.
 * 
 * @param {string} path - The backend endpoint sub-path (e.g. '/auth/login', '/users/me').
 * @param {object} options - Standard fetch request options (headers, body, method, etc.).
 * @returns {Promise<any>} - Resolves with parsed JSON response data or raw string.
 */
export async function apiFetch(path, options = {}) {
  const headers = options.headers || {};
  
  // If the user is logged in, attach their token to the Bearer Authorization Header
  if (store.token) {
    headers['Authorization'] = 'Bearer ' + store.token;
  }
  
  // Include credentials for CORS requests if needed
  const opts = { credentials: 'same-origin', ...options, headers };
  
  try {
    // Fire the network request to the backend
    const res = await fetch(API_BASE + path, opts);
    
    // Intercept 401 (Unauthorized/Expired Token) errors and log out the user
    if (res.status === 401) {
      logout();
      throw new Error('Unauthorized — please login again');
    }
    
    // Parse response output
    const text = await res.text();
    try {
      // If it's valid JSON, check for HTTP error statuses and return parsed object
      const json = text ? JSON.parse(text) : {};
      if (!res.ok) {
        throw new Error(json.message || (json.error && json.error.message) || `Request failed with status ${res.status}: ${text}`);
      }
      return json;
    } catch (err) {
      // Fallback for non-JSON response data
      if (!res.ok) throw new Error(`Request failed with status ${res.status}: ${text || 'Empty response'}`);
      return text;
    }
  } catch (err) {
    // Log network connection problems or timeouts
    console.error('API Fetch Error:', {
      path,
      url: API_BASE + path,
      error: err.message,
      timestamp: new Date().toISOString()
    });
    throw new Error(`Connection failed: ${err.message} (API: ${API_BASE})`);
  }
}
