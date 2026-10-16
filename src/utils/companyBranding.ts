import type { CompanySettings } from "../types";

export const DEFAULT_COMPANY_NAME = "شرکت تجارتی برادران نبوی";
// Only exact defaults from the reference reconstruction are migrated; custom names and uploaded logos are preserved.
const LEGACY_DEFAULT_NAMES = new Set([
  "شرکت تجارتی اسحاق هارون واسعی",
  "اسحاق هارون واسعی",
  "حسابداری پیشرفته تجارتی و گدام‌داری",
]);

export const normalizeCompanyBranding = (
  saved: Partial<CompanySettings> | undefined,
  defaults: CompanySettings,
): CompanySettings => {
  const name = typeof saved?.name === "string" ? saved.name.trim() : "";
  const migrate = !name || LEGACY_DEFAULT_NAMES.has(name);
  return {
    ...defaults,
    ...saved,
    name: migrate ? DEFAULT_COMPANY_NAME : name,
    logoIconText:
      migrate && (!saved?.logoIconText || saved.logoIconText === "ه")
        ? "ن"
        : saved?.logoIconText || defaults.logoIconText,
  };
};
