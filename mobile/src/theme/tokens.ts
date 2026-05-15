/**
 * Theme tokens — GitHub Dark/Light palette per plan §5.5.
 * No inline hex codes should appear anywhere else in the app.
 */

export type Theme = {
  bg: string;
  bgAlt: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  success: string;
  danger: string;
  warning: string;
};

export const dark: Theme = {
  bg: '#0d1117',
  bgAlt: '#161b22',
  border: '#30363d',
  text: '#c9d1d9',
  textMuted: '#8b949e',
  accent: '#58a6ff',
  success: '#3fb950',
  danger: '#f85149',
  warning: '#d29922',
};

export const light: Theme = {
  bg: '#ffffff',
  bgAlt: '#f6f8fa',
  border: '#d0d7de',
  text: '#1f2328',
  textMuted: '#656d76',
  accent: '#0969da',
  success: '#1a7f37',
  danger: '#cf222e',
  warning: '#9a6700',
};

export type ThemeMode = 'dark' | 'light';
