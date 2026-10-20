/**
 * Mazan colour tokens. A green "balance" accent on slightly green-tinted neutrals,
 * with fixed hues for the three macros so they read the same on every screen.
 */
export const palettes = {
  light: {
    bg: '#F2F5F1',
    surface: '#FFFFFF',
    sunk: '#E7ECE6',
    ink: '#15201A',
    muted: '#5B6961',
    line: '#DCE3DB',
    accent: '#1D7A54',
    accentInk: '#FFFFFF',
    accentSoft: '#DFF0E6',
    carbs: '#C9821A',
    protein: '#3463C4',
    fat: '#BC4A84',
    exercise: '#1F8796',
    water: '#2F86C9',
    danger: '#C2432C',
    dangerSoft: '#F8E3DE',
    scrim: 'rgba(8,14,11,0.45)',
  },
  dark: {
    bg: '#0E1411',
    surface: '#171F1B',
    sunk: '#212B26',
    ink: '#E6EEE9',
    muted: '#93A39A',
    line: '#2A352F',
    accent: '#4DC18F',
    accentInk: '#06130D',
    accentSoft: '#1A3328',
    carbs: '#E3A645',
    protein: '#709AEE',
    fat: '#E27DB0',
    exercise: '#4CB8C6',
    water: '#5AAEEB',
    danger: '#EE7A62',
    dangerSoft: '#3A221D',
    scrim: 'rgba(0,0,0,0.6)',
  },
};

export type Palette = typeof palettes.light;
export type Scheme = keyof typeof palettes;

export const radius = { sm: 10, md: 14, lg: 20, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
