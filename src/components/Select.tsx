import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export type SelectOption = { value: string; label: string };

type Props = {
  id?: string;
  name?: string;
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  onChange?: (value: string) => void;
};

/**
 * Styled single-select (WAI-ARIA select-only combobox) replacing the browser's native dropdown.
 * A hidden input carries the value so it works inside forms read with FormData.
 * Label it with <label htmlFor={id}> or by wrapping it in a <label>.
 */
export function Select({
  id,
  name,
  options,
  value,
  defaultValue,
  placeholder = "Selecciona una opción",
  disabled,
  invalid,
  describedBy,
  onChange,
}: Props) {
  const generated = useId();
  const buttonId = id ?? `${generated}-button`;
  const listId = `${generated}-list`;
  const [internal, setInternal] = useState(defaultValue ?? "");
  const current = value ?? internal;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const selected = options.find((option) => option.value === current);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function openList() {
    if (disabled) return;
    setActive(
      Math.max(
        0,
        options.findIndex((option) => option.value === current),
      ),
    );
    setOpen(true);
  }

  function choose(option: SelectOption) {
    if (value === undefined) setInternal(option.value);
    onChange?.(option.value);
    setOpen(false);
    button.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }
    const last = options.length - 1;
    if (event.key === "ArrowDown")
      setActive((index) => Math.min(last, index + 1));
    else if (event.key === "ArrowUp")
      setActive((index) => Math.max(0, index - 1));
    else if (event.key === "Home") setActive(0);
    else if (event.key === "End") setActive(last);
    else if (event.key === "Enter" || event.key === " ") {
      if (options[active]) choose(options[active]);
    } else if (event.key === "Escape" || event.key === "Tab") {
      setOpen(false);
      return;
    } else return;
    event.preventDefault();
  }

  return (
    <div className={`ws-select${open ? " is-open" : ""}`} ref={root}>
      <button
        ref={button}
        id={buttonId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        className="ws-select-button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
      >
        <span className={selected ? undefined : "ws-select-placeholder"}>
          {selected?.label ?? placeholder}
        </span>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path
            d="m5 8 5 5 5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </svg>
      </button>
      {name && <input type="hidden" name={name} value={current} />}
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="ws-select-list"
          aria-labelledby={buttonId}
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option.value === current}
              className={index === active ? "is-active" : undefined}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
            >
              {option.label}
              {option.value === current && (
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path
                    d="m4 10 4 4 8-8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
