import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Animated, FlatList, Modal, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { eq } from 'drizzle-orm';
import { Pencil, Trash2 } from 'lucide-react-native';

import { Button } from '@/src/components/Button';
import { IconButton } from '@/src/components/IconButton';
import { Input } from '@/src/components/Input';
import { db } from '@/src/db';
import { listExpenses } from '@/src/db/queries';
import { expenses, type Expense } from '@/src/db/schema';
import { logWarn } from '@/src/log';
import { runOnce } from '@/src/sync/syncService';
import { useTheme } from '@/src/theme/useTheme';
import { formatCurrencyCents, formatDateShort, parseAmountToCents } from '@/src/util/format';

const ROW_HEIGHT = 56;

type RowProps = {
  item: Expense;
  onEdit: (e: Expense) => void;
  onDelete: (e: Expense) => void;
};

const ExpenseRow = React.memo(function ExpenseRow({ item, onEdit, onDelete }: RowProps) {
  const theme = useTheme();
  return (
    <View
      style={[styles.row, { borderBottomColor: theme.border }]}>
      <View style={styles.rowMain}>
        <Text style={[styles.rowDate, { color: theme.textMuted }]}>
          {formatDateShort(item.created_at)}
        </Text>
        <Text style={[styles.rowDesc, { color: theme.text }]} numberOfLines={1}>
          {item.description}
        </Text>
      </View>
      <Text style={[styles.rowAmount, { color: theme.text }]}>
        {formatCurrencyCents(item.amount_cents, item.currency ?? 'USD')}
      </Text>
      <IconButton icon={Pencil} onPress={() => onEdit(item)} accessibilityLabel="Edit expense" />
      <IconButton icon={Trash2} onPress={() => onDelete(item)} accessibilityLabel="Delete expense" />
    </View>
  );
});

type EditState = {
  expense: Expense;
  description: string;
  amount: string;
};

export default function ExpensesList() {
  const theme = useTheme();
  const [rows, setRows] = useState<Expense[]>([]);
  const [editing, setEditing] = useState<EditState | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await listExpenses();
      setRows(data);
    } catch (err) {
      logWarn('listExpenses failed', err);
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

  const onDelete = useCallback(
    async (e: Expense) => {
      const now = new Date();
      try {
        await db
          .update(expenses)
          .set({ deleted_at: now, updated_at: now, synced_at: null })
          .where(eq(expenses.client_id, e.client_id));
        await refresh();
        void runOnce();
      } catch (err) {
        logWarn('delete expense failed', err);
      }
    },
    [refresh],
  );

  const onEdit = useCallback((e: Expense) => {
    setEditing({
      expense: e,
      description: e.description,
      amount: (e.amount_cents / 100).toFixed(2),
    });
  }, []);

  const onSaveEdit = useCallback(async () => {
    if (!editing) {
      return;
    }
    const trimmed = editing.description.trim();
    const cents = parseAmountToCents(editing.amount);
    if (!trimmed || cents === null) {
      return;
    }
    const now = new Date();
    try {
      await db
        .update(expenses)
        .set({
          description: trimmed,
          amount_cents: cents,
          updated_at: now,
          synced_at: null,
        })
        .where(eq(expenses.client_id, editing.expense.client_id));
      setEditing(null);
      await refresh();
      void runOnce();
    } catch (err) {
      logWarn('edit expense failed', err);
    }
  }, [editing, refresh]);

  const getItemLayout = useCallback(
    (_data: ArrayLike<Expense> | null | undefined, index: number) => ({
      length: ROW_HEIGHT,
      offset: ROW_HEIGHT * index,
      index,
    }),
    [],
  );

  const keyExtractor = useCallback((item: Expense) => item.client_id, []);

  const empty = useMemo(
    () => (
      <View style={styles.empty}>
        <Text style={{ color: theme.textMuted }}>No expenses yet.</Text>
      </View>
    ),
    [theme.textMuted],
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Animated.FlatList
        data={rows}
        renderItem={({ item }) => (
          <ExpenseRow item={item} onEdit={onEdit} onDelete={onDelete} />
        )}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        windowSize={5}
        removeClippedSubviews
        initialNumToRender={20}
        ListEmptyComponent={empty}
      />

      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={[styles.modalBackdrop]}>
          <View style={[styles.modal, { backgroundColor: theme.bgAlt, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Edit expense</Text>
            <Input
              value={editing?.description ?? ''}
              onChangeText={(t) => setEditing((prev) => (prev ? { ...prev, description: t } : prev))}
              placeholder="Description"
            />
            <Input
              value={editing?.amount ?? ''}
              onChangeText={(t) => setEditing((prev) => (prev ? { ...prev, amount: t } : prev))}
              placeholder="Amount"
              keyboardType="decimal-pad"
            />
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
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowDate: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  rowDesc: {
    fontSize: 14,
    flexShrink: 1,
  },
  rowAmount: {
    fontSize: 14,
    fontWeight: '600',
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
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
});
