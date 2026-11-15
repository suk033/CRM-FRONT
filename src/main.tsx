import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

// Apply the remembered light/dark choice before the first paint (login included).
try {
  const theme = window.localStorage.getItem("supra-theme");
  if (theme === "light" || theme === "dark")
    document.documentElement.dataset.theme = theme;
} catch {
  // Storage unavailable: the toggle falls back to the system preference.
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
