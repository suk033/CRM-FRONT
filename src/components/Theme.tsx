import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
const STORAGE_KEY = "supra-theme";

function initialTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage can be unavailable (private mode); fall back to the system preference.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Light/dark mode switch; the choice is applied to <html data-theme> and remembered per browser. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore: the theme still applies for this session.
    }
  }, [theme]);
  const dark = theme === "dark";
  return (
    <button
      type="button"
      className="ws-theme-toggle"
      aria-pressed={dark}
      aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo noche"}
      title={dark ? "Modo claro" : "Modo noche"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {dark ? (
          <path
            d="M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        ) : (
          <path
            d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </button>
  );
}
