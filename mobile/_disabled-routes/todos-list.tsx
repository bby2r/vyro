import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { eq } from 'drizzle-orm';
import { Check, Pencil, Square, Trash2 } from 'lucide-react-native';

import { Button } from '@/src/components/Button';
import { IconButton } from '@/src/components/IconButton';
import { Input } from '@/src/components/Input';
import { db } from '@/src/db';
import { listTodos } from '@/src/db/queries';
import { todos, type Todo } from '@/src/db/schema';
import { logWarn } from '@/src/log';
import { cancelTodoReminder, scheduleTodoReminder } from '@/src/notifications';
import { runOnce } from '@/src/sync/syncService';
import { useTheme } from '@/src/theme/useTheme';
import { formatDateShort } from '@/src/util/format';

const ROW_HEIGHT = 56;

type RowProps = {
  item: Todo;
  onToggleDone: (t: Todo) => void;
  onEdit: (t: Todo) => void;
  onDelete: (t: Todo) => void;
};

const TodoRow = React.memo(function TodoRow({ item, onToggleDone, onEdit, onDelete }: RowProps) {
  const theme = useTheme();
  const done = !!item.done;
  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <IconButton
        icon={done ? Check : Square}
        onPress={() => onToggleDone(item)}
        color={done ? theme.success : theme.textMuted}
        accessibilityLabel="Toggle done"
      />
      <View style={styles.rowMain}>
        <Text
          style={[
            styles.rowTitle,
            { color: done ? theme.textMuted : theme.text, textDecorationLine: done ? 'line-through' : 'none' },
          ]}
          numberOfLines={1}>
          {item.title}
        </Text>
        {item.due_at ? (
          <Text style={[styles.rowDue, { color: theme.textMuted }]}>
            {formatDateShort(item.due_at)}
          </Text>
        ) : null}
      </View>
      <IconButton icon={Pencil} onPress={() => onEdit(item)} accessibilityLabel="Edit todo" />
      <IconButton icon={Trash2} onPress={() => onDelete(item)} accessibilityLabel="Delete todo" />
    </View>
  );
});

type EditState = {
  todo: Todo;
  title: string;
  due_at: Date | null;
};

export default function TodosList() {
  const theme = useTheme();
  const [rows, setRows] = useState<Todo[]>([]);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [showPicker, setShowPicker] = useState<'date' | 'time' | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await listTodos();
      setRows(data);
    } catch (err) {
      logWarn('listTodos failed', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onToggleDone = useCallback(
    async (t: Todo) => {
      const now = new Date();
      const nextDone = t.done ? 0 : 1;
      try {
        const update: Partial<Todo> & {
          done: number;
          updated_at: Date;
          synced_at: Date | null;
          notification_id?: string | null;
        } = {
          done: nextDone,
          updated_at: now,
          synced_at: null,
        };
        if (nextDone === 1 && t.notification_id) {
          await cancelTodoReminder(t.notification_id);
          update.notification_id = null;
        }
        await db.update(todos).set(update).where(eq(todos.client_id, t.client_id));
        await refresh();
        void runOnce();
      } catch (err) {
        logWarn('toggle todo failed', err);
      }
    },
    [refresh],
  );

  const onDelete = useCallback(
    async (t: Todo) => {
      const now = new Date();
      try {
        if (t.notification_id) {
          await cancelTodoReminder(t.notification_id);
        }
        await db
          .update(todos)
          .set({ deleted_at: now, updated_at: now, synced_at: null, notification_id: null })
          .where(eq(todos.client_id, t.client_id));
        await refresh();
        void runOnce();
      } catch (err) {
        logWarn('delete todo failed', err);
      }
    },
    [refresh],
  );

  const onEdit = useCallback((t: Todo) => {
    setEditing({ todo: t, title: t.title, due_at: t.due_at });
  }, []);

  const onSaveEdit = useCallback(async () => {
    if (!editing) {
      return;
    }
    const trimmed = editing.title.trim();
    if (!trimmed) {
      return;
    }
    const now = new Date();
    const oldDue = editing.todo.due_at;
    const newDue = editing.due_at;
    const dueChanged = (oldDue?.getTime() ?? null) !== (newDue?.getTime() ?? null);

    try {
      let notificationId = editing.todo.notification_id;
      if (dueChanged) {
        if (editing.todo.notification_id) {
          await cancelTodoReminder(editing.todo.notification_id);
          notificationId = null;
        }
        if (newDue && newDue.getTime() > Date.now()) {
          notificationId = await scheduleTodoReminder(trimmed, newDue);
        }
      }

      await db
        .update(todos)
        .set({
          title: trimmed,
          due_at: newDue,
          notification_id: notificationId,
          updated_at: now,
          synced_at: null,
        })
        .where(eq(todos.client_id, editing.todo.client_id));
      setEditing(null);
      await refresh();
      void runOnce();
    } catch (err) {
      logWarn('edit todo failed', err);
    }
  }, [editing, refresh]);

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
      setEditing((prev) => {
        if (!prev) {
          return prev;
        }
        const base = prev.due_at ?? new Date();
        const updated = new Date(picked);
        if (showPicker === 'date') {
          updated.setHours(base.getHours(), base.getMinutes(), 0, 0);
        } else {
          const next = new Date(base);
          next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
          return { ...prev, due_at: next };
        }
        return { ...prev, due_at: updated };
      });
      if (Platform.OS === 'android' && showPicker === 'date') {
        setShowPicker('time');
      } else if (Platform.OS !== 'android') {
        setShowPicker(null);
      }
    },
    [showPicker],
  );

  const keyExtractor = useCallback((item: Todo) => item.client_id, []);

  const getItemLayout = useCallback(
    (_data: ArrayLike<Todo> | null | undefined, index: number) => ({
      length: ROW_HEIGHT,
      offset: ROW_HEIGHT * index,
      index,
    }),
    [],
  );

  const empty = useMemo(
    () => (
      <View style={styles.empty}>
        <Text style={{ color: theme.textMuted }}>No todos yet.</Text>
      </View>
    ),
    [theme.textMuted],
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <FlatList
        data={rows}
        renderItem={({ item }) => (
          <TodoRow
            item={item}
            onToggleDone={onToggleDone}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        )}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        windowSize={5}
        removeClippedSubviews
        initialNumToRender={20}
        ListEmptyComponent={empty}
      />

      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modal, { backgroundColor: theme.bgAlt, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Edit todo</Text>
            <Input
              value={editing?.title ?? ''}
              onChangeText={(t) => setEditing((prev) => (prev ? { ...prev, title: t } : prev))}
              placeholder="Title"
            />
            <View style={styles.dueRow}>
              <Text style={{ color: theme.text, flex: 1 }}>
                {editing?.due_at ? `Due: ${formatDateShort(editing.due_at)}` : 'No due date'}
              </Text>
              {editing?.due_at ? (
                <Pressable
                  onPress={() => setEditing((prev) => (prev ? { ...prev, due_at: null } : prev))}
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
                <Text style={{ color: theme.accent }}>{editing?.due_at ? 'Change' : 'Set'}</Text>
              </Pressable>
            </View>

            {showPicker ? (
              <DateTimePicker
                value={editing?.due_at ?? new Date()}
                mode={showPicker}
                is24Hour
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onPickerChange}
              />
            ) : null}

            <View style={styles.modalButtons}>
              <Button title="Cancel" variant="secondary" onPress={() => setEditing(null)} style={{ flex: 1 }} />
              <Button title="Save" onPress={onSaveEdit} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  row: {
    height: ROW_HEIGHT,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 2,
  },
  rowTitle: {
    fontSize: 14,
  },
  rowDue: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  empty: {
    paddingTop: 64,
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
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
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
});
