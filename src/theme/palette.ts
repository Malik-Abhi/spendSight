import { ThemeMode } from '../types/expense';

export const categoryColors: Record<string, string> = {
  Food: '#15B8A6',
  Travel: '#3B82F6',
  Bills: '#F59E0B',
  Shopping: '#EF476F',
  Health: '#8B5CF6',
  Entertainment: '#F97316',
  Education: '#06B6D4',
  Savings: '#22C55E',
  Lending: '#A855F7',
  Trade: '#14B8A6',
  Other: '#64748B'
};

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
