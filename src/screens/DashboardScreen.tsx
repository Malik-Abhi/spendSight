import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { PieChart } from '../components/PieChart';
import { useAppStore } from '../store/useAppStore';
import { getPalette } from '../theme/palette';
import { categoryColors } from '../theme/palette';
import { CategoryTotal, Transaction } from '../types/expense';
import { updateTransaction as saveTransactionUpdate } from '../services/api';

function getMonthKey(date: string) {
  return date.slice(0, 7);
}

function getMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function getCategoryTotalsForTransactions(transactions: Transaction[], categories: string[]) {
  const allCategories = Array.from(new Set([...categories, ...transactions.map((transaction) => transaction.category)]));
  const totals = transactions.reduce<Record<string, number>>((acc, transaction) => {
    acc[transaction.category] = acc[transaction.category] ?? 0;
    acc[transaction.category] += transaction.amount;
    return acc;
  }, Object.fromEntries(allCategories.map((category) => [category, 0])) as Record<string, number>);

  return allCategories
    .map<CategoryTotal>((category) => ({
      category,
      total: totals[category],
      color: categoryColors[category] ?? categoryColors.Other
    }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);
}

export function DashboardScreen() {
  const { user, token, themeMode, categories, transactions, updateTransaction } = useAppStore();
  const palette = useMemo(() => getPalette(themeMode), [themeMode]);
  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const monthOptions = useMemo(() => {
    const transactionMonths = transactions.map((transaction) => getMonthKey(transaction.date)).filter(Boolean);
    return Array.from(new Set([currentMonth, ...transactionMonths])).sort((a, b) => b.localeCompare(a));
  }, [currentMonth, transactions]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [summaryKind, setSummaryKind] = useState<'expense' | 'income'>('expense');
  const filteredTransactions = useMemo(
    () => transactions.filter((transaction) => getMonthKey(transaction.date) === selectedMonth),
    [selectedMonth, transactions]
  );
  const chartTransactions = useMemo(
    () => filteredTransactions.filter((transaction) => transaction.kind === summaryKind),
    [filteredTransactions, summaryKind]
  );
  const categoryTotals = useMemo(
    () => getCategoryTotalsForTransactions(chartTransactions, categories),
    [categories, chartTransactions]
  );
  const knownCategories = useMemo(
    () => Array.from(new Set([...categories, ...transactions.map((transaction) => transaction.category).filter(Boolean)])).filter((category) => category !== 'Trade'),
    [categories, transactions]
  );
  const monthlyTotal = chartTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const topCategory = categoryTotals[0];
  const hasTransactions = chartTransactions.length > 0;
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editDraft, setEditDraft] = useState({ title: '', amount: '', category: '', date: '', person: '', kind: 'expense' as 'expense' | 'income' });
  const [savingEdit, setSavingEdit] = useState(false);
  const selectedCategoryTotal = categoryTotals.find((item) => item.category === selectedCategory);
  const selectedCategoryTransactions = chartTransactions.filter((transaction) => transaction.category === selectedCategory);
  const totalExpense = filteredTransactions
    .filter((transaction) => transaction.kind === 'expense')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalIncome = filteredTransactions
    .filter((transaction) => transaction.kind === 'income')
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const openEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setEditDraft({
      title: transaction.title,
      amount: String(transaction.amount),
      category: transaction.category,
      date: transaction.date,
      person: transaction.person ?? '',
      kind: transaction.kind
    });
  };

  const saveEdit = async () => {
    if (!token || !editingTransaction) return;
    const amount = Number(editDraft.amount);
    if (!editDraft.title.trim() || Number.isNaN(amount) || amount <= 0 || !editDraft.category.trim() || !editDraft.date.trim()) return;
    setSavingEdit(true);
    try {
      const updated = await saveTransactionUpdate(token, editingTransaction.id, {
        title: editDraft.title.trim(),
        amount,
        category: editDraft.person.trim() ? 'Trade' : editDraft.category.trim(),
        date: editDraft.date.trim(),
        person: editDraft.person.trim() || undefined,
        kind: editDraft.kind
      });
      updateTransaction(updated);
      setEditingTransaction(null);
      setSelectedCategory(updated.category);
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.eyebrow, { color: palette.primary }]}>Monthly overview</Text>
          <Text style={[styles.title, { color: palette.text }]}>Hi {user?.name?.split(' ')[0] ?? 'there'}</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>Your spending summary updates as you add expenses.</Text>
        </View>
        <View style={[styles.avatar, { backgroundColor: palette.elevated, borderColor: palette.border }]}>
          <Ionicons name="wallet" size={22} color={palette.primary} />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthSelector}>
        {monthOptions.map((month) => {
          const active = selectedMonth === month;
          return (
            <Pressable
              key={month}
              onPress={() => setSelectedMonth(month)}
              style={[
                styles.monthChip,
                { borderColor: active ? palette.primary : palette.border, backgroundColor: active ? palette.primary : palette.surface }
              ]}
            >
              <Text style={[styles.monthChipText, { color: active ? palette.primaryText : palette.text }]}>{getMonthLabel(month)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={[styles.summarySwitch, { backgroundColor: palette.elevated }]}>
          {(['expense', 'income'] as const).map((kind) => {
            const active = summaryKind === kind;
            return (
              <Pressable
                key={kind}
                onPress={() => {
                  setSummaryKind(kind);
                  setSelectedCategory(null);
                }}
                style={[styles.summarySwitchButton, active && { backgroundColor: palette.surface }]}
              >
                <Text style={[styles.summarySwitchText, { color: active ? palette.text : palette.muted }]}>
                  {kind === 'expense' ? 'Expenditure' : 'Income'}
                </Text>
                <Text style={[styles.summarySwitchAmount, { color: active ? palette.primary : palette.muted }]} numberOfLines={1}>
                  ₹{(kind === 'expense' ? totalExpense : totalIncome).toLocaleString('en-IN')}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.panelTop}>
          <View style={styles.panelAmountBox}>
            <Text style={[styles.panelLabel, { color: palette.muted }]}>{summaryKind === 'expense' ? 'Total expenditure' : 'Total income'}</Text>
            <Text style={[styles.panelAmount, { color: palette.text }]} numberOfLines={1} adjustsFontSizeToFit>
              ₹{monthlyTotal.toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: palette.elevated }]}>
            <Ionicons name={hasTransactions ? 'trending-up' : 'sparkles'} size={15} color={palette.primary} />
            <Text style={[styles.statusText, { color: palette.primary }]}>{hasTransactions ? 'Live' : 'Ready'}</Text>
          </View>
        </View>
        <PieChart data={categoryTotals} total={monthlyTotal} textColor={palette.text} mutedColor={palette.muted} />
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: palette.subtle }]}>
            <Text style={[styles.statLabel, { color: palette.muted }]}>Transactions</Text>
            <Text style={[styles.statValue, { color: palette.text }]}>{chartTransactions.length}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: palette.subtle }]}>
            <Text style={[styles.statLabel, { color: palette.muted }]}>Top category</Text>
            <Text style={[styles.statValue, { color: palette.text }]}>{topCategory?.category ?? 'None'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>{summaryKind === 'expense' ? 'Expenditure breakdown' : 'Income breakdown'}</Text>
        <Text style={[styles.sectionMeta, { color: palette.muted }]}>{categoryTotals.length} categories</Text>
      </View>

      {hasTransactions ? (
        <View style={styles.breakdown}>
          {categoryTotals.map((item) => {
            const percent = monthlyTotal > 0 ? Math.round((item.total / monthlyTotal) * 100) : 0;
            return (
              <Pressable
                key={item.category}
                style={[styles.categoryRow, { backgroundColor: palette.surface, borderColor: palette.border }]}
                onPress={() => setSelectedCategory(item.category)}
              >
                <View style={[styles.dot, { backgroundColor: item.color }]} />
                <View style={styles.categoryText}>
                  <Text style={[styles.categoryName, { color: palette.text }]}>{item.category}</Text>
                  <View style={[styles.track, { backgroundColor: palette.elevated }]}>
                    <View style={[styles.fill, { width: `${percent}%`, backgroundColor: item.color }]} />
                  </View>
                </View>
                <View style={styles.amountBox}>
                  <Text style={[styles.amount, { color: palette.text }]}>₹{item.total.toLocaleString('en-IN')}</Text>
                  <Text style={[styles.percent, { color: palette.muted }]}>{percent}%</Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={palette.muted} />
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={[styles.emptyState, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={[styles.emptyIcon, { backgroundColor: palette.elevated }]}>
            <Ionicons name="add-circle" size={25} color={palette.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No {summaryKind === 'expense' ? 'expenditure' : 'income'} yet</Text>
          <Text style={[styles.emptyCopy, { color: palette.muted }]}>
            No {summaryKind === 'expense' ? 'expense' : 'income'} records found for {getMonthLabel(selectedMonth)}. Add one or choose another month.
          </Text>
        </View>
      )}
      <Modal visible={Boolean(selectedCategory)} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedCategory(null)}>
        <View style={[styles.modal, { backgroundColor: palette.background }]}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleBox}>
              <Text style={[styles.eyebrow, { color: selectedCategoryTotal?.color ?? palette.primary }]}>{getMonthLabel(selectedMonth)}</Text>
              <Text style={[styles.modalTitle, { color: palette.text }]}>{selectedCategory ?? 'Category'}</Text>
              <Text style={[styles.modalSubtitle, { color: palette.muted }]}>
                ₹{(selectedCategoryTotal?.total ?? 0).toLocaleString('en-IN')} across {selectedCategoryTransactions.length} records
              </Text>
            </View>
            <Pressable style={[styles.closeButton, { backgroundColor: palette.elevated }]} onPress={() => setSelectedCategory(null)}>
              <Ionicons name="close" size={22} color={palette.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.detailList} showsVerticalScrollIndicator={false}>
            {selectedCategoryTransactions.map((transaction) => (
              <View key={transaction.id} style={[styles.detailCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <View style={styles.detailTop}>
                  <View style={styles.detailText}>
                    <Text style={[styles.detailTitle, { color: palette.text }]} numberOfLines={2}>
                      {transaction.title}
                    </Text>
                    <Text style={[styles.detailMeta, { color: palette.muted }]}>
                      {transaction.kind === 'income' ? 'Income' : 'Expense'}
                      {transaction.person ? ` · ${transaction.person}` : ''} · {transaction.date}
                    </Text>
                  </View>
                  <Text style={[styles.detailAmount, { color: palette.text }]}>₹{transaction.amount.toLocaleString('en-IN')}</Text>
                </View>
                <Pressable style={[styles.editButton, { borderColor: palette.border }]} onPress={() => openEdit(transaction)}>
                  <Ionicons name="create" size={17} color={palette.primary} />
                  <Text style={[styles.editText, { color: palette.primary }]}>Edit</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={Boolean(editingTransaction)} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditingTransaction(null)}>
        <View style={[styles.modal, { backgroundColor: palette.background }]}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={[styles.eyebrow, { color: palette.primary }]}>Edit record</Text>
              <Text style={[styles.modalTitle, { color: palette.text }]}>Transaction details</Text>
            </View>
            <Pressable style={[styles.closeButton, { backgroundColor: palette.elevated }]} onPress={() => setEditingTransaction(null)}>
              <Ionicons name="close" size={22} color={palette.text} />
            </Pressable>
          </View>

          <View style={[styles.editForm, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <TextInput value={editDraft.title} onChangeText={(title) => setEditDraft((draft) => ({ ...draft, title }))} placeholder="Title" placeholderTextColor={palette.muted} style={[styles.input, { color: palette.text, borderColor: palette.border }]} />
            <View style={styles.editGrid}>
              <TextInput value={editDraft.amount} onChangeText={(amount) => setEditDraft((draft) => ({ ...draft, amount }))} keyboardType="numeric" placeholder="Amount" placeholderTextColor={palette.muted} style={[styles.input, styles.gridInput, { color: palette.text, borderColor: palette.border }]} />
              <TextInput value={editDraft.date} onChangeText={(date) => setEditDraft((draft) => ({ ...draft, date }))} placeholder="YYYY-MM-DD" placeholderTextColor={palette.muted} style={[styles.input, styles.gridInput, { color: palette.text, borderColor: palette.border }]} />
            </View>
            <TextInput value={editDraft.person} onChangeText={(person) => setEditDraft((draft) => ({ ...draft, person }))} placeholder="Person optional" placeholderTextColor={palette.muted} style={[styles.input, { color: palette.text, borderColor: palette.border }]} />
            {!editDraft.person.trim() ? (
              <TextInput value={editDraft.category} onChangeText={(category) => setEditDraft((draft) => ({ ...draft, category }))} placeholder="Category" placeholderTextColor={palette.muted} style={[styles.input, { color: palette.text, borderColor: palette.border }]} />
            ) : null}
            <View style={[styles.kindSwitch, { backgroundColor: palette.elevated }]}>
              {(['expense', 'income'] as const).map((kind) => {
                const active = editDraft.kind === kind;
                return (
                  <Pressable key={kind} onPress={() => setEditDraft((draft) => ({ ...draft, kind }))} style={[styles.kindButton, active && { backgroundColor: palette.surface }]}>
                    <Text style={[styles.kindText, { color: active ? palette.text : palette.muted }]}>{kind === 'expense' ? 'Expense' : 'Income'}</Text>
                  </Pressable>
                );
              })}
            </View>
            {editDraft.person.trim() ? (
              <View style={[styles.tradeHint, { backgroundColor: palette.elevated }]}>
                <Ionicons name="people" size={16} color={palette.primary} />
                <Text style={[styles.tradeHintText, { color: palette.muted }]}>Person selected. This record will stay in your trade book.</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChips}>
                {knownCategories.map((category) => (
                  <Pressable key={category} onPress={() => setEditDraft((draft) => ({ ...draft, category }))} style={[styles.categoryChip, { borderColor: editDraft.category === category ? palette.primary : palette.border, backgroundColor: editDraft.category === category ? palette.elevated : 'transparent' }]}>
                    <Text style={[styles.categoryChipText, { color: editDraft.category === category ? palette.primary : palette.muted }]}>{category}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <Pressable style={[styles.saveButton, { backgroundColor: palette.primary, opacity: savingEdit ? 0.7 : 1 }]} onPress={saveEdit} disabled={savingEdit}>
              <Text style={styles.saveText}>{savingEdit ? 'Saving' : 'Save changes'}</Text>
              <Ionicons name="checkmark" size={20} color={palette.primaryText} />
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 18
  },
  headerText: {
    flex: 1,
    minWidth: 0
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    marginTop: 7
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  monthSelector: {
    gap: 8,
    paddingBottom: 14
  },
  monthChip: {
    height: 38,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center'
  },
  monthChipText: {
    fontSize: 13,
    fontWeight: '900'
  },
  panel: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5
  },
  summarySwitch: {
    minHeight: 58,
    borderRadius: 8,
    padding: 4,
    flexDirection: 'row',
    gap: 4,
    marginBottom: 16
  },
  summarySwitchButton: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8
  },
  summarySwitchText: {
    fontSize: 13,
    fontWeight: '900'
  },
  summarySwitchAmount: {
    marginTop: 3,
    maxWidth: '100%',
    fontSize: 12,
    fontWeight: '900'
  },
  panelTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12
  },
  panelAmountBox: {
    flex: 1,
    minWidth: 0
  },
  panelLabel: {
    fontSize: 13,
    fontWeight: '800'
  },
  panelAmount: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
    marginTop: 3
  },
  statusPill: {
    height: 32,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  statusText: {
    fontSize: 12,
    fontWeight: '900'
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10
  },
  statCard: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 74
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '700'
  },
  statValue: {
    marginTop: 4,
    fontSize: 19,
    fontWeight: '900'
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900'
  },
  sectionMeta: {
    fontSize: 12,
    fontWeight: '800'
  },
  breakdown: {
    gap: 10
  },
  categoryRow: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6
  },
  categoryText: {
    flex: 1,
    minWidth: 0
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8
  },
  track: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden'
  },
  fill: {
    height: 7,
    borderRadius: 4
  },
  amountBox: {
    alignItems: 'flex-end',
    minWidth: 78
  },
  amount: {
    fontSize: 14,
    fontWeight: '900'
  },
  percent: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3
  },
  emptyState: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 18,
    alignItems: 'center'
  },
  emptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900'
  },
  emptyCopy: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 6
  },
  modal: {
    flex: 1,
    padding: 20
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 16
  },
  modalTitleBox: {
    flex: 1,
    minWidth: 0
  },
  modalTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    marginTop: 4
  },
  modalSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: 6
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  detailList: {
    gap: 10,
    paddingBottom: 24
  },
  detailCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 13,
    gap: 12
  },
  detailTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10
  },
  detailText: {
    flex: 1,
    minWidth: 0
  },
  detailTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900'
  },
  detailMeta: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 5
  },
  detailAmount: {
    fontSize: 15,
    fontWeight: '900'
  },
  editButton: {
    height: 38,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6
  },
  editText: {
    fontSize: 13,
    fontWeight: '900'
  },
  editForm: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    gap: 11
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '800'
  },
  editGrid: {
    flexDirection: 'row',
    gap: 9
  },
  gridInput: {
    flex: 1
  },
  kindSwitch: {
    height: 42,
    borderRadius: 8,
    padding: 4,
    flexDirection: 'row',
    gap: 4
  },
  kindButton: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  kindText: {
    fontSize: 13,
    fontWeight: '900'
  },
  categoryChips: {
    gap: 8,
    paddingVertical: 2
  },
  tradeHint: {
    minHeight: 42,
    borderRadius: 8,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  tradeHintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800'
  },
  categoryChip: {
    height: 34,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '800'
  },
  saveButton: {
    height: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7
  },
  saveText: {
    color: '#042F2E',
    fontSize: 15,
    fontWeight: '900'
  }
});
