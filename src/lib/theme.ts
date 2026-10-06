// Single canonical token set for The Backyard Project POS.
// Dark-only by default. Light theme added as opt-in.
// Every value here is signed-off in the design README. Do not soften.

export interface Theme {
  bg: string;
  surface: string;
  surface2: string;
  surface3: string;
  line: string;
  line2: string;
  text: string;
  textDim: string;
  textMute: string;
  headerText: string;
  accent: string;
  accentInk: string;
  ok: string;
  warn: string;
  bad: string;
  info: string;
  chip: string;
  chipBd: string;
  sansHead: string;
  sansBody: string;
  mono: string;
  radius: string;
  radiusLg: string;
  shadow: string;
  shadowModal: string;
  // Present only on the Material 3 themes. Components check `T.m3` to switch
  // from the flat bordered layout to tonal cards; classic themes never set it.
  m3?: M3Tokens;
}

// Material 3 tonal roles (pinned by the v2 mockups in
// byp-pos-v2/docs/design/owner-reports-mockup.dc.html, teal seed).
export interface M3Tokens {
  topBar: string;
  navTrack: string; // pill track behind the main tabs in the top bar
  track: string; // segmented-control track
  container: string; // cards and KPI tiles
  containerHigh: string; // rows and tiles inside a card
  containerHighest: string; // neutral chips
  primaryContainer: string;
  onPrimaryContainer: string;
  onPrimaryContainerStrong: string;
  okContainer: string;
  onOkContainer: string;
  warnContainer: string;
  onWarnContainer: string;
  warnTint: string;
  badContainer: string;
  onBadContainer: string;
  badTint: string;
  infoContainer: string;
  onInfoContainer: string;
  elev1: string;
  elev2: string;
}

export type ThemeTokens = Theme;

export const THEME: Theme = {
  bg: "#0F1115",
  surface: "#1A1D24",
  surface2: "#262B36",
  surface3: "#343A46",

  line: "#343A46",
  line2: "#3E4554",

  text: "#E5E7EB",
  textDim: "#9CA3AF",
  textMute: "#6B7280",
  headerText: "#6B7280",

  accent: "#5EEAD4",
  accentInk: "#0F1115",

  ok: "#34D399",
  warn: "#FBBF24",
  bad: "#F87171",
  info: "#38BDF8",

  chip: "rgba(94,234,212,0.08)",
  chipBd: "rgba(94,234,212,0.14)",

  sansHead: '"Inter", "Helvetica Neue", system-ui, sans-serif',
  sansBody: '"Inter", "Helvetica Neue", system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',

  radius: "2px",
  radiusLg: "4px",

  shadow: "0 1px 0 rgba(94,234,212,0.04) inset, 0 8px 24px rgba(0,0,0,0.5)",
  shadowModal: "0 30px 90px rgba(0,0,0,0.6)",
};

export const LIGHT_THEME: Theme = {
  bg: "#F4EEE3",
  surface: "#FAF9F6",
  surface2: "#B8A898",
  surface3: "#F0E9DC",

  line: "#D1D5DB",
  line2: "#C0C4CC",

  text: "#111827",
  textDim: "#4B5563",
  textMute: "#6B7280",
  headerText: "#111827",

  accent: "#2563EB",
  accentInk: "#FFFFFF",

  ok: "#16A34A",
  warn: "#D97706",
  bad: "#DC2626",
  info: "#0284C7",

  chip: "rgba(10,132,255,0.08)",
  chipBd: "rgba(10,132,255,0.16)",

  sansHead: '"Inter", "Helvetica Neue", system-ui, sans-serif',
  sansBody: '"Inter", "Helvetica Neue", system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',

  radius: "2px",
  radiusLg: "4px",

  shadow: "0 1px 0 rgba(0,0,0,0.04) inset, 0 8px 24px rgba(0,0,0,0.10)",
  shadowModal: "0 30px 90px rgba(0,0,0,0.20)",
};

const M3_FONTS = {
  sansHead: '"Roboto", "Helvetica Neue", system-ui, sans-serif',
  sansBody: '"Roboto", "Helvetica Neue", system-ui, sans-serif',
  mono: '"Roboto Mono", ui-monospace, "SF Mono", Menlo, monospace',
};

export const M3_DARK_THEME: Theme = {
  bg: "#0E1210",
  surface: "#1B2022",
  surface2: "#20262A",
  surface3: "#2B3236",

  line: "#2B3236",
  line2: "#3C4542",

  text: "#E2E5E3",
  textDim: "#A9B2AE",
  textMute: "#8B958F",
  headerText: "#8B958F",

  accent: "#6EEAD2",
  accentInk: "#00332C",

  ok: "#6FD8A8",
  warn: "#FFDB99",
  bad: "#FF9E96",
  info: "#B8C7FF",

  chip: "#20262A",
  chipBd: "#2B3236",

  ...M3_FONTS,

  radius: "12px",
  radiusLg: "20px",

  shadow: "0 1px 3px rgba(0,0,0,0.3)",
  shadowModal: "0 24px 64px rgba(0,0,0,0.55)",

  m3: {
    topBar: "#14181A",
    navTrack: "#1B2022",
    track: "#14181A",
    container: "#1B2022",
    containerHigh: "#20262A",
    containerHighest: "#2B3236",
    primaryContainer: "#00504A",
    onPrimaryContainer: "#8AF8DF",
    onPrimaryContainerStrong: "#F1FFFB",
    okContainer: "#1E3B36",
    onOkContainer: "#8AF8DF",
    warnContainer: "#453816",
    onWarnContainer: "#FFDB99",
    warnTint: "#2A2717",
    badContainer: "#4A2323",
    onBadContainer: "#FF9E96",
    badTint: "#331C1C",
    infoContainer: "#22304A",
    onInfoContainer: "#B8C7FF",
    elev1: "0 1px 3px rgba(0,0,0,0.3)",
    elev2: "0 2px 6px rgba(0,0,0,0.35)",
  },
};

export const M3_LIGHT_THEME: Theme = {
  bg: "#EEF3F1",
  surface: "#FFFFFF",
  surface2: "#EFF5F2",
  surface3: "#E3EAE7",

  line: "#DEE4E1",
  line2: "#BEC9C5",

  text: "#171D1B",
  textDim: "#3F4946",
  textMute: "#5B6562",
  headerText: "#3F4946",

  accent: "#006A60",
  accentInk: "#FFFFFF",

  ok: "#1E7A4F",
  warn: "#7A5900",
  bad: "#BA1A1A",
  info: "#3A56A8",

  chip: "#E9EFEC",
  chipBd: "#DEE4E1",

  ...M3_FONTS,

  radius: "12px",
  radiusLg: "20px",

  shadow: "0 1px 3px rgba(16,24,22,0.08)",
  shadowModal: "0 24px 64px rgba(16,24,22,0.18)",

  m3: {
    topBar: "#FFFFFF",
    navTrack: "#E9EFEC",
    track: "#E9EFEC",
    container: "#FFFFFF",
    containerHigh: "#F4F8F6",
    containerHighest: "#E3EAE7",
    primaryContainer: "#9EF2E4",
    onPrimaryContainer: "#00504A",
    onPrimaryContainerStrong: "#00201C",
    okContainer: "#CCE8E2",
    onOkContainer: "#00504A",
    warnContainer: "#FFDEA6",
    onWarnContainer: "#5C4300",
    warnTint: "#FFF4DE",
    badContainer: "#FFDAD6",
    onBadContainer: "#93000A",
    badTint: "#FFEDEA",
    infoContainer: "#DCE1FF",
    onInfoContainer: "#2A4290",
    elev1: "0 1px 3px rgba(16,24,22,0.08)",
    elev2: "0 2px 6px rgba(16,24,22,0.12)",
  },
};

// Status color helper — used by table cards, nav dots, ticket headers
export type TableStatus =
  "available" | "occupied" | "aging" | "attention" | "reserved";

export function statusColor(status: TableStatus, T: Theme = THEME): string {
  switch (status) {
    case "available":
      return T.textMute;
    case "occupied":
      return T.accent;
    case "aging":
      return T.warn;
    case "attention":
      return T.bad;
    case "reserved":
      return T.info;
  }
}

export function statusLabel(status: TableStatus): string {
  switch (status) {
    case "available":
      return "Available";
    case "occupied":
      return "Occupied";
    case "aging":
      return "Aging";
    case "attention":
      return "Needs Attention";
    case "reserved":
      return "Reserved";
  }
}
