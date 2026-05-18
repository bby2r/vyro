import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Input } from '@/src/components/Input';
import { logWarn } from '@/src/log';
import { useTenantStore } from '@/src/stores/tenantStore';
import { fullPull } from '@/src/sync/syncService';
import { useTheme } from '@/src/theme/useTheme';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ImportScreen() {
  const theme = useTheme();
  const setUuid = useTenantStore((s) => s.setUuid);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const doImport = async (trimmed: string) => {
    setWorking(true);
    try {
      await setUuid(trimmed);
      await fullPull();
      router.back();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      logWarn('import tenant failed', err);
    } finally {
      setWorking(false);
    }
  };

  const onApply = () => {
    const trimmed = input.trim().toLowerCase();
    if (!UUID_RE.test(trimmed)) {
      setError('Not a valid UUID');
      return;
    }
    setError(null);
    Alert.alert(
      'Replace tenant?',
      'This replaces your current tenant UUID and pulls all data from the backend. Any local unsynced changes will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace',
          style: 'destructive',
          onPress: () => {
            void doImport(trimmed);
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={styles.container}>
      <Card>
        <Text style={[styles.label, { color: theme.text }]}>Paste tenant UUID</Text>
        <Input
          value={input}
          onChangeText={(t) => {
            setInput(t);
            if (error) {
              setError(null);
            }
          }}
          placeholder="00000000-0000-0000-0000-000000000000"
          autoCapitalize="none"
          autoCorrect={false}
          invalid={!!error}
        />
        {error ? (
          <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
        ) : null}
        <View style={{ height: 8 }} />
        <Button
          title={working ? 'Importing…' : 'Import'}
          onPress={onApply}
          disabled={working}
        />
      </Card>
      <Card>
        <Text style={[styles.help, { color: theme.textMuted }]}>
          Paste the UUID you exported from your previous install. After importing, the app pulls
          all expenses and todos from the backend for that tenant.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  errorText: { fontSize: 12, marginTop: 6 },
  help: { fontSize: 13, lineHeight: 20 },
});
