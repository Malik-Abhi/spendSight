import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../store/useAppStore';
import { getPalette } from '../theme/palette';

export type TabKey = 'dashboard' | 'transactions' | 'statement' | 'settings';

type BottomTabsProps = {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
};

const tabs: { key: TabKey; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'dashboard', icon: 'grid' },
  { key: 'transactions', icon: 'receipt' },
  { key: 'statement', icon: 'sparkles' },
  { key: 'settings', icon: 'settings' }
];

export function BottomTabs({ activeTab, onChange }: BottomTabsProps) {
  const themeMode = useAppStore((state) => state.themeMode);
  const palette = useMemo(() => getPalette(themeMode), [themeMode]);
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 16), backgroundColor: palette.surface, borderColor: palette.border }]}>
      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="button"
            accessibilityLabel={tab.key}
            onPress={() => onChange(tab.key)}
            style={[styles.item, active && { backgroundColor: palette.primary }]}
          >
            <Ionicons name={tab.icon} size={22} color={active ? palette.primaryText : palette.muted} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 16,
    height: 66,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8
  },
  item: {
    width: 50,
    height: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
