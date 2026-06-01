import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { Screen } from '../components/Screen';
import { useAppStore } from '../store/useAppStore';
import { getPalette } from '../theme/palette';
import { createPerson, deleteAllTransactions, deletePerson, deleteTransaction } from '../services/api';

type TrendPoint = {
  month: string;
  label: string;
  total: number;
};

function getMonthKey(date: string) {
  return date.slice(0, 7);
}

function getMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'short' });
}

function buildTrend(transactions: Array<{ date: string; amount: number; kind: 'expense' | 'income' }>, kind: 'expense' | 'income') {
  const totals = transactions.filter((transaction) => transaction.kind === kind).reduce<Record<string, number>>((acc, transaction) => {
    const month = getMonthKey(transaction.date);
    if (!month) return acc;
    acc[month] = (acc[month] ?? 0) + transaction.amount;
    return acc;
  }, {});

  return Object.keys(totals)
    .sort((a, b) => a.localeCompare(b))
    .slice(-6)
    .map((month) => ({
      month,
      label: getMonthLabel(month),
      total: totals[month]
    }));
}

function ExpenseTrendChart({ data, lineColor, textColor, mutedColor }: { data: TrendPoint[]; lineColor: string; textColor: string; mutedColor: string }) {
  const width = 320;
  const height = 220;
  const paddingLeft = 42;
  const paddingRight = 18;
  const paddingTop = 24;
  const paddingBottom = 42;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const maxTotal = Math.max(...data.map((item) => item.total), 1);
  const xFor = (index: number) => paddingLeft + (data.length === 1 ? chartWidth / 2 : (index / (data.length - 1)) * chartWidth);
  const yFor = (total: number) => paddingTop + chartHeight - (total / maxTotal) * chartHeight;
  const path = data.map((item, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index)} ${yFor(item.total)}`).join(' ');

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <Line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={paddingTop + chartHeight} stroke={mutedColor} strokeWidth="2" />
      <Line x1={paddingLeft} y1={paddingTop + chartHeight} x2={width - paddingRight} y2={paddingTop + chartHeight} stroke={mutedColor} strokeWidth="2" />
      {[0, 0.5, 1].map((ratio) => {
        const y = paddingTop + chartHeight - ratio * chartHeight;
        return (
          <React.Fragment key={ratio}>
            <Line x1={paddingLeft - 4} y1={y} x2={width - paddingRight} y2={y} stroke={mutedColor} strokeWidth="1" opacity={0.25} />
            <SvgText x={paddingLeft - 8} y={y + 4} fill={mutedColor} fontSize="10" textAnchor="end">
              ₹{Math.round(maxTotal * ratio).toLocaleString('en-IN')}
            </SvgText>
          </React.Fragment>
        );
      })}
      {path ? <Path d={path} fill="none" stroke={lineColor} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {data.map((item, index) => (
        <React.Fragment key={item.month}>
          <Circle cx={xFor(index)} cy={yFor(item.total)} r="4" fill={lineColor} />
          <SvgText x={xFor(index)} y={height - 14} fill={textColor} fontSize="11" fontWeight="700" textAnchor="middle">
            {item.label}
          </SvgText>
        </React.Fragment>
      ))}
    </Svg>
  );
}

export function SettingsScreen() {
  const { user, token, themeMode, transactions, people, setPeople, setTransactions, toggleTheme, logout, removeTransaction, clearTransactions } = useAppStore();
  const palette = useMemo(() => getPalette(themeMode), [themeMode]);
  const [manageOpen, setManageOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [trendOpen, setTrendOpen] = useState(false);
  const [trendKind, setTrendKind] = useState<'expense' | 'income'>('expense');
  const [newPerson, setNewPerson] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');
  const trendData = useMemo(() => buildTrend(transactions, trendKind), [transactions, trendKind]);
  const trendTotal = trendData.reduce((sum, item) => sum + item.total, 0);
  const personSummaries = useMemo(() => {
    const merged = new Map<string, string>();
    [...people, ...transactions.map((transaction) => transaction.person).filter(Boolean) as string[]].forEach((name) => {
      const key = name.trim().toLowerCase();
      if (key && !merged.has(key)) merged.set(key, name.trim());
    });

    return Array.from(merged.entries())
      .map(([key, name]) => {
        const related = transactions.filter((transaction) => transaction.person?.trim().toLowerCase() === key);
        const given = related.filter((transaction) => transaction.kind === 'expense').reduce((sum, transaction) => sum + transaction.amount, 0);
        const taken = related.filter((transaction) => transaction.kind === 'income').reduce((sum, transaction) => sum + transaction.amount, 0);
        return { name, given, taken, net: taken - given, records: related.length, saved: people.some((person) => person.toLowerCase() === key) };
      })
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net) || a.name.localeCompare(b.name));
  }, [people, transactions]);

  const handleDeleteOne = async (id: string) => {
    if (!token) return;
    setDeleting(true);
    setMessage('');
    try {
      await deleteTransaction(token, id);
      removeTransaction(id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not delete transaction.');
    } finally {
      setDeleting(false);
    }
  };

  const handleAddPerson = async () => {
    if (!token || !newPerson.trim()) return;
    try {
      const updatedPeople = await createPerson(token, newPerson.trim());
      setPeople(updatedPeople);
      setNewPerson('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add person.');
    }
  };

  const handleRemovePerson = async (name: string) => {
    if (!token) return;
    try {
      const result = await deletePerson(token, name);
      setPeople(result.people);
      setTransactions(result.transactions);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not remove person.');
    }
  };

  const handleDeleteAll = async () => {
    if (!token || !transactions.length) return;
    setDeleting(true);
    setMessage('');
    try {
      await deleteAllTransactions(token);
      clearTransactions();
      setMessage('All records deleted.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not delete records.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Screen>
      <Text style={[styles.kicker, { color: palette.primary }]}>Account</Text>
      <Text style={[styles.title, { color: palette.text }]}>Settings</Text>
      <View style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={[styles.profileIcon, { backgroundColor: palette.elevated }]}>
          <Ionicons name="person" size={24} color={palette.primary} />
        </View>
        <View style={styles.profileText}>
          <Text style={[styles.name, { color: palette.text }]}>{user?.name}</Text>
          <Text style={[styles.email, { color: palette.muted }]}>{user?.email}</Text>
        </View>
      </View>

      <View style={[styles.row, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={styles.iconText}>
          <Ionicons name={themeMode === 'dark' ? 'moon' : 'sunny'} size={22} color={palette.primary} />
          <Text style={[styles.rowTitle, { color: palette.text }]}>Dark theme</Text>
        </View>
        <Switch value={themeMode === 'dark'} onValueChange={toggleTheme} thumbColor={palette.primary} />
      </View>

      <Pressable style={[styles.row, styles.manageRow, { backgroundColor: palette.surface, borderColor: palette.border }]} onPress={() => setTrendOpen(true)}>
        <View style={styles.iconText}>
          <Ionicons name="trending-up" size={22} color={palette.primary} />
          <View>
            <Text style={[styles.rowTitle, { color: palette.text }]}>Income / expense trend</Text>
            <Text style={[styles.rowMeta, { color: palette.muted }]}>Monthly graph for your account</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={palette.muted} />
      </Pressable>

      <Pressable style={[styles.row, styles.manageRow, { backgroundColor: palette.surface, borderColor: palette.border }]} onPress={() => setPeopleOpen(true)}>
        <View style={styles.iconText}>
          <Ionicons name="people" size={22} color={palette.primary} />
          <View>
            <Text style={[styles.rowTitle, { color: palette.text }]}>People & trades</Text>
            <Text style={[styles.rowMeta, { color: palette.muted }]}>{personSummaries.length} people tracked</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={palette.muted} />
      </Pressable>

      <Pressable style={[styles.row, styles.manageRow, { backgroundColor: palette.surface, borderColor: palette.border }]} onPress={() => setManageOpen(true)}>
        <View style={styles.iconText}>
          <Ionicons name="trash" size={22} color={palette.danger} />
          <View>
            <Text style={[styles.rowTitle, { color: palette.text }]}>Manage records</Text>
            <Text style={[styles.rowMeta, { color: palette.muted }]}>{transactions.length} saved transactions</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={palette.muted} />
      </Pressable>

      <Pressable style={[styles.logout, { borderColor: palette.danger }]} onPress={logout}>
        <Ionicons name="log-out" size={21} color={palette.danger} />
        <Text style={[styles.logoutText, { color: palette.danger }]}>Logout</Text>
      </Pressable>

      <Modal visible={trendOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setTrendOpen(false)}>
        <View style={[styles.modal, { backgroundColor: palette.background }]}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={[styles.kicker, { color: palette.primary }]}>Monthly graph</Text>
              <Text style={[styles.modalTitle, { color: palette.text }]}>{trendKind === 'expense' ? 'Expense trend' : 'Income trend'}</Text>
            </View>
            <Pressable style={[styles.closeButton, { backgroundColor: palette.elevated }]} onPress={() => setTrendOpen(false)}>
              <Ionicons name="close" size={22} color={palette.text} />
            </Pressable>
          </View>

          <View style={[styles.trendSwitch, { backgroundColor: palette.elevated }]}>
            {(['expense', 'income'] as const).map((kind) => {
              const active = trendKind === kind;
              return (
                <Pressable key={kind} onPress={() => setTrendKind(kind)} style={[styles.trendSwitchButton, active && { backgroundColor: palette.surface }]}>
                  <Text style={[styles.trendSwitchText, { color: active ? palette.text : palette.muted }]}>{kind === 'expense' ? 'Expenditure' : 'Income'}</Text>
                </Pressable>
              );
            })}
          </View>

          {trendData.length ? (
            <>
              <View style={[styles.trendSummary, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <Text style={[styles.trendLabel, { color: palette.muted }]}>Tracked months</Text>
                <Text style={[styles.trendValue, { color: palette.text }]}>{trendData.length}</Text>
                <Text style={[styles.trendLabel, { color: palette.muted }]}>{trendKind === 'expense' ? 'Total expenditure' : 'Total income'}</Text>
                <Text style={[styles.trendValue, { color: palette.text }]}>₹{trendTotal.toLocaleString('en-IN')}</Text>
              </View>
              <View style={[styles.chartCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <ExpenseTrendChart data={trendData} lineColor={trendKind === 'expense' ? palette.danger : palette.primary} textColor={palette.text} mutedColor={palette.muted} />
              </View>
            </>
          ) : (
            <View style={[styles.emptyRecords, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Ionicons name="analytics" size={30} color={palette.primary} />
              <Text style={[styles.emptyText, { color: palette.text }]}>No {trendKind === 'expense' ? 'expense' : 'income'} data yet</Text>
            </View>
          )}
        </View>
      </Modal>

      <Modal visible={peopleOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPeopleOpen(false)}>
        <View style={[styles.modal, { backgroundColor: palette.background }]}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={[styles.kicker, { color: palette.primary }]}>Trade book</Text>
              <Text style={[styles.modalTitle, { color: palette.text }]}>People</Text>
            </View>
            <Pressable style={[styles.closeButton, { backgroundColor: palette.elevated }]} onPress={() => setPeopleOpen(false)}>
              <Ionicons name="close" size={22} color={palette.text} />
            </Pressable>
          </View>

          <View style={[styles.personInputRow, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <TextInput
              value={newPerson}
              onChangeText={setNewPerson}
              placeholder="Add person name"
              placeholderTextColor={palette.muted}
              style={[styles.personInput, { color: palette.text }]}
              returnKeyType="done"
              onSubmitEditing={handleAddPerson}
            />
            <Pressable style={[styles.personAddButton, { backgroundColor: palette.primary }]} onPress={handleAddPerson}>
              <Ionicons name="add" size={18} color={palette.primaryText} />
              <Text style={styles.personAddText}>Add</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.recordsList} contentContainerStyle={styles.recordsContent} showsVerticalScrollIndicator={false}>
            {personSummaries.length ? (
              personSummaries.map((person) => (
                <View key={person.name} style={[styles.personCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                  <View style={styles.personCardTop}>
                    <View style={styles.recordText}>
                      <Text style={[styles.recordTitle, { color: palette.text }]}>{person.name}</Text>
                      <Text style={[styles.recordMeta, { color: palette.muted }]}>
                        {person.records} records · Net {person.net >= 0 ? 'taken' : 'given'} ₹{Math.abs(person.net).toLocaleString('en-IN')}
                      </Text>
                    </View>
                    <Pressable style={[styles.recordDelete, { borderColor: palette.danger }]} onPress={() => handleRemovePerson(person.name)}>
                      <Ionicons name="person-remove" size={18} color={palette.danger} />
                    </Pressable>
                  </View>
                  <View style={styles.personTotals}>
                    <View style={[styles.personTotalBox, { backgroundColor: palette.subtle }]}>
                      <Text style={[styles.personTotalLabel, { color: palette.muted }]}>Given</Text>
                      <Text style={[styles.personTotalValue, { color: palette.text }]}>₹{person.given.toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={[styles.personTotalBox, { backgroundColor: palette.subtle }]}>
                      <Text style={[styles.personTotalLabel, { color: palette.muted }]}>Taken</Text>
                      <Text style={[styles.personTotalValue, { color: palette.text }]}>₹{person.taken.toLocaleString('en-IN')}</Text>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View style={[styles.emptyRecords, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <Ionicons name="people" size={30} color={palette.primary} />
                <Text style={[styles.emptyText, { color: palette.text }]}>No people tracked yet</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={manageOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setManageOpen(false)}>
        <View style={[styles.modal, { backgroundColor: palette.background }]}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={[styles.kicker, { color: palette.primary }]}>Account data</Text>
              <Text style={[styles.modalTitle, { color: palette.text }]}>Delete records</Text>
            </View>
            <Pressable style={[styles.closeButton, { backgroundColor: palette.elevated }]} onPress={() => setManageOpen(false)}>
              <Ionicons name="close" size={22} color={palette.text} />
            </Pressable>
          </View>

          {message ? <Text style={[styles.message, { color: message.includes('deleted') ? palette.primary : palette.danger }]}>{message}</Text> : null}

          <Pressable
            style={[styles.deleteAll, { backgroundColor: palette.danger, opacity: deleting || !transactions.length ? 0.65 : 1 }]}
            onPress={handleDeleteAll}
            disabled={deleting || !transactions.length}
          >
            <Ionicons name="warning" size={20} color="#FFFFFF" />
            <Text style={styles.deleteAllText}>Delete all records</Text>
          </Pressable>

          <ScrollView style={styles.recordsList} contentContainerStyle={styles.recordsContent} showsVerticalScrollIndicator={false}>
            {transactions.length ? (
              transactions.map((transaction) => (
                <View key={transaction.id} style={[styles.recordRow, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                  <View style={styles.recordText}>
                    <Text style={[styles.recordTitle, { color: palette.text }]} numberOfLines={1}>
                      {transaction.title}
                    </Text>
                    <Text style={[styles.recordMeta, { color: palette.muted }]}>
                      {transaction.kind === 'income' ? 'Income' : 'Expense'} · {transaction.category}
                      {transaction.person ? ` · ${transaction.person}` : ''} · {transaction.date} · ₹{transaction.amount.toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <Pressable
                    style={[styles.recordDelete, { borderColor: palette.danger, opacity: deleting ? 0.6 : 1 }]}
                    onPress={() => handleDeleteOne(transaction.id)}
                    disabled={deleting}
                  >
                    <Ionicons name="trash" size={18} color={palette.danger} />
                  </Pressable>
                </View>
              ))
            ) : (
              <View style={[styles.emptyRecords, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <Ionicons name="checkmark-circle" size={28} color={palette.primary} />
                <Text style={[styles.emptyText, { color: palette.text }]}>No records to delete</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
    marginTop: 6,
    marginBottom: 16
  },
  panel: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  profileIcon: {
    width: 52,
    height: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  profileText: {
    flex: 1,
    minWidth: 0
  },
  name: {
    fontSize: 21,
    fontWeight: '900'
  },
  email: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 5
  },
  row: {
    height: 64,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  manageRow: {
    marginTop: 12
  },
  iconText: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '900'
  },
  rowMeta: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3
  },
  logout: {
    height: 54,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '900'
  },
  modal: {
    flex: 1,
    padding: 20
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  modalTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    marginTop: 6
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    marginBottom: 10
  },
  deleteAll: {
    height: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12
  },
  deleteAllText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900'
  },
  trendSwitch: {
    height: 44,
    borderRadius: 8,
    padding: 4,
    flexDirection: 'row',
    gap: 4,
    marginBottom: 12
  },
  trendSwitchButton: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  trendSwitchText: {
    fontSize: 13,
    fontWeight: '900'
  },
  trendSummary: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12
  },
  trendLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  trendValue: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    marginTop: 4,
    marginBottom: 10
  },
  chartCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12
  },
  personInputRow: {
    height: 52,
    borderWidth: 1,
    borderRadius: 8,
    paddingLeft: 14,
    paddingRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12
  },
  personInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800'
  },
  personAddButton: {
    height: 40,
    minWidth: 78,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10
  },
  personAddText: {
    color: '#042F2E',
    fontSize: 13,
    fontWeight: '900'
  },
  personCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 12
  },
  personCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  personTotals: {
    flexDirection: 'row',
    gap: 10
  },
  personTotalBox: {
    flex: 1,
    borderRadius: 8,
    padding: 11
  },
  personTotalLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  personTotalValue: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4
  },
  recordsList: {
    flex: 1
  },
  recordsContent: {
    gap: 10,
    paddingBottom: 20
  },
  recordRow: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  recordText: {
    flex: 1,
    minWidth: 0
  },
  recordTitle: {
    fontSize: 15,
    fontWeight: '900'
  },
  recordMeta: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4
  },
  recordDelete: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyRecords: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 22,
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 8
  }
});
