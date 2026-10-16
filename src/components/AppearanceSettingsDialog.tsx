import { CloseButton } from './CloseButton';
import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  CheckCircle2,
  Columns2,
  Info,
  LayoutDashboard,
  Palette,
  PanelTop,
  RotateCcw,
  Save,
  Sparkles,
  Table2,
  X,
} from "lucide-react";
import { AppearanceColorControl } from "./AppearanceColorControl";
import { useTheme } from "../context/ThemeContext";
import {
  COLOR_GROUPS,
  EXTRA_COLOR_FIELDS,
  paletteContrastWarnings,
  type EditableColorKey,
  DEFAULT_APPEARANCE,
  LEGACY_THEMES,
  PRESET_THEMES,
  SIDEBAR_STYLES,
  getThemeDefinition,
  type ThemeDefinition,
} from "../utils/appearance";

interface AppearanceSettingsDialogProps {
  isOpen: boolean;
  embedded?: boolean;
  onClose: () => void;
  companyName?: string;
}

const Miniature: React.FC<{
  definition: ThemeDefinition;
  companyName: string;
  compact?: boolean;
}> = ({ definition, companyName, compact = false }) => {
  const colors = definition.colors;
  const style = Object.fromEntries(
    Object.entries(colors).map(([key, value]) => [`--preview-${key}`, value]),
  ) as React.CSSProperties;
  return (
    <div
      className={`appearance-miniature ${compact ? "is-compact" : ""}`}
      style={style}
      aria-hidden={compact ? true : undefined}
      role={compact ? undefined : "img"}
      aria-label={
        compact
          ? undefined
          : `پیش‌نمایش نمایشی ${definition.name}؛ دادهٔ مالی واقعی نیست`
      }
    >
      <div className="appearance-mini-header">
        <span className="appearance-mini-logo" />
        <strong>{companyName}</strong>
        <span className="appearance-mini-search" />
        <i />
      </div>
      <div className="appearance-mini-body">
        <div className="appearance-mini-sidebar">
          <span>داشبورد</span>
          <span className="is-active">فروشات</span>
          <span>گدام‌ها</span>
          <span>گزارشات</span>
        </div>
        <div className="appearance-mini-content">
          <div className="appearance-mini-title">لیست فروشات</div>
          <div className="appearance-mini-toolbar">
            <span>ایجاد جدید</span>
            <span>جستجو</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>شماره</th>
                <th>مشتری</th>
                <th>مبلغ</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>۱</td>
                <td>نمونهٔ اول</td>
                <td>
                  <bdi>0.00</bdi>
                </td>
              </tr>
              <tr>
                <td>۲</td>
                <td>نمونهٔ دوم</td>
                <td>
                  <bdi>0.00</bdi>
                </td>
              </tr>
            </tbody>
          </table>
          <div className="appearance-mini-skeleton">
            <i />
            <i />
            <i />
          </div>
        </div>
      </div>
    </div>
  );
};

const AppearancePanel: React.FC<
  Omit<AppearanceSettingsDialogProps, "isOpen">
> = ({ onClose, companyName = "شرکت شما", embedded = false }) => {
  const {
    theme,
    sidebarStyle,
    previewAppearance,
    cancelPreview,
    saveAppearance,
    hasUnsavedAppearance,
    savedAppearance,
    appearance,
    palette,
  } = useTheme();
  const baseDefinition = getThemeDefinition(theme);
  const definition = { ...baseDefinition, colors: palette };
  const warnings = paletteContrastWarnings(palette);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const radioName = useId();
  const [saveStatus, setSaveStatus] = useState<"saved" | "session" | null>(
    null,
  );

  useEffect(() => {
    if (embedded) return () => cancelPreview();
    const dialog = dialogRef.current;
    if (!returnFocusRef.current)
      returnFocusRef.current = document.activeElement as HTMLElement;
    dialog?.showModal();
    dialog
      ?.querySelector<HTMLInputElement>(
        ".appearance-preset-option input:checked",
      )
      ?.focus({ preventScroll: true });
    return () => {
      cancelPreview();
      if (dialog?.open) dialog.close();
      requestAnimationFrame(() => {
        if (dialog?.isConnected && dialog.open) return; // StrictMode's second setup already opened it.
        const previous = returnFocusRef.current;
        if (
          previous?.isConnected &&
          previous !== document.body &&
          !previous.closest("[inert]")
        )
          previous.focus();
        if (document.activeElement === document.body)
          document.getElementById("workspace-profile-toggle")?.focus();
      });
    };
  }, [cancelPreview, embedded]);
  useEffect(() => {
    setSaveStatus(null);
  }, [theme, sidebarStyle, JSON.stringify(appearance.colors || {})]);

  const close = () => {
    cancelPreview();
    onClose();
  };
  const chooseTheme = (next: ThemeDefinition) =>
    previewAppearance({ theme: next.id, sidebarStyle, colors: {} });
  const save = () =>
    setSaveStatus(saveAppearance(appearance) ? "saved" : "session");

  const setColor = (key: EditableColorKey, value: string | null) => {
    const colors = { ...appearance.colors };
    if (value === null) delete colors[key];
    else colors[key] = value;
    previewAppearance({ ...appearance, colors });
  };

  const content = (<>
      <div className="appearance-heading app-modal-heading">
        <div className="appearance-heading-copy">
          <span className="appearance-heading-icon">
            <Palette aria-hidden="true" />
          </span>
          <div>
            <span className="appearance-eyebrow">شخصی‌سازی محیط کار</span>
            <h1 id={titleId}>تنظیمات ظاهر و رنگ سیستم</h1>
            <p>
              یک تم آماده انتخاب کنید؛ تغییرات را هم‌زمان در پیش‌نمایش و برنامه
              ببینید.
            </p>
          </div>
        </div>
        <div className="appearance-heading-actions">
          <button
            type="button"
            className="appearance-reset"
            onClick={() =>
              previewAppearance({
                ...DEFAULT_APPEARANCE,
                sidebarStyle,
                colors: {},
              })
            }
          >
            <RotateCcw aria-hidden="true" />
            بازگشت به تم اصلی
          </button>
          {!embedded && (<CloseButton type="button"
            className="appearance-close"
            onClick={close}
            aria-label="بستن تنظیمات ظاهر" />)}
        </div>
      </div>
      <div className="appearance-scroll">
        <section
          className="appearance-presets"
          aria-labelledby={`${titleId}-presets`}
        >
          <div className="appearance-section-title">
            <h2 id={`${titleId}-presets`}>
              <Sparkles aria-hidden="true" />
              تم‌های آماده
            </h2>
            <span>۴ طرح پیش‌فرض</span>
          </div>
          <div className="appearance-preset-grid">
            {PRESET_THEMES.map((item) => (
              <label
                key={item.id}
                className={`appearance-preset-option ${theme === item.id ? "is-selected" : ""}`}
                data-preset-theme={item.id}
              >
                <input
                  type="radio"
                  name={radioName}
                  value={item.id}
                  checked={theme === item.id}
                  onChange={() => chooseTheme(item)}
                  aria-label={item.name}
                />
                <Miniature
                  definition={item}
                  companyName={companyName}
                  compact
                />
                <span className="appearance-preset-copy">
                  <strong>{item.name}</strong>
                  <small>{item.description}</small>
                </span>
                {theme === item.id && (
                  <CheckCircle2
                    className="appearance-preset-check"
                    aria-hidden="true"
                  />
                )}
              </label>
            ))}
          </div>
          <details
            className="appearance-legacy-themes"
            open={!definition.preset || undefined}
          >
            <summary>
              تم‌های پیشین <span>انتخاب‌های قبلی شما حفظ شده‌اند</span>
            </summary>
            <div>
              {LEGACY_THEMES.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-pressed={theme === item.id}
                  onClick={() => chooseTheme(item)}
                >
                  <i style={{ background: item.colors.primary }} />
                  <span>{item.name}</span>
                  {theme === item.id && <Check aria-hidden="true" />}
                </button>
              ))}
            </div>
          </details>
        </section>
        <div className="appearance-settings-grid">
          <div className="appearance-color-groups">
            {COLOR_GROUPS.map((group, index) => {
              const Icon = [PanelTop, Columns2, Table2][index];
              return (
                <section
                  className="appearance-color-group"
                  key={group.id}
                  aria-labelledby={`${titleId}-${group.id}`}
                >
                  <div className="appearance-group-heading">
                    <span>
                      <Icon aria-hidden="true" />
                    </span>
                    <div>
                      <h2 id={`${titleId}-${group.id}`}>{group.title}</h2>
                      <p>{group.description}</p>
                    </div>
                  </div>
                  <div className="appearance-color-grid">
                    {group.fields.map(([key, label]) => (
                      <AppearanceColorControl
                        key={key}
                        field={key}
                        label={label}
                        value={palette[key]}
                        defaultValue={baseDefinition.colors[key]}
                        onChange={(value) => setColor(key, value)}
                      />
                    ))}
                  </div>
                  {group.id === "shell" && (
                    <details className="appearance-extra-colors">
                      <summary>رنگ کارت‌ها، متن‌ها و وضعیت‌های مالی</summary>
                      <div className="appearance-color-grid">
                        {EXTRA_COLOR_FIELDS.map(([key, label]) => (
                          <AppearanceColorControl
                            key={key}
                            field={key}
                            label={label}
                            value={palette[key]}
                            defaultValue={baseDefinition.colors[key]}
                            onChange={(value) => setColor(key, value)}
                          />
                        ))}
                      </div>
                    </details>
                  )}
                  {group.id === "sidebar" && (
                    <details className="appearance-sidebar-options">
                      <summary>
                        <LayoutDashboard aria-hidden="true" />
                        چیدمان منوی برنامه{" "}
                        <span>
                          {
                            SIDEBAR_STYLES.find(
                              (item) => item.id === sidebarStyle,
                            )?.name
                          }
                        </span>
                      </summary>
                      <div>
                        {SIDEBAR_STYLES.map((item) => (
                          <label
                            key={item.id}
                            className={
                              sidebarStyle === item.id ? "is-selected" : ""
                            }
                          >
                            <input
                              type="radio"
                              name={`${radioName}-sidebar`}
                              checked={sidebarStyle === item.id}
                              onChange={() =>
                                previewAppearance({
                                  ...appearance,
                                  sidebarStyle: item.id,
                                })
                              }
                            />
                            <strong>{item.name}</strong>
                            <small>{item.description}</small>
                          </label>
                        ))}
                      </div>
                    </details>
                  )}
                </section>
              );
            })}
          </div>
          <div
            className="appearance-preview-card"
            role="complementary"
            aria-labelledby={`${titleId}-preview`}
          >
            <div className="appearance-group-heading">
              <span>
                <Sparkles aria-hidden="true" />
              </span>
              <div>
                <h2 id={`${titleId}-preview`}>پیش‌نمایش زنده</h2>
                <p>نمونهٔ سربرگ، سایدبار و جدول</p>
              </div>
              <span className="appearance-live-dot">زنده</span>
            </div>
            <div className="appearance-preview-content">
              <Miniature definition={definition} companyName={companyName} />
              <div className="appearance-current-theme">
                <span>تم انتخاب‌شده</span>
                <strong>{definition.name}</strong>
                <small>{definition.dark ? "پوستهٔ تیره" : "پوستهٔ روشن"}</small>
              </div>
              <p className="appearance-preview-caption">
                ردیف‌های بالا فقط نمونهٔ نمایشی هستند و در حسابداری ثبت
                نمی‌شوند.
              </p>
            </div>
            <div className="appearance-future-note">
              <Info aria-hidden="true" />
              <p>
                برای تغییر رنگ هر بخش، دکمهٔ پالت همان ردیف را باز کنید.{" "}
                <strong>
                  رنگ دلخواه، کد HEX و بازگشت به رنگ اصلی در دسترس است.
                </strong>
              </p>
            </div>
          </div>
        </div>
        {warnings.length > 0 && (
          <p className="appearance-contrast-warning" role="status">
            خوانایی این بخش‌ها کم شده است: {warnings.join("، ")}. برای خوانایی
            بیشتر، رنگ متن یا زمینه را تغییر دهید.
          </p>
        )}
      </div>
      <div className="appearance-footer">
        <div className="appearance-save-state" role="status" aria-live="polite">
          {saveStatus === "saved" ? (
            <>
              <CheckCircle2 aria-hidden="true" />
              <span>تم و چیدمان منو ذخیره شد.</span>
            </>
          ) : saveStatus === "session" ? (
            <>
              <Info aria-hidden="true" />
              <span>
                ذخیره در مرورگر ممکن نبود؛ تم فقط در این نشست اعمال شده است.
              </span>
            </>
          ) : (
            <>
              <span
                className={`appearance-state-dot ${hasUnsavedAppearance ? "is-pending" : ""}`}
              />
              <span>
                {hasUnsavedAppearance
                  ? "پیش‌نمایش فعال است؛ برای نگهداری تغییرات ذخیره کنید."
                  : `تم کنونی: ${getThemeDefinition(savedAppearance.theme).name}`}
              </span>
            </>
          )}
        </div>
        <div className="appearance-footer-actions">
          <button type="button" className="appearance-cancel" onClick={close}>
            {embedded ? "انصراف از تغییرات" : "انصراف و بستن"}
          </button>
          <button type="button" className="appearance-save" onClick={save}>
            <Save aria-hidden="true" />
            ذخیره تنظیمات ظاهر
          </button>
        </div>
      </div>
  </>);
  if (embedded) return <section className="appearance-dialog appearance-page" dir="rtl" aria-labelledby={titleId}>{content}</section>;
  return createPortal(<dialog ref={dialogRef} className="appearance-dialog" dir="rtl" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }}>{content}</dialog>, document.body);
};

export const AppearanceSettingsDialog: React.FC<
  AppearanceSettingsDialogProps
> = (props) =>
  props.isOpen ? (
    <AppearancePanel onClose={props.onClose} companyName={props.companyName} embedded={props.embedded} />
  ) : null;
