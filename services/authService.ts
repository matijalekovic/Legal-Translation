/**
 * Authentication service for Google OAuth
 */

// Allowed domain and specific emails
const ALLOWED_DOMAIN = '@milovanoviclaw.com';
const ALLOWED_EMAILS = [
  'joca.ristovicmilovanovic@gmail.com',
  'matija.lekovic@gmail.com',
  'jristovic@galenika.rs',
  'predragg.milovanovic@gmail.com',
  'ristovic.svetlana@gmail.com'
  
];

/**
 * Check if a user email is authorized to use the app
 */
export function isAuthorizedUser(email: string): boolean {
  // Check if email ends with allowed domain
  if (email.endsWith(ALLOWED_DOMAIN)) {
    return true;
  }

  // Check if email is in the allowed list
  if (ALLOWED_EMAILS.includes(email.toLowerCase())) {
    return true;
  }

  return false;
}

/**
 * Get user info from local storage
 */
export function getStoredUser(): { email: string; name: string; picture: string } | null {
  const userStr = localStorage.getItem('authorized_user');
  if (!userStr) return null;

  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Store user info in local storage
 */
export function storeUser(user: { email: string; name: string; picture: string }): void {
  localStorage.setItem('authorized_user', JSON.stringify(user));
}

/**
 * Clear stored user info
 */
export function clearStoredUser(): void {
  localStorage.removeItem('authorized_user');
}
