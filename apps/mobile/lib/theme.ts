import { StyleSheet } from 'react-native';

export const sketchColors = {
  bgPrimary: '#14161F',
  bgSecondary: '#1D202B',
  bgElevated: '#262A38',
  border: '#3D445C',
  tileBorder: '#4E5673',
  textPrimary: '#FAF7F0',
  textSecondary: '#B6BCCF',
  textMuted: '#7C849C',
  accent: '#FF7A59',
  accentSecondary: '#60A5FA',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#F87171',
  shadow: '#090A0F',
} as const;

export const sketchStyles = StyleSheet.create({
  card: {
    backgroundColor: sketchColors.bgSecondary,
    borderColor: sketchColors.border,
    borderWidth: 2,
    borderRadius: 20,
    shadowColor: sketchColors.shadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  button: {
    borderColor: sketchColors.border,
    borderWidth: 2,
    borderRadius: 16,
    shadowColor: sketchColors.shadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  tile: {
    borderColor: sketchColors.tileBorder,
    borderWidth: 2,
    borderRadius: 14,
    shadowColor: sketchColors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
});
