import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';

import { Button } from '@/src/components/Button';
import { Input } from '@/src/components/Input';
import { db } from '@/src/db';
import { expenses } from '@/src/db/schema';
import { logWarn } from '@/src/log';
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

export default function ExpenseForm() {
  const theme = useTheme();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [descInvalid, setDescInvalid] = useState(false);
  const [amountInvalid, setAmountInvalid] = useState(false);
  const descRef = useRef<TextInput | null>(null);
  const amountRef = useRef<TextInput | null>(null);
  const descShake = useShake();
  const amountShake = useShake();

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
      currency: 'USD',
      category: null,
      labels: null,
      occurred_at: now,
      deleted_at: null,
      created_at: now,
      updated_at: now,
      synced_at: null,
    };

    // Fire-and-forget insert. We don't await because the DB call is fast
    // and we want the form clearing UX to feel instant.
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
    setDescInvalid(false);
    setAmountInvalid(false);
    descRef.current?.focus();
  }, [amount, description, amountShake, descShake]);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
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
      <Button title="Add expense" onPress={onSubmit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
});
