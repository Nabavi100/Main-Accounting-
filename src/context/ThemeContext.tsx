import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_APPEARANCE,
  THEME_DEFINITIONS,
  THEME_STORAGE_KEY,
  SIDEBAR_STORAGE_KEY,
  COLOR_STORAGE_KEY,
  isAppTheme,
  isSidebarStyle,
  persistAppearance,
  readAppearance,
  resolveThemePalette,
  sanitizeColorOverrides,
  sameAppearance,
  themeCssVariables,
  type AppearancePreferences,
  type AppTheme,
  type SidebarStyle,
  type ColorOverrides,
  type ThemePalette,
} from "../utils/appearance";
export type { AppTheme, SidebarStyle } from "../utils/appearance";
interface ThemeContextType {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  sidebarStyle: SidebarStyle;
  setSidebarStyle: (style: SidebarStyle) => void;
  isDark: boolean;
  isGold: boolean;
  toggleDarkMode: () => void;
  savedAppearance: AppearancePreferences;
  appearance: AppearancePreferences;
  colors: ColorOverrides;
  palette: ThemePalette;
  previewAppearance: (preferences: AppearancePreferences) => void;
  cancelPreview: () => void;
  saveAppearance: (preferences: AppearancePreferences) => boolean;
  hasUnsavedAppearance: boolean;
}
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const loadPreferences = (): AppearancePreferences => {
  try {
    return readAppearance(window.localStorage);
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
};
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [savedAppearance, setSavedAppearance] =
    useState<AppearancePreferences>(loadPreferences);
  const [preview, setPreview] = useState<AppearancePreferences | null>(null);
  const current = preview || savedAppearance;
  const palette = useMemo(
    () => resolveThemePalette(current.theme, current.colors),
    [current.theme, current.colors],
  );
  const saveAppearance = useCallback(
    (preferences: AppearancePreferences): boolean => {
      if (
        !isAppTheme(preferences.theme) ||
        !isSidebarStyle(preferences.sidebarStyle)
      )
        return false;
      const colors = sanitizeColorOverrides(preferences.colors);
      const normalized = {
        theme: preferences.theme,
        sidebarStyle: preferences.sidebarStyle,
        ...(Object.keys(colors).length ? { colors } : {}),
      };
      setSavedAppearance(normalized);
      setPreview(null);
      try {
        return persistAppearance(window.localStorage, normalized);
      } catch {
        return false;
      }
    },
    [],
  );
  const previewAppearance = useCallback(
    (preferences: AppearancePreferences) => {
      if (
        !isAppTheme(preferences.theme) ||
        !isSidebarStyle(preferences.sidebarStyle)
      )
        return;
      setPreview((previous) => {
        const before = previous || savedAppearance;
        const colors = sanitizeColorOverrides(
          preferences.colors !== undefined
            ? preferences.colors
            : before.theme === preferences.theme
              ? before.colors
              : {},
        );
        return {
          theme: preferences.theme,
          sidebarStyle: preferences.sidebarStyle,
          ...(Object.keys(colors).length ? { colors } : {}),
        };
      });
    },
    [savedAppearance],
  );
  const cancelPreview = useCallback(() => setPreview(null), []);
  const setTheme = useCallback(
    (theme: AppTheme) => {
      saveAppearance({
        ...current,
        theme,
        colors: theme === current.theme ? current.colors : {},
      });
    },
    [current, saveAppearance],
  );
  const setSidebarStyle = useCallback(
    (sidebarStyle: SidebarStyle) => {
      saveAppearance({ ...current, sidebarStyle });
    },
    [current, saveAppearance],
  );
  // Compatibility for the older header; both alternatives are light, as requested.
  const toggleDarkMode = () =>
    setTheme(current.theme === "light" ? "novatech" : "light");
  useLayoutEffect(() => {
    const body = document.body,
      root = document.documentElement;
    const classes = [
      ...THEME_DEFINITIONS.map((theme) => `theme-${theme.id}`),
      "dark",
      "gold",
      "sidebar-mode-list",
      "sidebar-mode-cards",
      "sidebar-mode-compact",
    ];
    body.classList.remove(...classes);
    root.classList.remove(...classes);
    body.classList.add("theme-light"); // No legacy dark/black overrides may leak into the new light palettes.
    body.classList.add(
      current.sidebarStyle === "modern-list"
        ? "sidebar-mode-list"
        : current.sidebarStyle === "colored-cards"
          ? "sidebar-mode-cards"
          : "sidebar-mode-compact",
    );
    for (const element of [body, root]) {
      element.dataset.theme = current.theme;
      element.dataset.sidebarStyle = current.sidebarStyle;
      element.dataset.appearance = "premium";
      element.dataset.colorMode = "light";
    }
    const variables = themeCssVariables(current.theme, current.colors);
    for (const [key, value] of Object.entries(variables))
      root.style.setProperty(key, value);
    return () => {
      for (const key of Object.keys(variables)) root.style.removeProperty(key);
    };
  }, [current.theme, current.sidebarStyle, current.colors]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (
        [
          THEME_STORAGE_KEY,
          SIDEBAR_STORAGE_KEY,
          COLOR_STORAGE_KEY,
          null,
        ].includes(event.key)
      )
        setSavedAppearance(loadPreferences());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return (
    <ThemeContext.Provider
      value={{
        theme: current.theme,
        sidebarStyle: current.sidebarStyle,
        setTheme,
        setSidebarStyle,
        isDark: false,
        isGold: current.theme === "gold",
        toggleDarkMode,
        savedAppearance,
        appearance: current,
        colors: current.colors || {},
        palette,
        previewAppearance,
        cancelPreview,
        saveAppearance,
        hasUnsavedAppearance: !sameAppearance(current, savedAppearance),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};
