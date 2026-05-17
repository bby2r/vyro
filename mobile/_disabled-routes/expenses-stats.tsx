import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { BarChart, LineChart, PieChart } from 'react-native-gifted-charts';

import { Card } from '@/src/components/Card';
import {
  bucketByCategory,
  listExpensesInWindow,
  runningTotalSeries,
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

type SectionSpec = {
  key: string;
  title: string;
  window: TimeWindow;
};

function useSections(): SectionSpec[] {
  // Recompute windows on every render so a stale store doesn't pin the user
  // to "yesterday" forever.
  return [
    { key: 'today', title: 'Today', window: todayWindow() },
    { key: 'yesterday', title: 'Yesterday', window: yesterdayWindow() },
    { key: 'week', title: 'This week', window: thisWeekWindow() },
    { key: 'month', title: 'This month', window: thisMonthWindow() },
  ];
}

const PIE_PALETTE_KEYS: Array<'accent' | 'success' | 'warning' | 'danger' | 'textMuted'> = [
  'accent',
  'success',
  'warning',
  'danger',
  'textMuted',
];

type SectionProps = {
  spec: SectionSpec;
  rows: Expense[];
};

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

  const series = runningTotalSeries(rows, spec.window);
  const lineData = series.map((p) => ({ value: p.cents / 100, label: p.label }));

  const cats = bucketByCategory(rows);
  const palette = PIE_PALETTE_KEYS.map((k) => theme[k]);
  const pieData = cats.map((c, i) => ({
    value: c.cents / 100,
    color: palette[i % palette.length],
    text: c.category,
  }));

  const top = topDescriptions(rows, 5);
  const barData = top.map((b) => ({
    value: b.cents / 100,
    label: b.description.length > 8 ? `${b.description.slice(0, 8)}…` : b.description,
    frontColor: theme.accent,
  }));

  return (
    <Card style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{spec.title}</Text>
      <Text style={[styles.totalNumber, { color: theme.accent }]}>{formatCurrencyCents(total)}</Text>

      <Text style={[styles.subTitle, { color: theme.textMuted }]}>Running total</Text>
      <LineChart
        data={lineData}
        color={theme.accent}
        thickness={2}
        hideDataPoints
        xAxisColor={theme.border}
        yAxisColor={theme.border}
        xAxisLabelTextStyle={{ color: theme.textMuted, fontSize: 9 }}
        yAxisTextStyle={{ color: theme.textMuted, fontSize: 9 }}
        rulesColor={theme.border}
        initialSpacing={0}
        adjustToWidth
        height={120}
      />

      <Text style={[styles.subTitle, { color: theme.textMuted }]}>By category</Text>
      <View style={styles.donutWrapper}>
        <PieChart data={pieData} donut radius={70} innerRadius={45} />
        <View style={styles.legend}>
          {cats.map((c, i) => (
            <View key={c.category} style={styles.legendRow}>
              <View style={[styles.legendSwatch, { backgroundColor: palette[i % palette.length] }]} />
              <Text style={{ color: theme.text, flexShrink: 1 }} numberOfLines={1}>
                {c.category}
              </Text>
              <Text style={{ color: theme.textMuted }}>{formatCurrencyCents(c.cents)}</Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={[styles.subTitle, { color: theme.textMuted }]}>Top descriptions</Text>
      <BarChart
        data={barData}
        barWidth={22}
        spacing={12}
        frontColor={theme.accent}
        xAxisColor={theme.border}
        yAxisColor={theme.border}
        xAxisLabelTextStyle={{ color: theme.textMuted, fontSize: 9 }}
        yAxisTextStyle={{ color: theme.textMuted, fontSize: 9 }}
        rulesColor={theme.border}
        height={120}
      />
    </Card>
  );
}

export default function ExpenseStats() {
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
    // sections array is recomputed each render but key-stable; safe to depend on its identity here
    // because useFocusEffect already gates us to focus events.
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
  container: {
    padding: 16,
    gap: 12,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalNumber: {
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  subTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 6,
  },
  noData: {
    paddingVertical: 12,
    textAlign: 'center',
  },
  donutWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  legend: {
    flex: 1,
    gap: 4,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
});
