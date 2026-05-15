import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { db } from '@/src/db';
import { expenses, todos } from '@/src/db/schema';
import { logWarn } from '@/src/log';
import { useTenantStore } from '@/src/stores/tenantStore';
import { fullPull } from '@/src/sync/syncService';
import { useTheme } from '@/src/theme/useTheme';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ImportTenantScreen() {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const setUuid = useTenantStore((s) => s.setUuid);
  const [scanned, setScanned] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  const onConfirm = useCallback(
    async (newUuid: string) => {
      setImporting(true);
      try {
        await setUuid(newUuid);
        await db.delete(expenses);
        await db.delete(todos);
        await fullPull();
        Alert.alert('Imported', 'Data restored from backend.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logWarn('import failed', err);
        Alert.alert('Import failed', msg);
      } finally {
        setImporting(false);
      }
    },
    [setUuid],
  );

  const onScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (scanned || importing) {
        return;
      }
      const raw = (result.data ?? '').trim();
      if (!UUID_REGEX.test(raw)) {
        return;
      }
      setScanned(raw);
      Alert.alert(
        'Import tenant',
        `Replace current tenant UUID with ${raw}? This will fetch all data from backend.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setScanned(null) },
          { text: 'Replace', style: 'destructive', onPress: () => onConfirm(raw) },
        ],
      );
    },
    [importing, onConfirm, scanned],
  );

  if (!permission) {
    return <View style={[styles.center, { backgroundColor: theme.bg }]} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <Card style={{ gap: 12 }}>
          <Text style={{ color: theme.text }}>Camera permission is required to scan a tenant QR.</Text>
          <Button title="Grant camera access" onPress={() => requestPermission()} />
        </Card>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={onScanned}
      />
      <View style={styles.overlay} pointerEvents="box-none">
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.closeBtn,
            { backgroundColor: theme.bgAlt, borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
          ]}>
          <Text style={{ color: theme.text }}>Cancel</Text>
        </Pressable>
        <Text style={[styles.hint, { color: theme.text, backgroundColor: theme.bgAlt }]}>
          Point camera at the QR exported on the other device
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  overlay: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  closeBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  hint: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
