import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Card } from '@/src/components/Card';
import {
  bucketByCategory,
  listExpensesInWindow,
  thisMonthWindow,
  thisWeekWindow,
  todayWindow,
  topDescriptions,
  totalCents,
  yesterdayWindow,
  type Window as TimeWindow,
} from '@/src/db/queries';
import { logWarn } from '@/src/log';
import { type Expense } from '@/src/db/schema';
import { useTheme } from '@/src/theme/useTheme';
import { formatCurrencyCents } from '@/src/util/format';

type SectionSpec = { key: string; title: string; window: TimeWindow };

function useSections(): SectionSpec[] {
  return [
    { key: 'today', title: 'Today', window: todayWindow() },
    { key: 'yesterday', title: 'Yesterday', window: yesterdayWindow() },
    { key: 'week', title: 'This week', window: thisWeekWindow() },
    { key: 'month', title: 'This month', window: thisMonthWindow() },
  ];
}

type BarRowProps = {
  label: string;
  amountCents: number;
  maxCents: number;
};

function BarRow({ label, amountCents, maxCents }: BarRowProps) {
  const theme = useTheme();
  const ratio = maxCents > 0 ? Math.max(0.02, amountCents / maxCents) : 0;
  return (
    <View style={styles.barRow}>
      <Text style={[styles.barLabel, { color: theme.text }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.barTrack, { backgroundColor: theme.border }]}>
        <View
          style={{
            backgroundColor: theme.accent,
            width: `${ratio * 100}%`,
            height: '100%',
            borderRadius: 4,
          }}
        />
      </View>
      <Text style={[styles.barAmount, { color: theme.textMuted }]}>
        {formatCurrencyCents(amountCents)}
      </Text>
    </View>
  );
}

type SectionProps = { spec: SectionSpec; rows: Expense[] };

function StatSection({ spec, rows }: SectionProps) {
  const theme = useTheme();
  const total = totalCents(rows);

  if (rows.length === 0) {
    return (
      <Card style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{spec.title}</Text>
        <Text style={[styles.noData, { color: theme.textMuted }]}>No data</Text>
      </Card>
    );
  }

  const cats = bucketByCategory(rows);
  const top = topDescriptions(rows, 5);
  const maxCat = cats.reduce((m, c) => Math.max(m, c.cents), 0);
  const maxTop = top.reduce((m, t) => Math.max(m, t.cents), 0);

  return (
    <Card style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{spec.title}</Text>
      <Text style={[styles.totalNumber, { color: theme.accent }]}>{formatCurrencyCents(total)}</Text>
      <Text style={[styles.entryCount, { color: theme.textMuted }]}>
        {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
      </Text>

      {cats.length > 0 ? (
        <>
          <Text style={[styles.subTitle, { color: theme.textMuted }]}>By category</Text>
          {cats.map((c) => (
            <BarRow key={c.category} label={c.category} amountCents={c.cents} maxCents={maxCat} />
          ))}
        </>
      ) : null}

      {top.length > 0 ? (
        <>
          <Text style={[styles.subTitle, { color: theme.textMuted }]}>Top descriptions</Text>
          {top.map((t) => (
            <BarRow key={t.description} label={t.description} amountCents={t.cents} maxCents={maxTop} />
          ))}
        </>
      ) : null}
    </Card>
  );
}

export default function ExpensesStatsView() {
  const theme = useTheme();
  const sections = useSections();
  const [data, setData] = useState<Record<string, Expense[]>>({});

  const refresh = useCallback(async () => {
    try {
      const entries = await Promise.all(
        sections.map(async (s) => {
          const rows = await listExpensesInWindow(s.window.from, s.window.to);
          return [s.key, rows] as const;
        }),
      );
      setData(Object.fromEntries(entries));
    } catch (err) {
      logWarn('stats refresh failed', err);
    }
  }, [sections]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={styles.container}>
      {sections.map((s) => (
        <StatSection key={s.key} spec={s} rows={data[s.key] ?? []} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  totalNumber: { fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  entryCount: { fontSize: 12, marginTop: -4 },
  subTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginTop: 10, marginBottom: 4 },
  noData: { paddingVertical: 12, textAlign: 'center' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  barLabel: { fontSize: 13, width: 90, flexShrink: 0 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  barAmount: { fontSize: 12, fontVariant: ['tabular-nums'], width: 70, textAlign: 'right' },
});
