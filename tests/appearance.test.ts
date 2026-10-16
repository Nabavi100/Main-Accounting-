import test from "node:test";
import assert from "node:assert/strict";
import {
  COLOR_GROUPS,
  COLOR_STORAGE_KEY,
  normalizeHexColor,
  sanitizeColorOverrides,
  resolveThemePalette,
  paletteContrastWarnings,
  DEFAULT_APPEARANCE,
  LEGACY_THEMES,
  PRESET_THEMES,
  SIDEBAR_STORAGE_KEY,
  SIDEBAR_STYLES,
  THEME_DEFINITIONS,
  THEME_STORAGE_KEY,
  getThemeDefinition,
  isAppTheme,
  isSidebarStyle,
  persistAppearance,
  readAppearance,
  sameAppearance,
  themeCssVariables,
  type ThemeColorKey,
} from "../src/utils/appearance";

const makeStorage = (initial: Record<string, string> = {}) => {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
};
const luminance = (hex: string) => {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((value) => parseInt(value, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrast = (a: string, b: string) => {
  const first = luminance(a),
    second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
};

test("exactly four primary preset themes are offered, with stable unique IDs", () => {
  assert.deepEqual(
    PRESET_THEMES.map((theme) => theme.id),
    ["novatech", "executive", "vibrant", "gold"],
  );
  assert.equal(new Set(THEME_DEFINITIONS.map((theme) => theme.id)).size, 8);
  assert.equal(PRESET_THEMES.filter((theme) => theme.dark).length, 0);
});

test("all old themes and three sidebar layouts remain valid rather than being deleted", () => {
  assert.deepEqual(
    LEGACY_THEMES.map((theme) => theme.id),
    ["light", "dark", "classic", "sky-glass"],
  );
  for (const theme of THEME_DEFINITIONS) assert.ok(isAppTheme(theme.id));
  for (const style of SIDEBAR_STYLES) assert.ok(isSidebarStyle(style.id));
  assert.equal(isAppTheme("unknown"), false);
  assert.equal(isSidebarStyle("lost"), false);
});

test("three reference color sections contain thirteen unique, complete swatches", () => {
  const fields = COLOR_GROUPS.flatMap((group) =>
    group.fields.map((field: readonly [ThemeColorKey, string]) => field[0]),
  );
  assert.equal(COLOR_GROUPS.length, 3);
  assert.equal(fields.length, 13);
  assert.equal(new Set(fields).size, 13);
  for (const theme of THEME_DEFINITIONS)
    for (const field of fields)
      assert.match(theme.colors[field], /^#[0-9a-f]{6}$/i);
});

test("body, header, sidebar, buttons and table text retain accessible contrast", () => {
  for (const theme of THEME_DEFINITIONS) {
    const c = theme.colors;
    for (const [foreground, background, part] of [
      [c.text, c.surface, "surface"],
      [c.headerText, c.header, "header"],
      [c.sidebarText, c.sidebar, "sidebar"],
      [c.primaryText, c.primary, "button"],
      [c.tableText, c.tableHeader, "table"],
      [c.titleText, c.titleStart, "title start"],
      [c.titleText, c.titleEnd, "title end"],
      [c.muted, c.surface, "secondary text"],
    ])
      assert.ok(
        contrast(foreground, background) >= 4.5,
        `${theme.id}: ${part} contrast ${contrast(foreground, background)}`,
      );
  }
});

test("fresh storage and invalid selections fall back to the reference-inspired default", () => {
  assert.deepEqual(readAppearance(makeStorage()), DEFAULT_APPEARANCE);
  assert.deepEqual(
    readAppearance(
      makeStorage({
        [THEME_STORAGE_KEY]: "invalid",
        [SIDEBAR_STORAGE_KEY]: "invalid",
      }),
    ),
    DEFAULT_APPEARANCE,
  );
});

test("existing legacy preferences are restored without a destructive migration", () => {
  const storage = makeStorage({
    [THEME_STORAGE_KEY]: "sky-glass",
    [SIDEBAR_STORAGE_KEY]: "compact",
  });
  const before = [...storage.values];
  assert.deepEqual(readAppearance(storage), {
    theme: "sky-glass",
    sidebarStyle: "compact",
  });
  assert.deepEqual([...storage.values], before);
});

test("a successful appearance save changes only the two existing preference keys", () => {
  const financialKey = "AFGHAN_ACCOUNTING_DATA_V2_invoices";
  const storage = makeStorage({
    [financialKey]: '[{"id":"existing"}]',
    other: "keep",
  });
  assert.equal(
    persistAppearance(storage, {
      theme: "gold",
      sidebarStyle: "colored-cards",
    }),
    true,
  );
  assert.deepEqual(readAppearance(storage), {
    theme: "gold",
    sidebarStyle: "colored-cards",
  });
  assert.equal(storage.getItem(financialKey), '[{"id":"existing"}]');
  assert.equal(storage.getItem("other"), "keep");
});

test("blocked reads safely return defaults and do not clear stored preferences", () => {
  const storage = makeStorage({
    [THEME_STORAGE_KEY]: "gold",
    [SIDEBAR_STORAGE_KEY]: "compact",
  });
  const blocked = {
    ...storage,
    getItem: () => {
      throw new Error("Restricted storage");
    },
  };
  assert.deepEqual(readAppearance(blocked), DEFAULT_APPEARANCE);
  assert.equal(persistAppearance(blocked, DEFAULT_APPEARANCE), false);
  assert.equal(storage.getItem(THEME_STORAGE_KEY), "gold");
  assert.equal(storage.getItem(SIDEBAR_STORAGE_KEY), "compact");
});

test("a failed second write rolls back the first preference, leaving finance data intact", () => {
  const storage = makeStorage({
    [THEME_STORAGE_KEY]: "light",
    [SIDEBAR_STORAGE_KEY]: "compact",
    finance: "unchanged",
  });
  const failing = {
    ...storage,
    setItem: (key: string, value: string) => {
      if (key === SIDEBAR_STORAGE_KEY && value === "modern-list")
        throw new Error("Quota exceeded");
      storage.setItem(key, value);
    },
  };
  assert.equal(persistAppearance(failing, DEFAULT_APPEARANCE), false);
  assert.deepEqual(readAppearance(storage), {
    theme: "light",
    sidebarStyle: "compact",
  });
  assert.equal(storage.getItem("finance"), "unchanged");
});

test("rejects invalid runtime values without persisting an incomplete palette", () => {
  const storage = makeStorage();
  assert.equal(
    persistAppearance(storage, {
      theme: "bogus" as never,
      sidebarStyle: "compact",
    }),
    false,
  );
  assert.equal(storage.values.size, 0);
});

test("CSS tokens are safe six-digit colors and constructing them cannot mutate the preset", () => {
  const before = structuredClone(getThemeDefinition("novatech"));
  const variables = themeCssVariables("novatech");
  assert.equal(variables["--ui-header"], before.colors.header);
  assert.equal(variables["--ui-table-header"], before.colors.tableHeader);
  for (const [key, value] of Object.entries(variables)) {
    assert.match(key, /^--ui-[a-z-]+$/);
    assert.match(value, /^#[0-9a-f]{6}$/i);
  }
  variables["--ui-header"] = "#000000";
  assert.deepEqual(getThemeDefinition("novatech"), before);
});

test("dirty state compares both theme and sidebar layout without editing the preferences", () => {
  const before = { ...DEFAULT_APPEARANCE };
  assert.equal(sameAppearance(before, { ...before }), true);
  assert.equal(sameAppearance(before, { ...before, theme: "gold" }), false);
  assert.equal(
    sameAppearance(before, { ...before, sidebarStyle: "compact" }),
    false,
  );
  assert.deepEqual(before, DEFAULT_APPEARANCE);
});

test("every built-in palette is light, including old saved dark/gold theme IDs", () => {
  for (const theme of THEME_DEFINITIONS) {
    assert.equal(theme.dark, false);
    for (const key of [
      "header",
      "page",
      "sidebar",
      "surface",
      "surfaceMuted",
    ] as const)
      assert.ok(luminance(theme.colors[key]) > 0.7, `${theme.id}: ${key}`);
  }
});
test("manual hex colors are normalized and unsafe CSS values are rejected", () => {
  assert.equal(normalizeHexColor("#AbC"), "#aabbcc");
  assert.equal(normalizeHexColor("#AABBCC"), "#aabbcc");
  assert.equal(normalizeHexColor("red"), null);
  assert.equal(normalizeHexColor("#aaa;url(x)"), null);
  assert.deepEqual(
    sanitizeColorOverrides(
      JSON.parse(
        '{"header":"#abcdef","__proto__":"#ffffff","amount":"#ffffff","page":"url(x)"}',
      ),
    ),
    { header: "#abcdef" },
  );
});
test("custom colors merge immutably, include extra surface/text colors and persist independently from finance", () => {
  const before = structuredClone(getThemeDefinition("novatech"));
  const colors = { header: "#abcdef", surface: "#f0f4fa", negative: "#ee2233" };
  const palette = resolveThemePalette("novatech", colors);
  assert.equal(palette.header, "#abcdef");
  assert.equal(palette.surface, "#f0f4fa");
  assert.deepEqual(getThemeDefinition("novatech"), before);
  const storage = makeStorage({ finance: "keep" });
  assert.equal(
    persistAppearance(storage, { ...DEFAULT_APPEARANCE, colors }),
    true,
  );
  assert.deepEqual(readAppearance(storage).colors, colors);
  assert.equal(storage.getItem("finance"), "keep");
  assert.equal(themeCssVariables("novatech", colors)["--ui-header"], "#abcdef");
});
test("invalid saved custom color JSON does not reset a valid theme or sidebar choice", () => {
  assert.deepEqual(
    readAppearance(
      makeStorage({
        [THEME_STORAGE_KEY]: "gold",
        [SIDEBAR_STORAGE_KEY]: "compact",
        [COLOR_STORAGE_KEY]: "{broken",
      }),
    ),
    { theme: "gold", sidebarStyle: "compact" },
  );
});
test("dirty state includes custom colors regardless of key order", () => {
  assert.equal(
    sameAppearance(DEFAULT_APPEARANCE, {
      ...DEFAULT_APPEARANCE,
      colors: { header: "#abcdef" },
    }),
    false,
  );
  assert.equal(
    sameAppearance(
      { ...DEFAULT_APPEARANCE, colors: { header: "#abcdef", page: "#ffffff" } },
      { ...DEFAULT_APPEARANCE, colors: { page: "#ffffff", header: "#abcdef" } },
    ),
    true,
  );
});
test("low-contrast custom palettes warn rather than silently overwriting the user choice", () => {
  const palette = resolveThemePalette("novatech", {
    header: "#ffffff",
    headerText: "#ffffff",
  });
  assert.ok(paletteContrastWarnings(palette).includes("سربرگ"));
  assert.equal(palette.headerText, "#ffffff");
});
