import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Crypto from 'expo-crypto';

import { Button } from '@/src/components/Button';
import { Input } from '@/src/components/Input';
import { db } from '@/src/db';
import { todos } from '@/src/db/schema';
import { logWarn } from '@/src/log';
import { scheduleTodoReminder } from '@/src/notifications';
import { runOnce } from '@/src/sync/syncService';
import { useTheme } from '@/src/theme/useTheme';
import { formatDateShort } from '@/src/util/format';

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

export default function TodoForm() {
  const theme = useTheme();
  const [title, setTitle] = useState('');
  const [titleInvalid, setTitleInvalid] = useState(false);
  const [dueAt, setDueAt] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState<'date' | 'time' | null>(null);
  const titleRef = useRef<TextInput | null>(null);
  const titleShake = useShake();

  useEffect(() => {
    const t = setTimeout(() => titleRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const onPickerChange = useCallback(
    (event: DateTimePickerEvent, picked?: Date) => {
      const action = event.type;
      if (Platform.OS === 'android') {
        setShowPicker(null);
      }
      if (action === 'dismissed' || !picked) {
        if (Platform.OS !== 'android') {
          setShowPicker(null);
        }
        return;
      }
      if (showPicker === 'date') {
        // After date, pick time on Android (iOS shows datetime in one).
        const base = dueAt ?? new Date();
        const updated = new Date(picked);
        updated.setHours(base.getHours(), base.getMinutes(), 0, 0);
        setDueAt(updated);
        if (Platform.OS === 'android') {
          setShowPicker('time');
        } else {
          setShowPicker(null);
        }
      } else if (showPicker === 'time') {
        const base = dueAt ?? new Date();
        const updated = new Date(base);
        updated.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
        setDueAt(updated);
        if (Platform.OS !== 'android') {
          setShowPicker(null);
        }
      }
    },
    [dueAt, showPicker],
  );

  const onSubmit = useCallback(() => {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitleInvalid(true);
      titleShake.shake();
      return;
    }

    const now = new Date();
    const clientId = Crypto.randomUUID();
    const capturedDue = dueAt;

    const row = {
      client_id: clientId,
      title: trimmed,
      due_at: capturedDue,
      done: 0,
      category: null,
      labels: null,
      estimated_minutes: null,
      notification_id: null as string | null,
      deleted_at: null,
      created_at: now,
      updated_at: now,
      synced_at: null,
    };

    db.insert(todos)
      .values(row)
      .then(async () => {
        if (capturedDue && capturedDue.getTime() > Date.now()) {
          try {
            const id = await scheduleTodoReminder(trimmed, capturedDue);
            // best-effort; ignore if update fails
            const { eq } = await import('drizzle-orm');
            await db
              .update(todos)
              .set({ notification_id: id })
              .where(eq(todos.client_id, clientId));
          } catch (err) {
            logWarn('schedule reminder failed', err);
          }
        }
        void runOnce();
      })
      .catch((err) => {
        logWarn('insert todo failed', err);
      });

    setTitle('');
    setDueAt(null);
    setTitleInvalid(false);
    titleRef.current?.focus();
  }, [dueAt, title, titleShake]);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Animated.View style={{ transform: [{ translateX: titleShake.translateX }] }}>
        <Input
          ref={titleRef}
          value={title}
          onChangeText={(t) => {
            setTitle(t);
            if (titleInvalid && t.trim()) {
              setTitleInvalid(false);
            }
          }}
          placeholder="Todo title"
          invalid={titleInvalid}
          returnKeyType="done"
          onSubmitEditing={onSubmit}
        />
      </Animated.View>

      <View style={styles.dueRow}>
        <Text style={{ color: theme.text, flex: 1 }}>
          {dueAt ? `Due: ${formatDateShort(dueAt)}` : 'No due date'}
        </Text>
        {dueAt ? (
          <Pressable
            onPress={() => setDueAt(null)}
            style={({ pressed }) => [
              styles.smallBtn,
              { borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
            ]}>
            <Text style={{ color: theme.text }}>Clear</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => setShowPicker('date')}
          style={({ pressed }) => [
            styles.smallBtn,
            { borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
          ]}>
          <Text style={{ color: theme.accent }}>{dueAt ? 'Change' : 'Set due date'}</Text>
        </Pressable>
      </View>

      {showPicker ? (
        <DateTimePicker
          value={dueAt ?? new Date()}
          mode={showPicker}
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onPickerChange}
        />
      ) : null}

      <Button title="Add todo" onPress={onSubmit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smallBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
});
