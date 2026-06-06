import { useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { useAppStore } from '../store/useAppStore';
import { getPalette } from '../../../models/palette';
import { importStatementTransactions, uploadStatementFile } from '../services/api';
import { ParsedStatementTransaction, Transaction } from '../../../models/expense';

type ReviewTransaction = ParsedStatementTransaction & {
  reviewId: string;
};

export function StatementScreen() {
  const { token, themeMode, categories, people, statementImageUri, setStatementImageUri, addTransactions, addCategory } = useAppStore();
  const transactions = useAppStore((state) => state.transactions);
  const palette = useMemo(() => getPalette(themeMode), [themeMode]);
  const { height } = useWindowDimensions();
  const previewHeight = Math.min(340, Math.max(240, height * 0.36));
  const knownCategories = useMemo(
    () => Array.from(new Set([...categories, ...transactions.map((transaction) => transaction.category).filter(Boolean)])).filter((category) => category !== 'Trade'),
    [categories, transactions]
  );
  const knownPeople = useMemo(
    () => Array.from(new Set([...people, ...transactions.map((transaction) => transaction.person).filter(Boolean) as string[]])).sort((a, b) => a.localeCompare(b)),
    [people, transactions]
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('Upload a bank statement image and let Gemini suggest categories.');
  const [statementFileType, setStatementFileType] = useState<'image' | 'pdf' | null>(null);
  const [statementFileName, setStatementFileName] = useState('statement.jpg');
  const [statementMimeType, setStatementMimeType] = useState('image/jpeg');
  const [reviewItems, setReviewItems] = useState<ReviewTransaction[]>([]);
  const [newCategory, setNewCategory] = useState('');

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9
    });

    if (!result.canceled) {
      setStatementImageUri(result.assets[0].uri);
      setStatementFileType('image');
      setStatementFileName(result.assets[0].fileName || 'statement.jpg');
      setStatementMimeType(result.assets[0].mimeType || 'image/jpeg');
      setMessage('Image selected. Analyze it when your API server is running.');
    }
  };

  const pickPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true
    });

    if (!result.canceled) {
      setStatementImageUri(result.assets[0].uri);
      setStatementFileType('pdf');
      setStatementFileName(result.assets[0].name || 'statement.pdf');
      setStatementMimeType(result.assets[0].mimeType || 'application/pdf');
      setMessage(`${result.assets[0].name} selected. Analyze it when your API server is running.`);
    }
  };

  const analyzeImage = async () => {
    if (!token || !statementImageUri) return;
    setLoading(true);
    try {
      const parsedTransactions = await uploadStatementFile(statementImageUri, {
        mimeType: statementMimeType,
        name: statementFileName,
        categories: knownCategories,
        titleCategoryHints: transactions.slice(0, 80).map((transaction) => ({
          title: transaction.title,
          category: transaction.person ? 'Other' : transaction.category
        }))
      });
      setReviewItems(
        parsedTransactions.map((transaction, index) => ({
          ...transaction,
          reviewId: `${Date.now()}-${index}`,
          kind: transaction.kind ?? 'expense',
          category: transaction.person ? '' : knownCategories.includes(transaction.category) ? transaction.category : 'Other',
          needsCategoryReview:
            !transaction.person && (transaction.needsCategoryReview || !knownCategories.includes(transaction.category) || transaction.category === 'Other')
        })).sort((a, b) => Number(b.needsCategoryReview) - Number(a.needsCategoryReview))
      );
      setMessage(`${parsedTransactions.length} transactions found. Review before adding.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Statement analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  const updateReviewItem = (reviewId: string, patch: Partial<ReviewTransaction>) => {
    setReviewItems((items) => items.map((item) => (item.reviewId === reviewId ? { ...item, ...patch } : item)));
  };

  const titleKey = (title: string) => title.trim().toLowerCase().replace(/\s+/g, ' ');

  const counterpartyKey = (title: string) => {
    const cleaned = title
      .toLowerCase()
      .replace(/\b(upi|imps|neft|rtgs|paytm|gpay|phonepe|sent|using|to|from)\b/g, ' ')
      .replace(/[^a-z/ ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const slashName = cleaned
      .split('/')
      .map((part) => part.trim())
      .find((part) => part.split(/\s+/).filter(Boolean).length >= 2);

    return slashName || cleaned;
  };

  const applyCategoryToMatchingTitles = (reviewId: string, category: string) => {
    setReviewItems((items) => {
      const target = items.find((item) => item.reviewId === reviewId);
      if (!target) return items;
      const targetKey = titleKey(target.title);
      return items.map((item) =>
        titleKey(item.title) === targetKey && !item.person?.trim()
          ? { ...item, category, needsCategoryReview: false, categoryConfidence: 1 }
          : item
      );
    });
  };

  const updateReviewPerson = (reviewId: string, person: string) => {
    setReviewItems((items) =>
      {
        const target = items.find((item) => item.reviewId === reviewId);
        if (!target) return items;
        const targetCounterparty = counterpartyKey(target.title);
        const targetTitle = titleKey(target.title);
        const shouldApplyTo = (item: ReviewTransaction) => {
          const itemCounterparty = counterpartyKey(item.title);
          return targetCounterparty
            ? itemCounterparty === targetCounterparty
            : titleKey(item.title) === targetTitle;
        };

        return items.map((item) =>
          shouldApplyTo(item)
          ? {
              ...item,
              person,
              category: person.trim() ? '' : item.category || 'Other',
              needsCategoryReview: person.trim() ? false : item.needsCategoryReview
            }
          : item
        );
      }
    );
  };

  const removeReviewItem = (reviewId: string) => {
    setReviewItems((items) => items.filter((item) => item.reviewId !== reviewId));
  };

  const handleAddCategory = () => {
    const normalized = newCategory.trim();
    if (!normalized) return;
    addCategory(normalized);
    setNewCategory('');
  };

  const saveReviewedItems = async () => {
    if (!token || !reviewItems.length) return;
    const unresolved = reviewItems.some((transaction) => !transaction.person?.trim() && (!transaction.category?.trim() || transaction.needsCategoryReview));
    if (unresolved) {
      setMessage('Choose a category for every non-person record before adding.');
      return;
    }

    setSaving(true);
    try {
      const cleaned = reviewItems
        .map(({ reviewId: _reviewId, categoryConfidence: _categoryConfidence, needsCategoryReview: _needsCategoryReview, ...transaction }) => ({
          ...transaction,
          title: transaction.title.trim(),
          amount: Number(transaction.amount),
          date: transaction.date.trim(),
          category: transaction.person?.trim() ? 'Trade' : transaction.category.trim() || 'Other',
          person: transaction.person?.trim() || undefined,
          kind: (transaction.kind === 'income' ? 'income' : 'expense') as 'expense' | 'income',
          source: 'statement' as const
        }))
        .filter((transaction) => transaction.title && transaction.amount > 0 && transaction.date);
      const savedTransactions = await importStatementTransactions(token, cleaned);
      addTransactions(savedTransactions);
      setReviewItems([]);
      setMessage(`${savedTransactions.length} transactions added.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add reviewed transactions.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen contentContainerStyle={styles.screenContent}>
      <Text style={[styles.kicker, { color: palette.primary }]}>Smart import</Text>
      <Text style={[styles.title, { color: palette.text }]}>Statement AI</Text>
      <Text style={[styles.copy, { color: palette.muted }]}>{message}</Text>
      <View style={[styles.dropzone, { height: previewHeight, backgroundColor: palette.surface, borderColor: palette.border }]}>
        {statementImageUri && statementFileType === 'image' ? (
          <Image source={{ uri: statementImageUri }} style={styles.preview} resizeMode="contain" />
        ) : statementImageUri && statementFileType === 'pdf' ? (
          <View style={styles.emptyDropzone}>
            <View style={[styles.scanIcon, { backgroundColor: palette.elevated }]}>
              <Ionicons name="document" size={32} color={palette.primary} />
            </View>
            <Text style={[styles.dropTitle, { color: palette.text }]}>PDF selected</Text>
            <Text style={[styles.dropCopy, { color: palette.muted }]}>Analyze this bank statement PDF with Gemini.</Text>
          </View>
        ) : (
          <View style={styles.emptyDropzone}>
            <View style={[styles.scanIcon, { backgroundColor: palette.elevated }]}>
              <Ionicons name="document-text" size={32} color={palette.primary} />
            </View>
            <Text style={[styles.dropTitle, { color: palette.text }]}>Upload statement image</Text>
            <Text style={[styles.dropCopy, { color: palette.muted }]}>Gemini will extract visible transactions and categories.</Text>
          </View>
        )}
      </View>
      <View style={styles.actions}>
        <Pressable style={[styles.secondary, { borderColor: palette.border, backgroundColor: palette.surface }]} onPress={pickImage}>
          <Ionicons name="cloud-upload" size={21} color={palette.primary} />
          <Text style={[styles.secondaryText, { color: palette.text }]}>Image</Text>
        </Pressable>
        <Pressable style={[styles.secondary, { borderColor: palette.border, backgroundColor: palette.surface }]} onPress={pickPdf}>
          <Ionicons name="document" size={21} color={palette.primary} />
          <Text style={[styles.secondaryText, { color: palette.text }]}>PDF</Text>
        </Pressable>
        <Pressable style={[styles.primary, { backgroundColor: palette.primary, opacity: statementImageUri ? 1 : 0.55 }]} onPress={analyzeImage}>
          <Ionicons name="sparkles" size={21} color={palette.primaryText} />
          <Text style={styles.primaryText}>{loading ? 'Analyzing' : 'Analyze'}</Text>
        </Pressable>
      </View>
      <Modal visible={reviewItems.length > 0} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setReviewItems([])}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.modal, { backgroundColor: palette.background }]}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={[styles.modalKicker, { color: palette.primary }]}>Review import</Text>
              <Text style={[styles.modalTitle, { color: palette.text }]}>{reviewItems.length} transactions</Text>
            </View>
            <Pressable style={[styles.iconButton, { backgroundColor: palette.elevated }]} onPress={() => setReviewItems([])}>
              <Ionicons name="close" size={22} color={palette.text} />
            </Pressable>
          </View>

          <View style={[styles.newCategory, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <TextInput
              value={newCategory}
              onChangeText={setNewCategory}
              placeholder="New category name"
              placeholderTextColor={palette.muted}
              style={[styles.categoryInput, { color: palette.text }]}
              returnKeyType="done"
              onSubmitEditing={handleAddCategory}
            />
            <Pressable style={[styles.addCategoryButton, { backgroundColor: palette.primary }]} onPress={handleAddCategory}>
              <Ionicons name="add" size={18} color={palette.primaryText} />
              <Text style={styles.addCategoryText}>Add</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.reviewList}
            contentContainerStyle={styles.reviewContent}
            automaticallyAdjustKeyboardInsets
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {reviewItems.map((item) => (
              <View key={item.reviewId} style={[styles.reviewCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <View style={styles.reviewCardHeader}>
                  <TextInput
                    value={item.title}
                    onChangeText={(title) => updateReviewItem(item.reviewId, { title })}
                    placeholder="Transaction name"
                    placeholderTextColor={palette.muted}
                    style={[styles.reviewTitleInput, { color: palette.text }]}
                  />
                  <Pressable onPress={() => removeReviewItem(item.reviewId)}>
                    <Ionicons name="trash" size={19} color={palette.danger} />
                  </Pressable>
                </View>

                {item.needsCategoryReview ? (
                  <View style={[styles.reviewWarning, { backgroundColor: palette.elevated }]}>
                    <Ionicons name="alert-circle" size={15} color={palette.warning} />
                    <Text style={[styles.reviewWarningText, { color: palette.warning }]}>Choose a category, or add a person below</Text>
                  </View>
                ) : null}

                <View style={styles.reviewGrid}>
                  <TextInput
                    value={String(item.amount)}
                    onChangeText={(amount) => updateReviewItem(item.reviewId, { amount: Number(amount) || 0 })}
                    keyboardType="numeric"
                    placeholder="Amount"
                    placeholderTextColor={palette.muted}
                    style={[styles.reviewInput, { color: palette.text, borderColor: palette.border }]}
                  />
                  <TextInput
                    value={item.date}
                    onChangeText={(date) => updateReviewItem(item.reviewId, { date })}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={palette.muted}
                    style={[styles.reviewInput, { color: palette.text, borderColor: palette.border }]}
                  />
                </View>
                <TextInput
                  value={item.person ?? ''}
                  onChangeText={(person) => updateReviewPerson(item.reviewId, person)}
                  placeholder="Person optional, e.g. Rahul"
                  placeholderTextColor={palette.muted}
                  style={[styles.reviewInput, styles.fullReviewInput, { color: palette.text, borderColor: palette.border }]}
                />
                {knownPeople.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChips}>
                    {knownPeople.map((person) => {
                      const active = item.person?.trim().toLowerCase() === person.toLowerCase();
                      return (
                        <Pressable
                          key={person}
                          onPress={() => updateReviewPerson(item.reviewId, active ? '' : person)}
                          style={[
                            styles.reviewChip,
                            { borderColor: active ? palette.primary : palette.border, backgroundColor: active ? palette.elevated : 'transparent' }
                          ]}
                        >
                          <Text style={[styles.reviewChipText, { color: active ? palette.primary : palette.muted }]}>{person}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                ) : null}

                <View style={[styles.kindSwitch, { backgroundColor: palette.elevated }]}>
                  {(['expense', 'income'] as const).map((kind) => {
                    const active = item.kind === kind;
                    return (
                      <Pressable
                        key={kind}
                        onPress={() => updateReviewItem(item.reviewId, { kind })}
                        style={[styles.kindButton, active && { backgroundColor: palette.surface }]}
                      >
                        <Text style={[styles.kindText, { color: active ? palette.text : palette.muted }]}>{kind === 'expense' ? 'Expense' : 'Income'}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {item.person?.trim() ? (
                  <View style={[styles.reviewInfo, { backgroundColor: palette.elevated }]}>
                    <Ionicons name="people" size={15} color={palette.primary} />
                    <Text style={[styles.reviewInfoText, { color: palette.muted }]}>Person selected. This record will go to the trade book.</Text>
                  </View>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChips}>
                    {knownCategories.map((category) => {
                      const active = item.category === category;
                      return (
                        <Pressable
                          key={category}
                          onPress={() => applyCategoryToMatchingTitles(item.reviewId, category)}
                          style={[
                            styles.reviewChip,
                            { borderColor: active ? palette.primary : palette.border, backgroundColor: active ? palette.elevated : 'transparent' }
                          ]}
                        >
                          <Text style={[styles.reviewChipText, { color: active ? palette.primary : palette.muted }]}>{category}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            ))}
          </ScrollView>

          <View style={[styles.modalActions, { borderColor: palette.border }]}>
            <Pressable style={[styles.cancelButton, { borderColor: palette.border }]} onPress={() => setReviewItems([])}>
              <Text style={[styles.cancelText, { color: palette.text }]}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.saveButton, { backgroundColor: palette.primary, opacity: saving ? 0.7 : 1 }]} onPress={saveReviewedItems} disabled={saving}>
              <Text style={styles.saveText}>{saving ? 'Adding' : 'Add reviewed'}</Text>
              <Ionicons name="checkmark" size={20} color={palette.primaryText} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: 132
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
    marginTop: 6,
    marginBottom: 8
  },
  copy: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18
  },
  dropzone: {
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  preview: {
    width: '100%',
    height: '100%'
  },
  emptyDropzone: {
    padding: 24,
    alignItems: 'center'
  },
  scanIcon: {
    width: 64,
    height: 64,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14
  },
  dropTitle: {
    fontSize: 18,
    fontWeight: '900'
  },
  dropCopy: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 7
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14
  },
  secondary: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7
  },
  secondaryText: {
    fontWeight: '900'
  },
  primary: {
    flex: 1,
    height: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7
  },
  primaryText: {
    color: '#042F2E',
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
  modalKicker: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  modalTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    marginTop: 4
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  newCategory: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingLeft: 14,
    paddingRight: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12
  },
  categoryInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800'
  },
  addCategoryButton: {
    minWidth: 86,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12
  },
  addCategoryText: {
    color: '#042F2E',
    fontSize: 13,
    fontWeight: '900'
  },
  reviewList: {
    flex: 1
  },
  reviewContent: {
    gap: 10,
    paddingBottom: 12
  },
  reviewCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 10
  },
  reviewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  kindSwitch: {
    height: 40,
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
    fontSize: 12,
    fontWeight: '900'
  },
  reviewTitleInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: '900'
  },
  reviewGrid: {
    flexDirection: 'row',
    gap: 8
  },
  reviewWarning: {
    minHeight: 30,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  reviewWarningText: {
    fontSize: 12,
    fontWeight: '900'
  },
  reviewInfo: {
    minHeight: 30,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  reviewInfoText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800'
  },
  reviewInput: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 14,
    fontWeight: '800'
  },
  fullReviewInput: {
    flex: 0
  },
  categoryChips: {
    gap: 8
  },
  reviewChip: {
    height: 34,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  reviewChipText: {
    fontSize: 12,
    fontWeight: '800'
  },
  modalActions: {
    borderTopWidth: 1,
    paddingTop: 12,
    flexDirection: 'row',
    gap: 10
  },
  cancelButton: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '900'
  },
  saveButton: {
    flex: 1.4,
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
