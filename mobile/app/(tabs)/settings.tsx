import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Link } from 'expo-router';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Input } from '@/src/components/Input';
import { apiRequest } from '@/src/api/client';
import { logWarn } from '@/src/log';
import { SUPPORTED_CURRENCIES, useSettingsStore } from '@/src/stores/settingsStore';
import { useSyncStore } from '@/src/stores/syncStore';
import { useTenantStore } from '@/src/stores/tenantStore';
import { useThemeStore } from '@/src/stores/themeStore';
import { useTheme } from '@/src/theme/useTheme';
import { light } from '@/src/theme/tokens';
import { isValidHttpUrl, relativeTime } from '@/src/util/format';

const HAS_EXPORTED_KEY = 'hasExportedTenant';

type TestResult =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'ok'; ms: number }
  | { kind: 'err'; message: string };

export default function SettingsScreen() {
  const theme = useTheme();
  const mode = useThemeStore((s) => s.mode);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const backendUrl = useTenantStore((s) => s.backendUrl);
  const setBackendUrl = useTenantStore((s) => s.setBackendUrl);
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
  const syncing = useSyncStore((s) => s.syncing);
  const lastError = useSyncStore((s) => s.lastError);
  const defaultCurrency = useSettingsStore((s) => s.defaultCurrency);
  const setDefaultCurrency = useSettingsStore((s) => s.setDefaultCurrency);

  const [urlInput, setUrlInput] = useState(backendUrl ?? '');
  const [urlInvalid, setUrlInvalid] = useState(false);
  const [test, setTest] = useState<TestResult>({ kind: 'idle' });
  const [hasExported, setHasExported] = useState<boolean | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // Refresh the "last synced X min ago" string every 30s without rerunning the whole screen.
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setUrlInput(backendUrl ?? '');
  }, [backendUrl]);

  useEffect(() => {
    (async () => {
      try {
        const v = await SecureStore.getItemAsync(HAS_EXPORTED_KEY);
        setHasExported(v === '1');
      } catch {
        setHasExported(false);
      }
    })();
  }, []);

  const onUrlChange = useCallback(
    (v: string) => {
      setUrlInput(v);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        if (!v.trim()) {
          setUrlInvalid(false);
          void setBackendUrl('');
          return;
        }
        if (!isValidHttpUrl(v.trim())) {
          setUrlInvalid(true);
          return;
        }
        setUrlInvalid(false);
        void setBackendUrl(v.trim());
      }, 500);
    },
    [setBackendUrl],
  );

  const onTest = useCallback(async () => {
    setTest({ kind: 'pending' });
    const start = Date.now();
    try {
      await apiRequest('/tenant/me', { method: 'GET', timeoutMs: 5000 });
      setTest({ kind: 'ok', ms: Date.now() - start });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTest({ kind: 'err', message: msg });
      logWarn('connection test failed', err);
    }
  }, []);

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled">
      {/* Export reminder banner. Uses the light theme's text color so it stays
          legible against the yellow warning regardless of the active theme. */}
      {hasExported === false ? (
        <Card style={[styles.banner, { backgroundColor: theme.warning, borderColor: theme.warning }]}>
          <Text style={[styles.bannerTitle, { color: light.text }]}>Don't lose your data</Text>
          <Text style={[styles.bannerText, { color: light.text }]}>
            Export your tenant UUID. If you uninstall the app or get a new device, you need this to
            restore.
          </Text>
        </Card>
      ) : null}

      <Card>
        <View style={styles.rowItem}>
          <Text style={[styles.label, { color: theme.text }]}>Dark mode</Text>
          <Switch
            value={mode === 'dark'}
            onValueChange={() => {
              void toggleTheme();
            }}
            trackColor={{ false: theme.border, true: theme.accent }}
          />
        </View>
      </Card>

      <Card>
        <Text style={[styles.label, { color: theme.text }]}>Default currency</Text>
        <View style={styles.currencyRow}>
          {SUPPORTED_CURRENCIES.map((c) => {
            const active = c === defaultCurrency;
            return (
              <Pressable
                key={c}
                onPress={() => {
                  void setDefaultCurrency(c);
                }}
                style={({ pressed }) => [
                  styles.currencyBtn,
                  {
                    backgroundColor: active ? theme.accent : theme.bgAlt,
                    borderColor: active ? theme.accent : theme.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}>
                <Text style={{ color: active ? '#0d1117' : theme.text, fontWeight: '600' }}>
                  {c}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text style={[styles.label, { color: theme.text }]}>Backend URL</Text>
        <Input
          value={urlInput}
          onChangeText={onUrlChange}
          placeholder="https://your-pc.tailXXX.ts.net:8000"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          invalid={urlInvalid}
        />
        {urlInvalid ? (
          <Text style={[styles.hint, { color: theme.danger }]}>Not a valid URL</Text>
        ) : null}
        <View style={styles.actionRow}>
          <Button title="Test connection" onPress={onTest} variant="secondary" />
          {test.kind === 'pending' ? (
            <Text style={{ color: theme.textMuted }}>Testing…</Text>
          ) : test.kind === 'ok' ? (
            <Text style={{ color: theme.success }}>OK ({test.ms} ms)</Text>
          ) : test.kind === 'err' ? (
            <Text style={{ color: theme.danger }} numberOfLines={2}>
              {test.message}
            </Text>
          ) : null}
        </View>
      </Card>

      <Card>
        <View style={styles.rowItem}>
          <Text style={[styles.label, { color: theme.text }]}>Sync status</Text>
          <Text style={{ color: theme.textMuted }}>
            {syncing ? 'Syncing…' : `Last synced: ${relativeTime(lastSyncedAt, Date.now() + tick * 0)}`}
          </Text>
        </View>
        {lastError ? (
          <Text style={[styles.hint, { color: theme.danger }]} numberOfLines={2}>
            {lastError}
          </Text>
        ) : null}
      </Card>

      <Card>
        <Link href="/settings/export" asChild>
          <Button title="Export tenant (QR)" onPress={() => {}} variant="secondary" />
        </Link>
        <View style={{ height: 8 }} />
        <Link href="/settings/import" asChild>
          <Button title="Import tenant" onPress={() => {}} variant="secondary" />
        </Link>
      </Card>

      <Card>
        <View style={styles.rowItem}>
          <Text style={[styles.label, { color: theme.text }]}>App version</Text>
          <Text style={{ color: theme.textMuted }}>{Constants.expoConfig?.version ?? 'dev'}</Text>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  banner: {
    gap: 4,
  },
  bannerTitle: {
    fontWeight: '700',
  },
  bannerText: {},
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  currencyRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  currencyBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
});
