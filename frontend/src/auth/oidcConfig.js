/**
 * Zitadel OIDC configuration
 *
 * Required env vars (set in .env / docker-compose):
 *   VITE_ZITADEL_AUTHORITY  - e.g. https://neb-network-swsjpl.eu1.zitadel.cloud
 *   VITE_ZITADEL_CLIENT_ID  - Client ID of the "User Agent" app in Zitadel
 */

import { UserManager, WebStorageStateStore } from 'oidc-client-ts';

const authority = import.meta.env.VITE_ZITADEL_AUTHORITY;
const client_id = import.meta.env.VITE_ZITADEL_CLIENT_ID;

export const oidcConfig = {
  authority,
  client_id,
  redirect_uri: `${window.location.origin}/callback`,
  post_logout_redirect_uri: `${window.location.origin}`,
  scope: 'openid profile email',
  response_type: 'code',
  // Store OIDC state in sessionStorage (cleared on tab close — more secure than localStorage)
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  // Automatically refresh the token before it expires
  automaticSilentRenew: true,
};

// Shared UserManager instance — used by both the AuthProvider and api.js
export const userManager = new UserManager(oidcConfig);
