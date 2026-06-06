import { ThemeMode } from './expense';

export const categoryColors: Record<string, string> = {
  Food: '#15B8A6',
  Travel: '#3B82F6',
  Bills: '#F59E0B',
  Shopping: '#EF476F',
  Health: '#A855F7',
  Entertainment: '#F97316',
  Education: '#06B6D4',
  Savings: '#22C55E',
  Lending: '#EC4899',
  Trade: '#10B981',
  Other: '#64748B'
};

const categoryPalette = [
  '#15B8A6',
  '#3B82F6',
  '#F59E0B',
  '#EF476F',
  '#A855F7',
  '#F97316',
  '#06B6D4',
  '#22C55E',
  '#EC4899',
  '#84CC16',
  '#6366F1',
  '#F43F5E',
  '#14B8A6',
  '#EAB308',
  '#0EA5E9',
  '#D946EF'
];

function categoryHash(category: string) {
  return category.split('').reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

export function getCategoryColor(category: string, index = 0) {
  if (categoryColors[category]) return categoryColors[category];
  const paletteIndex = Math.abs(categoryHash(category) + index * 7) % categoryPalette.length;
  return categoryPalette[paletteIndex];
}

export function assignCategoryColors(categories: string[]) {
  const used = new Set<string>();
  return categories.map((category, index) => {
    let color = getCategoryColor(category, index);
    let attempts = 0;

    while (used.has(color) && attempts < categoryPalette.length) {
      color = categoryPalette[(categoryPalette.indexOf(color) + 1 + attempts) % categoryPalette.length];
      attempts += 1;
    }

    used.add(color);
    return { category, color };
  });
}

export const getPalette = (mode: ThemeMode) => {
  const dark = mode === 'dark';

  return {
    mode,
    background: dark ? '#0E151B' : '#F6F8F7',
    surface: dark ? '#151F28' : '#FFFFFF',
    elevated: dark ? '#1D2B35' : '#EEF4F1',
    subtle: dark ? '#111A22' : '#E8EFEC',
    text: dark ? '#F7FAFC' : '#172026',
    muted: dark ? '#A7B4BE' : '#687783',
    border: dark ? '#263845' : '#D9E3DE',
    primary: '#18B7A5',
    primaryText: '#042F2E',
    accent: '#F6B44B',
    accentText: '#342006',
    danger: '#EF476F',
    warning: '#F59E0B',
    success: '#22C55E'
  };
};
