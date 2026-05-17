import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';
import QRCode from 'react-native-qrcode-svg';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { logWarn } from '@/src/log';
import { useTenantStore } from '@/src/stores/tenantStore';
import { useTheme } from '@/src/theme/useTheme';

const HAS_EXPORTED_KEY = 'hasExportedTenant';

export default function ExportTenantScreen() {
  const theme = useTheme();
  const uuid = useTenantStore((s) => s.uuid);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Mark "has exported" on screen open so the banner disappears.
    SecureStore.setItemAsync(HAS_EXPORTED_KEY, '1').catch((err) => {
      logWarn('mark exported failed', err);
    });
  }, []);

  const onCopy = async () => {
    if (!uuid) {
      return;
    }
    try {
      await Clipboard.setStringAsync(uuid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch (err) {
      logWarn('clipboard copy failed', err);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Card style={styles.card}>
        <Text style={[styles.help, { color: theme.text }]}>
          Save this QR or the UUID below. If you reinstall the app or get a new device, you'll need
          it to restore your data.
        </Text>
        <View style={[styles.qrFrame, { backgroundColor: theme.text }]}>
          {uuid ? <QRCode value={uuid} size={200} backgroundColor={theme.text} color={theme.bg} /> : null}
        </View>
        <Text selectable style={[styles.uuid, { color: theme.textMuted }]}>
          {uuid ?? '(no tenant)'}
        </Text>
        <Button title={copied ? 'Copied!' : 'Copy UUID'} onPress={onCopy} variant="secondary" />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    alignItems: 'center',
    gap: 16,
  },
  help: {
    textAlign: 'center',
    fontSize: 13,
  },
  qrFrame: {
    padding: 16,
    borderRadius: 12,
  },
  uuid: {
    fontFamily: 'Courier',
    fontSize: 12,
    textAlign: 'center',
  },
});
