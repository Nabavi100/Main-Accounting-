import { CloseButton } from './CloseButton';
import React, { useEffect, useRef, useState } from "react";
import { Palette, RotateCcw, X } from "lucide-react";
import {
  BRIGHT_COLOR_SWATCHES,
  normalizeHexColor,
  type EditableColorKey,
} from "../utils/appearance";

export const AppearanceColorControl: React.FC<{
  field: EditableColorKey;
  label: string;
  value: string;
  defaultValue: string;
  onChange: (value: string | null) => void;
}> = ({ field, label, value, defaultValue, onChange }) => {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setHex(value), [value]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return (
    <div
      ref={ref}
      className={`appearance-color-row ${open ? "is-editing" : ""}`}
      data-color-field={field}
    >
      <div className="appearance-color-main">
        <span className="appearance-color-label">
          <i style={{ backgroundColor: value }} aria-hidden="true" />
          <span>{label}</span>
        </span>
        <button
          type="button"
          className="appearance-color-button"
          onClick={() => setOpen(!open)}
          aria-label={`انتخاب رنگ ${label}`}
          aria-expanded={open}
        >
          <Palette aria-hidden="true" />
          <bdi>{value.toUpperCase()}</bdi>
        </button>
      </div>
      {open && (
        <div
          className="appearance-color-palette"
          role="group"
          aria-label={`پالت رنگ ${label}`}
        >
          <div className="appearance-palette-title app-modal-heading">
            <strong>{label}</strong>
            <CloseButton type="button"
              aria-label="بستن پالت رنگ"
              onClick={() => setOpen(false)} />
          </div>
          <div className="appearance-palette-swatches">
            {BRIGHT_COLOR_SWATCHES.map((color) => (
              <button
                type="button"
                key={color}
                style={{ backgroundColor: color }}
                aria-label={`انتخاب ${color}`}
                title={color}
                aria-pressed={color === value}
                onClick={() => onChange(color)}
              />
            ))}
          </div>
          <div className="appearance-custom-color">
            <label>
              رنگ دلخواه
              <input
                type="color"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                aria-label={`پالت دلخواه ${label}`}
              />
            </label>
            <label>
              کد رنگ
              <input
                value={hex}
                dir="ltr"
                maxLength={7}
                aria-label={`کد رنگ ${label}`}
                aria-invalid={!normalizeHexColor(hex)}
                onChange={(event) => {
                  setHex(event.target.value);
                  const valid = normalizeHexColor(event.target.value);
                  if (valid) onChange(valid);
                }}
              />
            </label>
          </div>
          <div className="appearance-color-reset">
            <small>
              {normalizeHexColor(hex)
                ? "تغییرات به‌صورت زنده نمایش داده می‌شود."
                : "کد معتبر مانند #1176AA وارد کنید."}
            </small>
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setHex(defaultValue);
              }}
            >
              <RotateCcw />
              رنگ اصلی این بخش
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
