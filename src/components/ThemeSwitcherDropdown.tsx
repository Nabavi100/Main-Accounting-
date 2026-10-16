import React, { useState } from "react";
import { Palette } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { getThemeDefinition } from "../utils/appearance";
import { AppearanceSettingsDialog } from "./AppearanceSettingsDialog";

interface ThemeSwitcherDropdownProps {
  minimal?: boolean;
  onOpen?: () => void;
  companyName?: string;
}

/** Kept as an adapter for old header callers; the theme editor no longer crowds a dropdown. */
export const ThemeSwitcherDropdown: React.FC<ThemeSwitcherDropdownProps> = ({
  minimal = false,
  onOpen,
  companyName,
}) => {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        id="btn-theme-switcher-toggle"
        type="button"
        className={`appearance-trigger ${minimal ? "is-minimal" : ""}`}
        onClick={() => (onOpen ? onOpen() : setIsOpen(true))}
        title={`تم و ظاهر؛ ${getThemeDefinition(theme).name}`}
        aria-label="باز کردن تنظیمات ظاهر و تم"
        aria-haspopup="dialog"
      >
        <Palette aria-hidden="true" />
        {!minimal && <span>تم و ظاهر</span>}
      </button>
      {!onOpen && (
        <AppearanceSettingsDialog
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          companyName={companyName}
        />
      )}
    </>
  );
};
