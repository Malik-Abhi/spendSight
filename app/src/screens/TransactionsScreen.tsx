import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { useAppStore } from '../store/useAppStore';
import { ExpenseCategory } from '../../../models/expense';
import { getPalette } from '../../../models/palette';
import { createTransaction } from '../services/api';

export function TransactionsScreen() {
  const { token, themeMode, transactions, categories, addTransaction } = useAppStore();
  const palette = useMemo(() => getPalette(themeMode), [themeMode]);
  const selectableCategories = useMemo(() => categories.filter((item) => item !== 'Trade'), [categories]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [person, setPerson] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Food');
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const parsedAmount = Number(amount);
    if (!token || !title.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) return;
    setSaving(true);
    try {
      const transaction = await createTransaction(token, {
        title: title.trim(),
        amount: parsedAmount,
        category: person.trim() ? 'Trade' : category,
        person: person.trim() || undefined,
        kind,
        date: new Date().toISOString().slice(0, 10)
      });
      addTransaction(transaction);
      setTitle('');
      setAmount('');
      setPerson('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: palette.primary }]}>Ledger</Text>
        <Text style={[styles.title, { color: palette.text }]}>Transactions</Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>Add expenses manually or import them from a statement scan.</Text>
      </View>
      <View style={[styles.form, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={styles.formHeader}>
          <View style={[styles.formIcon, { backgroundColor: palette.elevated }]}>
            <Ionicons name="create" size={20} color={palette.primary} />
          </View>
          <View>
            <Text style={[styles.formTitle, { color: palette.text }]}>New expense</Text>
            <Text style={[styles.formHint, { color: palette.muted }]}>Keep the title short and searchable.</Text>
          </View>
        </View>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Expense title"
          placeholderTextColor={palette.muted}
          style={[styles.input, { color: palette.text, borderColor: palette.border }]}
        />
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          placeholder="Amount"
          placeholderTextColor={palette.muted}
          style={[styles.input, { color: palette.text, borderColor: palette.border }]}
        />
        <TextInput
          value={person}
          onChangeText={setPerson}
          placeholder="Person optional, e.g. lent to Rahul"
          placeholderTextColor={palette.muted}
          style={[styles.input, { color: palette.text, borderColor: palette.border }]}
        />
        <View style={[styles.kindSwitch, { backgroundColor: palette.elevated }]}>
          {(['expense', 'income'] as const).map((item) => {
            const active = kind === item;
            return (
              <Pressable
                key={item}
                onPress={() => setKind(item)}
                style={[styles.kindButton, active && { backgroundColor: palette.surface }]}
              >
                <Text style={[styles.kindText, { color: active ? palette.text : palette.muted }]}>{item === 'expense' ? 'Expense' : 'Income'}</Text>
              </Pressable>
            );
          })}
        </View>
        {person.trim() ? (
          <View style={[styles.tradeHint, { backgroundColor: palette.elevated }]}>
            <Ionicons name="people" size={16} color={palette.primary} />
            <Text style={[styles.tradeHintText, { color: palette.muted }]}>Person selected. This will be saved in your trade book.</Text>
          </View>
        ) : (
          <View style={styles.categoryWrap}>
            {selectableCategories.map((item) => {
              const active = item === category;
              return (
                <Pressable
                  key={item}
                  onPress={() => setCategory(item)}
                  style={[
                    styles.categoryButton,
                    { borderColor: active ? palette.primary : palette.border, backgroundColor: active ? palette.elevated : 'transparent' }
                  ]}
                >
                  <Text style={[styles.categoryButtonText, { color: active ? palette.primary : palette.muted }]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        <Pressable style={[styles.addButton, { backgroundColor: palette.primary, opacity: saving ? 0.7 : 1 }]} onPress={submit} disabled={saving}>
          <Ionicons name="add" size={22} color={palette.primaryText} />
          <Text style={styles.addButtonText}>{saving ? 'Saving' : 'Add expense'}</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Recent activity</Text>
        <Text style={[styles.sectionMeta, { color: palette.muted }]}>{transactions.length} total</Text>
      </View>

      {transactions.length ? (
        <View style={styles.list}>
          {transactions.map((transaction) => (
            <View key={transaction.id} style={[styles.row, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <View style={[styles.rowIcon, { backgroundColor: palette.elevated }]}>
                <Ionicons name={transaction.source === 'statement' ? 'document-text' : 'card'} size={20} color={palette.primary} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>
                  {transaction.title}
                </Text>
                <Text style={[styles.rowMeta, { color: palette.muted }]}>
                  {transaction.kind === 'income' ? 'Income' : 'Expense'} · {transaction.category}
                  {transaction.person ? ` · ${transaction.person}` : ''} · {transaction.date}
                </Text>
              </View>
              <Text style={[styles.rowAmount, { color: palette.text }]}>₹{transaction.amount.toLocaleString('en-IN')}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={[styles.emptyState, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Ionicons name="receipt" size={32} color={palette.primary} />
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No transactions yet</Text>
          <Text style={[styles.emptyCopy, { color: palette.muted }]}>Add your first expense above to build your spending history.</Text>
          </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 16
  },
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
    marginTop: 6
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6
  },
  form: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 15,
    gap: 12,
    marginBottom: 22
  },
  formHeader: {
    flexDirection: 'row',
    gap: 11,
    alignItems: 'center'
  },
  formIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  formTitle: {
    fontSize: 17,
    fontWeight: '900'
  },
  formHint: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2
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
  categoryButton: {
    height: 34,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  categoryButtonText: {
    fontSize: 12,
    fontWeight: '800'
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
  addButton: {
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6
  },
  addButtonText: {
    color: '#042F2E',
    fontWeight: '900',
    fontSize: 15
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '900'
  },
  sectionMeta: {
    fontSize: 12,
    fontWeight: '800'
  },
  list: {
    gap: 10
  },
  row: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rowText: {
    flex: 1,
    minWidth: 0
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '900'
  },
  rowMeta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700'
  },
  rowAmount: {
    fontSize: 15,
    fontWeight: '900'
  },
  emptyState: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 22,
    alignItems: 'center'
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 10
  },
  emptyCopy: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 6
  }
});
