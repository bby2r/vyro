import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';

import { Button } from '@/src/components/Button';
import { Input } from '@/src/components/Input';
import { db } from '@/src/db';
import { expenses } from '@/src/db/schema';
import { logWarn } from '@/src/log';
import { SUPPORTED_CURRENCIES, useSettingsStore, type Currency } from '@/src/stores/settingsStore';
import { runOnce } from '@/src/sync/syncService';
import { useTheme } from '@/src/theme/useTheme';
import { parseAmountToCents } from '@/src/util/format';

function useShake() {
  const anim = useRef(new Animated.Value(0)).current;
  const shake = useCallback(() => {
    Animated.sequence([
      Animated.timing(anim, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 4, duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [anim]);
  return { translateX: anim, shake };
}

export default function ExpenseFormView() {
  const theme = useTheme();
  const defaultCurrency = useSettingsStore((s) => s.defaultCurrency);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const [descInvalid, setDescInvalid] = useState(false);
  const [amountInvalid, setAmountInvalid] = useState(false);
  const descRef = useRef<TextInput | null>(null);
  const amountRef = useRef<TextInput | null>(null);
  const descShake = useShake();
  const amountShake = useShake();

  useEffect(() => {
    setCurrency(defaultCurrency);
  }, [defaultCurrency]);

  useEffect(() => {
    const t = setTimeout(() => descRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const onSubmit = useCallback(() => {
    const trimmedDesc = description.trim();
    const cents = parseAmountToCents(amount);

    let ok = true;
    if (!trimmedDesc) {
      setDescInvalid(true);
      descShake.shake();
      ok = false;
    }
    if (cents === null) {
      setAmountInvalid(true);
      amountShake.shake();
      ok = false;
    }
    if (!ok) {
      return;
    }

    const now = new Date();
    const row = {
      client_id: Crypto.randomUUID(),
      description: trimmedDesc,
      amount_cents: cents!,
      currency,
      category: null,
      labels: null,
      occurred_at: now,
      deleted_at: null,
      created_at: now,
      updated_at: now,
      synced_at: null,
    };

    db.insert(expenses)
      .values(row)
      .then(() => {
        void runOnce();
      })
      .catch((err) => {
        logWarn('insert expense failed', err);
      });

    setDescription('');
    setAmount('');
    setCurrency(defaultCurrency);
    setDescInvalid(false);
    setAmountInvalid(false);
    descRef.current?.focus();
  }, [amount, amountShake, currency, defaultCurrency, description, descShake]);

  return (
    <View style={[styles.outer, { backgroundColor: theme.bg }]}>
      <View style={styles.inner}>
        <Animated.View style={{ transform: [{ translateX: descShake.translateX }] }}>
          <Input
            ref={descRef}
            value={description}
            onChangeText={(t) => {
              setDescription(t);
              if (descInvalid && t.trim()) {
                setDescInvalid(false);
              }
            }}
            placeholder="Description"
            invalid={descInvalid}
            returnKeyType="next"
            onSubmitEditing={() => amountRef.current?.focus()}
          />
        </Animated.View>

        <Animated.View style={{ transform: [{ translateX: amountShake.translateX }] }}>
          <Input
            ref={amountRef}
            value={amount}
            onChangeText={(t) => {
              setAmount(t);
              if (amountInvalid && parseAmountToCents(t) !== null) {
                setAmountInvalid(false);
              }
            }}
            placeholder="Amount (e.g. 12.50)"
            keyboardType="decimal-pad"
            invalid={amountInvalid}
            returnKeyType="done"
            onSubmitEditing={onSubmit}
          />
        </Animated.View>

        <View style={styles.currencyRow}>
          {SUPPORTED_CURRENCIES.map((c) => {
            const active = c === currency;
            return (
              <Pressable
                key={c}
                onPress={() => setCurrency(c)}
                style={({ pressed }) => [
                  styles.currencyBtn,
                  {
                    backgroundColor: active ? theme.accent : theme.bgAlt,
                    borderColor: active ? theme.accent : theme.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}>
                <Text
                  style={{
                    color: active ? '#0d1117' : theme.text,
                    fontWeight: '600',
                  }}>
                  {c}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Button title="Add expense" onPress={onSubmit} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, justifyContent: 'center' },
  inner: { paddingHorizontal: 16, gap: 14 },
  currencyRow: { flexDirection: 'row', gap: 8 },
  currencyBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
});
