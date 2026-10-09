import { Platform } from 'react-native';

export const Colors = {
  primary: "#00853E", //UNT-style green - main buttons, accents, icons
  primaryDark: "#006B32", //Darker gren - pressed/hover states, stronger accents
 
  background: "#F7F7F7", //Light neutral gray - main page backgroung
  surface: "#FFFFFF", //White - cards, panels, containers
 
  textPrimary: "#1F2937", //Dark gray - main text, headings
  textSecondary: "#6B7280", //Medium gray - labels, helper text, subtitles

  border: "#D1D5DB", //Light gray - standard borders
  borderLight: "#EE5E7EB", // Very light gray - subtle dividers/cards borders
  tableBorder: "#E2E5E9", //Very light gray - table outline and cell seperators
  tableHeader: "#EEF0F2", // Light gray - table header

  success: "#15803D", //Green - present/success states
  successSoft: "#DCFCE7", //Soft green - Present badge background

  warning: "#D97706", //Orange - late/warning states
  warningSoft: "#FEF3C7", // Soft yellow - Late badge background

  danger: "#DC2626", //Red - absent/error/end session states
  dangerSoft: "#FEE2E2", //Soft red - Absent badge background

  disabled: "#9CA3AF", //Gray - disabled buttons/text
  disabledSurface: "#E5E7EB", // Soft gray - Disabled button background
};

export const Spacing = {
  xs: 4, //Tiny spacing
  sm: 8, //Small spacing
  md: 16, //Normal spacing
  lg: 24, //Large spacing
  xl: 32, //Extra large spacing
};

export const Radius = {
  sm: 6, //Small rounded corners
  md: 10, //Standard buttons/inputs
  lg: 14, //Cards and larger containers
  pill: 999, //Fully rounded/pill buttons
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },

  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },

  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Reegular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});