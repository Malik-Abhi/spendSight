import { PropsWithChildren, useMemo } from 'react';
import { ScrollView, StyleSheet, ViewStyle } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { getPalette } from '../theme/palette';

type ScreenProps = PropsWithChildren<{
  contentContainerStyle?: ViewStyle;
}>;

export function Screen({ children, contentContainerStyle }: ScreenProps) {
  const themeMode = useAppStore((state) => state.themeMode);
  const palette = useMemo(() => getPalette(themeMode), [themeMode]);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 112
  }
});
