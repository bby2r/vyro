import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { useTenantStore } from '@/src/stores/tenantStore';
import { useTheme } from '@/src/theme/useTheme';

const HAS_EXPORTED_KEY = 'hasExportedTenant';

export default function ExportScreen() {
  const theme = useTheme();
  const uuid = useTenantStore((s) => s.uuid);
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    if (!uuid) {
      return;
    }
    await Clipboard.setStringAsync(uuid);
    try {
      await SecureStore.setItemAsync(HAS_EXPORTED_KEY, '1');
    } catch {
      // best-effort
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={styles.container}>
      <Card>
        <Text style={[styles.label, { color: theme.text }]}>Your tenant UUID</Text>
        <View style={[styles.uuidBox, { backgroundColor: theme.bg, borderColor: theme.border }]}>
          <Text selectable style={[styles.uuidText, { color: theme.text }]}>
            {uuid ?? '(not initialized)'}
          </Text>
        </View>
        <Button title={copied ? 'Copied ✓' : 'Copy UUID'} onPress={onCopy} />
      </Card>
      <Card>
        <Text style={[styles.help, { color: theme.textMuted }]}>
          Save this UUID somewhere safe (password manager, notes). If you uninstall the app or move
          to a new device, paste it into "Import tenant" to restore your data from the backend.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  uuidBox: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
  },
  uuidText: { fontSize: 13, fontFamily: 'monospace' },
  help: { fontSize: 13, lineHeight: 20 },
});
