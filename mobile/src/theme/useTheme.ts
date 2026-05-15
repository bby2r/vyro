import { useThemeStore } from '../stores/themeStore';
import { dark, light, type Theme } from './tokens';

/**
 * Returns the current token bundle. Components read all colors from this hook
 * so a theme toggle re-renders only consumers, never inline hex literals.
 */
export function useTheme(): Theme {
  const mode = useThemeStore((s) => s.mode);
  return mode === 'dark' ? dark : light;
}
