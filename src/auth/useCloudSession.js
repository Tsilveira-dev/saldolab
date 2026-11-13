import { authClient } from './neonClient';

const unavailable = { data: null, isPending: false, error: null };
const useConfiguredSession = authClient?.useSession ?? (() => unavailable);

// Subscribe to the SDK store, including its cross-tab sign-out notifications.
export function useCloudSession() {
  return useConfiguredSession();
}
