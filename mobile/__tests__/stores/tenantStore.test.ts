import { useTenantStore } from '@/src/stores/tenantStore';

// Pull our mocked secure store + crypto from jest.setup
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SecureStore = require('expo-secure-store') as {
  __reset?: () => void;
  setItemAsync: (k: string, v: string) => Promise<void>;
};

describe('tenantStore', () => {
  beforeEach(() => {
    SecureStore.__reset?.();
    useTenantStore.setState({ uuid: null, backendUrl: null, hydrated: false });
  });

  it('bootstrap generates and persists a UUID on first launch', async () => {
    await useTenantStore.getState().bootstrap();
    const state = useTenantStore.getState();
    expect(state.uuid).toBeTruthy();
    expect(state.hydrated).toBe(true);
    // Subsequent bootstrap reads the stored value (does not regenerate).
    const firstUuid = state.uuid!;
    useTenantStore.setState({ uuid: null, hydrated: false });
    await useTenantStore.getState().bootstrap();
    expect(useTenantStore.getState().uuid).toBe(firstUuid);
  });

  it('setUuid overwrites the persisted UUID', async () => {
    await useTenantStore.getState().bootstrap();
    await useTenantStore.getState().setUuid('11111111-1111-4111-8111-111111111111');
    expect(useTenantStore.getState().uuid).toBe('11111111-1111-4111-8111-111111111111');

    // Verify persistence: simulate re-bootstrap and confirm new uuid sticks.
    useTenantStore.setState({ uuid: null, hydrated: false });
    await useTenantStore.getState().bootstrap();
    expect(useTenantStore.getState().uuid).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('setBackendUrl persists the URL', async () => {
    await useTenantStore.getState().bootstrap();
    await useTenantStore.getState().setBackendUrl('http://10.0.0.5:8000');
    expect(useTenantStore.getState().backendUrl).toBe('http://10.0.0.5:8000');

    useTenantStore.setState({ uuid: null, backendUrl: null, hydrated: false });
    await useTenantStore.getState().bootstrap();
    expect(useTenantStore.getState().backendUrl).toBe('http://10.0.0.5:8000');
  });
});
