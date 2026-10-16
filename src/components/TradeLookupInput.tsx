import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, Search } from "lucide-react";
import { normalizeDashboardSearch } from "../utils/dashboard";

export interface TradeLookupOption {
  id: string;
  label: string;
  description?: string;
  keywords?: string;
}
interface TradeLookupInputProps {
  id: string;
  value: string;
  onChange: (id: string) => void;
  options: TradeLookupOption[];
  placeholder: string;
  label: string;
  accent?: "buy" | "sell";
}

/** A searchable, keyboard-operable lookup that never leaves a stale selected ID. */
export const TradeLookupInput: React.FC<TradeLookupInputProps> = ({
  id,
  value,
  onChange,
  options,
  placeholder,
  label,
  accent = "buy",
}) => {
  const [text, setText] = useState(
    () => options.find((option) => option.id === value)?.label || "",
  );
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [position, setPosition] = useState({
    left: 0,
    top: 0,
    width: 240,
    maxHeight: 260,
  });
  const root = useRef<HTMLDivElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const clearedByTyping = useRef(false);
  const listId = useId();
  const selectedLabel =
    options.find((option) => option.id === value)?.label || "";
  const results = useMemo(() => {
    const query = normalizeDashboardSearch(
      value && text === selectedLabel ? "" : text,
    );
    return options
      .filter(
        (option) =>
          !query ||
          normalizeDashboardSearch(
            `${option.label} ${option.description || ""} ${option.keywords || ""}`,
          ).includes(query),
      )
      .slice(0, 60);
  }, [options, selectedLabel, text, value]);

  useEffect(() => {
    if (clearedByTyping.current && !value) {
      clearedByTyping.current = false;
      return;
    }
    setText(selectedLabel);
  }, [value, selectedLabel]);

  useLayoutEffect(() => {
    if (!open) return;
    const locate = () => {
      const box = input.current?.getBoundingClientRect();
      if (!box) return;
      const width = Math.min(Math.max(box.width, 240), window.innerWidth - 24);
      const availableBelow = window.innerHeight - box.bottom - 14;
      const above = availableBelow < 150 && box.top > 240;
      const maxHeight = Math.min(
        260,
        Math.max(100, above ? box.top - 16 : availableBelow),
      );
      setPosition({
        width,
        left: Math.max(
          12,
          Math.min(box.right - width, window.innerWidth - width - 12),
        ),
        top: above ? box.top - maxHeight - 5 : box.bottom + 5,
        maxHeight,
      });
    };
    locate();
    window.addEventListener("resize", locate);
    window.addEventListener("scroll", locate, true);
    const outside = (event: PointerEvent) => {
      if (
        !root.current?.contains(event.target as Node) &&
        !popup.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("resize", locate);
      window.removeEventListener("scroll", locate, true);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [text]);
  useEffect(() => {
    popup.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  const select = (option: TradeLookupOption) => {
    clearedByTyping.current = false;
    setText(option.label);
    onChange(option.id);
    setOpen(false);
    input.current?.focus();
  };

  return (
    <div ref={root} className="trade-lookup">
      <input
        id={id}
        ref={input}
        type="text"
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={
          open && results[highlight] ? `${listId}-${highlight}` : undefined
        }
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        onFocus={() => {
          setHighlight(0);
          setOpen(true);
        }}
        onChange={(event) => {
          setText(event.target.value);
          setOpen(true);
          if (value) {
            clearedByTyping.current = true;
            onChange("");
          }
        }}
        onBlur={(event) => {
          if (!popup.current?.contains(event.relatedTarget as Node))
            setOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) {
              setOpen(true);
              setHighlight(0);
            } else
              setHighlight((index) =>
                Math.max(
                  0,
                  Math.min(
                    results.length - 1,
                    index + (event.key === "ArrowDown" ? 1 : -1),
                  ),
                ),
              );
          }
          if (event.key === "Enter" && open) {
            event.preventDefault();
            if (results[highlight]) select(results[highlight]);
          }
          if (event.key === "Tab" && open && text && results.length === 1)
            select(results[0]);
        }}
      />
      {open &&
        createPortal(
          <div
            ref={popup}
            className={`trade-lookup-popup is-${accent}`}
            id={listId}
            role="listbox"
            aria-label={label}
            dir="rtl"
            style={{ position: "fixed", ...position }}
          >
            {results.length ? (
              results.map((option, index) => (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  id={`${listId}-${index}`}
                  aria-selected={index === highlight}
                  className={index === highlight ? "is-highlighted" : ""}
                  onPointerDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => select(option)}
                >
                  <span>
                    <strong>{option.label}</strong>
                    {option.description && <small>{option.description}</small>}
                  </span>
                  {value === option.id && <Check aria-hidden="true" />}
                </button>
              ))
            ) : (
              <div className="trade-lookup-empty">
                <Search aria-hidden="true" />
                <span>
                  {options.length
                    ? "نتیجه‌ای پیدا نشد؛ نام یا کد دیگری وارد کنید."
                    : "هنوز موردی تعریف نشده است."}
                </span>
              </div>
            )}
          </div>,
          input.current?.closest("dialog") || document.body,
        )}
    </div>
  );
};
