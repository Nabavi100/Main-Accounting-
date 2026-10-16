export type AppTheme =
  | "novatech"
  | "executive"
  | "gold"
  | "dark"
  | "light"
  | "classic"
  | "vibrant"
  | "sky-glass";
export type SidebarStyle = "modern-list" | "colored-cards" | "compact";

export const COLOR_GROUPS = [
  {
    id: "shell",
    title: "پوستهٔ اصلی",
    description: "رنگ‌های سربرگ، پس‌زمینه و دکمه‌های اصلی",
    fields: [
      ["header", "رنگ سربرگ"],
      ["headerText", "متن و آیکن سربرگ"],
      ["page", "پس‌زمینهٔ صفحات"],
      ["primary", "دکمه‌ها و رنگ اصلی"],
    ],
  },
  {
    id: "sidebar",
    title: "سایدبار",
    description: "رنگ زمینه، نوشته‌ها و گزینهٔ انتخاب‌شدهٔ منو",
    fields: [
      ["sidebar", "رنگ سایدبار"],
      ["sidebarText", "متن و آیکن سایدبار"],
      ["sidebarActive", "گزینهٔ فعال سایدبار"],
    ],
  },
  {
    id: "tables",
    title: "عنوان‌ها و جدول‌ها",
    description: "نوار عنوان صفحات، سرستون‌ها و خطوط جدول",
    fields: [
      ["titleStart", "نوار عنوان صفحات"],
      ["titleEnd", "رنگ دوم نوار عنوان"],
      ["titleText", "متن نوار عنوان"],
      ["tableHeader", "سرستون جدول‌ها"],
      ["tableText", "متن سرستون جدول"],
      ["border", "خطوط جدول و سایدبار"],
    ],
  },
] as const;
export const EXTRA_COLOR_FIELDS = [
  ["surface", "زمینهٔ کارت‌ها و فرم‌ها"],
  ["surfaceMuted", "زمینهٔ بخش‌های فرعی"],
  ["text", "متن اصلی صفحات"],
  ["muted", "متن راهنما"],
  ["primaryText", "متن دکمهٔ اصلی"],
  ["positive", "مبالغ دریافتی و مثبت"],
  ["negative", "مبالغ پرداختی و بدهی"],
  ["saleSoft", "زمینهٔ تسویهٔ فروش"],
  ["warningSoft", "زمینهٔ هشدارها"],
  ["warningText", "متن هشدارها"],
] as const;
export type ThemeColorKey = (typeof COLOR_GROUPS)[number]["fields"][number][0];
export type EditableColorKey =
  ThemeColorKey | (typeof EXTRA_COLOR_FIELDS)[number][0];
export type ThemePalette = Record<EditableColorKey, string>;
export type ColorOverrides = Partial<ThemePalette>;
export interface AppearancePreferences {
  theme: AppTheme;
  sidebarStyle: SidebarStyle;
  colors?: ColorOverrides;
}
export interface ThemeDefinition {
  id: AppTheme;
  name: string;
  description: string;
  dark: boolean;
  preset: boolean;
  colors: ThemePalette;
}

export const THEME_STORAGE_KEY = "cement_erp_theme_mode";
export const SIDEBAR_STORAGE_KEY = "cement_erp_sidebar_style";
export const COLOR_STORAGE_KEY = "cement_erp_theme_colors_v1";
export const DEFAULT_APPEARANCE: AppearancePreferences = {
  theme: "novatech",
  sidebarStyle: "modern-list",
};

const lightBase: ThemePalette = {
  header: "#eaf5fc",
  headerText: "#205e85",
  page: "#f5f7fa",
  primary: "#1176aa",
  primaryText: "#ffffff",
  sidebar: "#ffffff",
  sidebarText: "#3b5872",
  sidebarActive: "#e8f4fb",
  titleStart: "#e6f3fc",
  titleEnd: "#e8eefa",
  titleText: "#285f85",
  tableHeader: "#dceff8",
  tableText: "#174f70",
  border: "#dce3eb",
  surface: "#ffffff",
  surfaceMuted: "#f6f8fb",
  text: "#263c51",
  muted: "#637486",
  positive: "#17734f",
  negative: "#c73650",
  saleSoft: "#edf8f2",
  warningSoft: "#fff7e5",
  warningText: "#815522",
};
export const THEME_DEFINITIONS: readonly ThemeDefinition[] = [
  {
    id: "novatech",
    name: "فیروزه‌ای رسمی",
    description: "روشن، مرتب و نزدیک به تصویر مرجع",
    dark: false,
    preset: true,
    colors: { ...lightBase },
  },
  {
    id: "executive",
    name: "لاجوردی روشن",
    description: "سفید و یاسی با آبی شرکتی ملایم",
    dark: false,
    preset: true,
    colors: {
      ...lightBase,
      header: "#edf0fc",
      headerText: "#40569e",
      primary: "#4a60ac",
      sidebarActive: "#edf0fc",
      titleStart: "#e9eefc",
      titleEnd: "#f0ebfa",
      titleText: "#40569e",
      tableHeader: "#e8edfb",
      tableText: "#41568f",
      page: "#f6f7fd",
    },
  },
  {
    id: "vibrant",
    name: "زمردی آرام",
    description: "زمینهٔ روشن با سبز آرام و خوانا",
    dark: false,
    preset: true,
    colors: {
      ...lightBase,
      header: "#e8f5ed",
      headerText: "#246c58",
      primary: "#15745d",
      sidebarText: "#365b50",
      sidebarActive: "#e5f4ec",
      titleStart: "#e4f3ea",
      titleEnd: "#e6f4f6",
      titleText: "#246c58",
      tableHeader: "#e0f1e9",
      tableText: "#225e4b",
      page: "#f3f7f5",
    },
  },
  {
    id: "gold",
    name: "طلایی روشن",
    description: "سفید و کرم با طلایی ملایم",
    dark: false,
    preset: true,
    colors: {
      ...lightBase,
      header: "#fff6df",
      headerText: "#816324",
      page: "#fcfaf5",
      primary: "#927023",
      sidebarText: "#6a5837",
      sidebarActive: "#fff3d7",
      titleStart: "#fff1d3",
      titleEnd: "#fbf2e7",
      titleText: "#7d6128",
      tableHeader: "#fbf0d8",
      tableText: "#785d25",
      border: "#e8dfca",
      surfaceMuted: "#fcf9f1",
    },
  },
  // Stable old IDs now resolve to light variants, so saved preferences never bring back dark panels.
  {
    id: "light",
    name: "روشن استاندارد",
    description: "تم روشن قبلی",
    dark: false,
    preset: false,
    colors: {
      ...lightBase,
      header: "#ffffff",
      headerText: "#253e5a",
      tableHeader: "#eef2f7",
      tableText: "#33465e",
    },
  },
  {
    id: "dark",
    name: "آبی ملایم",
    description: "جایگزین روشن تم شب قبلی",
    dark: false,
    preset: false,
    colors: { ...lightBase, header: "#eef4fb", page: "#f7f9fc" },
  },
  {
    id: "classic",
    name: "عاجی کلاسیک",
    description: "تم کلاسیک روشن",
    dark: false,
    preset: false,
    colors: {
      ...lightBase,
      header: "#f8f4e9",
      headerText: "#6a593c",
      page: "#f8f6f1",
      primary: "#796340",
      sidebarText: "#665a48",
      sidebarActive: "#f0e9dc",
      titleStart: "#f2ecdf",
      titleEnd: "#f8f4ea",
      titleText: "#66553c",
      tableHeader: "#eee7d9",
      tableText: "#60513e",
      border: "#e0d9ce",
      surfaceMuted: "#f7f4ed",
    },
  },
  {
    id: "sky-glass",
    name: "شیشه‌ای آسمانی",
    description: "آبی بسیار روشن و شفاف",
    dark: false,
    preset: false,
    colors: {
      ...lightBase,
      header: "#e4f3fb",
      headerText: "#225b7a",
      page: "#f2f8fc",
      primary: "#176f9e",
      sidebarActive: "#e2f2fb",
      titleStart: "#e4f2fb",
      titleEnd: "#eceffd",
      titleText: "#255f81",
      tableHeader: "#e1f0fa",
      tableText: "#255f81",
    },
  },
];
export const PRESET_THEMES = THEME_DEFINITIONS.filter((theme) => theme.preset);
export const LEGACY_THEMES = THEME_DEFINITIONS.filter((theme) => !theme.preset);
export const SIDEBAR_STYLES: readonly {
  id: SidebarStyle;
  name: string;
  description: string;
}[] = [
  { id: "modern-list", name: "لیستی مرتب", description: "چیدمان ساده و منظم" },
  {
    id: "colored-cards",
    name: "کارت‌های تفکیک‌شده",
    description: "گروه‌بندی رنگی منوها",
  },
  {
    id: "compact",
    name: "منوی فشرده",
    description: "فاصله‌های کمتر و فضای بیشتر",
  },
];
export const BRIGHT_COLOR_SWATCHES = [
  "#ffffff",
  "#f5f7fa",
  "#eaf5fc",
  "#e8f5ed",
  "#fff6df",
  "#f0ebfa",
  "#dceff8",
  "#e0f1e9",
  "#fbf0d8",
  "#dce3eb",
  "#1176aa",
  "#4a60ac",
  "#15745d",
  "#927023",
  "#c73650",
  "#263c51",
];
export const isAppTheme = (value: unknown): value is AppTheme =>
  THEME_DEFINITIONS.some((theme) => theme.id === value);
export const isSidebarStyle = (value: unknown): value is SidebarStyle =>
  SIDEBAR_STYLES.some((style) => style.id === value);
export const getThemeDefinition = (theme: AppTheme): ThemeDefinition =>
  THEME_DEFINITIONS.find((item) => item.id === theme)!;
const editableKeys = new Set<string>([
  ...COLOR_GROUPS.flatMap((group) =>
    group.fields.map((field: readonly [ThemeColorKey, string]) => field[0]),
  ),
  ...EXTRA_COLOR_FIELDS.map((field) => field[0]),
]);
export const normalizeHexColor = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const text = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(text)) return text;
  if (/^#[0-9a-f]{3}$/.test(text))
    return "#" + [...text.slice(1)].map((char) => char + char).join("");
  return null;
};
export const sanitizeColorOverrides = (input: unknown): ColorOverrides => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return Object.fromEntries(
    Object.entries(input).flatMap(([key, value]) => {
      const color = normalizeHexColor(value);
      return editableKeys.has(key) && color ? [[key, color]] : [];
    }),
  );
};
export const resolveThemePalette = (
  theme: AppTheme,
  colors?: ColorOverrides,
): ThemePalette => ({
  ...getThemeDefinition(theme).colors,
  ...sanitizeColorOverrides(colors),
});
export const sameAppearance = (
  a: AppearancePreferences,
  b: AppearancePreferences,
): boolean =>
  a.theme === b.theme &&
  a.sidebarStyle === b.sidebarStyle &&
  JSON.stringify(Object.entries(sanitizeColorOverrides(a.colors)).sort()) ===
    JSON.stringify(Object.entries(sanitizeColorOverrides(b.colors)).sort());
export const readAppearance = (
  storage: Pick<Storage, "getItem">,
): AppearancePreferences => {
  try {
    const theme = storage.getItem(THEME_STORAGE_KEY),
      sidebar = storage.getItem(SIDEBAR_STORAGE_KEY),
      rawColors = storage.getItem(COLOR_STORAGE_KEY);
    let colors: ColorOverrides = {};
    try {
      colors = sanitizeColorOverrides(rawColors ? JSON.parse(rawColors) : {});
    } catch {
      /* Invalid colors never discard a valid theme choice. */
    }
    return {
      theme: isAppTheme(theme) ? theme : DEFAULT_APPEARANCE.theme,
      sidebarStyle: isSidebarStyle(sidebar)
        ? sidebar
        : DEFAULT_APPEARANCE.sidebarStyle,
      ...(Object.keys(colors).length ? { colors } : {}),
    };
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
};
export const persistAppearance = (
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  preferences: AppearancePreferences,
): boolean => {
  if (
    !isAppTheme(preferences.theme) ||
    !isSidebarStyle(preferences.sidebarStyle)
  )
    return false;
  const keys = [THEME_STORAGE_KEY, SIDEBAR_STORAGE_KEY, COLOR_STORAGE_KEY];
  let previous: (string | null)[] | undefined;
  try {
    previous = keys.map((key) => storage.getItem(key));
    storage.setItem(THEME_STORAGE_KEY, preferences.theme);
    storage.setItem(SIDEBAR_STORAGE_KEY, preferences.sidebarStyle);
    storage.setItem(
      COLOR_STORAGE_KEY,
      JSON.stringify(sanitizeColorOverrides(preferences.colors)),
    );
    return true;
  } catch {
    if (previous)
      try {
        keys.forEach((key, index) =>
          previous![index] === null
            ? storage.removeItem(key)
            : storage.setItem(key, previous![index]!),
        );
      } catch {
        /* Session-only selection remains usable. */
      }
    return false;
  }
};
export const themeCssVariables = (
  theme: AppTheme,
  colors?: ColorOverrides,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(resolveThemePalette(theme, colors)).map(([key, value]) => [
      `--ui-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
      value,
    ]),
  );
export const colorContrast = (a: string, b: string): number => {
  const luminance = (color: string) => {
    const rgb = color
      .slice(1)
      .match(/.{2}/g)!
      .map((value) => parseInt(value, 16) / 255)
      .map((value) =>
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
      );
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const first = luminance(a),
    second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
};
export const paletteContrastWarnings = (colors: ThemePalette): string[] =>
  [
    [colors.headerText, colors.header, "سربرگ"],
    [colors.sidebarText, colors.sidebar, "سایدبار"],
    [colors.tableText, colors.tableHeader, "سرستون جدول"],
    [colors.text, colors.surface, "متن اصلی"],
    [colors.primaryText, colors.primary, "دکمهٔ اصلی"],
    [colors.titleText, colors.titleStart, "نوار عنوان"],
    [colors.titleText, colors.titleEnd, "رنگ دوم عنوان"],
  ]
    .filter(
      ([foreground, background]) => colorContrast(foreground, background) < 4.5,
    )
    .map(([, , label]) => label);
