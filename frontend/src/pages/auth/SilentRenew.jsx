import { useEffect } from 'react';
import { userManager } from '../../auth/oidcConfig';

/**
 * /silent-renew — loaded in a hidden iframe by oidc-client-ts to refresh tokens.
 * Must match `silent_redirect_uri` in oidcConfig.js and in Zitadel redirect URIs.
 */
export default function SilentRenew() {
  useEffect(() => {
    userManager.signinSilentCallback().catch(() => {});
  }, []);
  return null;
}
