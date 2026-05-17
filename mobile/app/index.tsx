import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

type Step = { label: string; ok: boolean; error?: string };

async function step<T>(
  label: string,
  fn: () => Promise<T> | T,
  steps: Step[],
  setSteps: (s: Step[]) => void,
): Promise<T | undefined> {
  // eslint-disable-next-line no-console
  console.log('[vyro-diag] start:', label);
  try {
    const result = await fn();
    steps.push({ label, ok: true });
    setSteps([...steps]);
    // eslint-disable-next-line no-console
    console.log('[vyro-diag] ok:', label);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    steps.push({ label, ok: false, error: msg });
    setSteps([...steps]);
    // eslint-disable-next-line no-console
    console.log('[vyro-diag] FAIL:', label, msg);
    return undefined;
  }
}

export default function DiagnosticIndex() {
  const [steps, setSteps] = useState<Step[]>([]);

  useEffect(() => {
    (async () => {
      const s: Step[] = [];
      await step('import react-native-reanimated', () => import('react-native-reanimated'), s, setSteps);
      await step('import react-native-gesture-handler', () => import('react-native-gesture-handler'), s, setSteps);
      const dbMod = await step('import @/src/db', () => import('@/src/db'), s, setSteps);
      if (dbMod) {
        await step('runMigrations()', () => dbMod.runMigrations(), s, setSteps);
      }
      const themeMod = await step('import themeStore', () => import('@/src/stores/themeStore'), s, setSteps);
      const tenantMod = await step('import tenantStore', () => import('@/src/stores/tenantStore'), s, setSteps);
      const syncStoreMod = await step('import syncStore', () => import('@/src/stores/syncStore'), s, setSteps);
      if (themeMod) {
        await step('hydrate theme', () => themeMod.useThemeStore.getState().hydrate(), s, setSteps);
      }
      if (tenantMod) {
        await step('bootstrap tenant', () => tenantMod.useTenantStore.getState().bootstrap(), s, setSteps);
      }
      if (syncStoreMod) {
        await step('hydrate sync', () => syncStoreMod.useSyncStore.getState().hydrate(), s, setSteps);
      }
      const notifMod = await step('import notifications', () => import('@/src/notifications'), s, setSteps);
      if (notifMod) {
        await step('configureNotificationHandler', () => notifMod.configureNotificationHandler(), s, setSteps);
      }
      const trigMod = await step('import sync/triggers', () => import('@/src/sync/triggers'), s, setSteps);
      if (trigMod) {
        await step('registerSyncTriggers', () => trigMod.registerSyncTriggers(), s, setSteps);
      }
      s.push({ label: 'ALL DONE', ok: true });
      setSteps([...s]);
    })();
  }, []);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#0d1117',
        paddingTop: 60,
        paddingHorizontal: 20,
      }}>
      <Text style={{ color: '#58a6ff', fontSize: 22, fontWeight: 'bold', marginBottom: 16 }}>
        vyro diagnostic
      </Text>
      <ScrollView style={{ flex: 1 }}>
        {steps.map((st, i) => (
          <Text
            key={i}
            style={{
              color: st.ok ? '#3fb950' : '#f85149',
              marginBottom: 4,
              fontFamily: 'monospace',
              fontSize: 13,
            }}>
            {st.ok ? '[ok]' : '[FAIL]'} {st.label}
            {st.error ? `\n        ${st.error}` : ''}
          </Text>
        ))}
        {(steps.length === 0 || steps[steps.length - 1].label !== 'ALL DONE') && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
            <ActivityIndicator color="#58a6ff" size="small" />
            <Text style={{ color: '#8b949e', marginLeft: 8 }}>running next step...</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
