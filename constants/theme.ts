/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const RecordQuestTheme = {
  colors: {
    bg: "#06070B",
    bgElevated: "#10121A",
    bgCard: "rgba(17, 19, 26, 0.94)",
    bgCardPressed: "rgba(24, 28, 40, 0.96)",
    border: "rgba(248, 238, 220, 0.12)",
    borderStrong: "rgba(139, 92, 246, 0.46)",
    textPrimary: "#F6EEDC",
    textSecondary: "#C5BDD7",
    textMuted: "#9C95B2",
    accent: "#8B5CF6",
    accentSoft: "rgba(139, 92, 246, 0.14)",
    accentStrong: "#7C3AED",
    success: "#22C55E",
    warning: "#F59E0B",
  },
  spacing: {
    pageHorizontal: 20,
    pageVertical: 16,
    sectionGap: 18,
    cardPadding: 14,
  },
  radius: {
    card: 18,
    pill: 999,
    input: 14,
  },
};
