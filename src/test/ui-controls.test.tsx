import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { useState } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { App, queryClient } from "../App";
import { setAccessToken } from "../api/client";
import { ConfirmDialog } from "../components/Feedback";
import { Select } from "../components/Select";
import { ThemeToggle } from "../components/Theme";

const api = "http://localhost:8000/api/v1";
let logins = 0;
const server = setupServer(
  http.post(`${api}/auth/login`, () => {
    logins += 1;
    return HttpResponse.json({ detail: "nope" }, { status: 401 });
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  setAccessToken(null);
  queryClient.clear();
  server.resetHandlers();
  logins = 0;
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  window.history.replaceState({}, "", "/");
});
afterAll(() => server.close());

const options = [
  { value: "meeting", label: "Reunión" },
  { value: "call", label: "Llamada" },
  { value: "visit", label: "Visita" },
];

describe("Select", () => {
  it("se elige con teclado y envía el valor en el formulario", () => {
    let submitted = "";
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitted = String(new FormData(event.currentTarget).get("kind"));
        }}
      >
        <label htmlFor="kind">Tipo</label>
        <Select
          id="kind"
          name="kind"
          defaultValue="meeting"
          options={options}
        />
        <button type="submit">Enviar</button>
      </form>,
    );
    const combobox = screen.getByRole("combobox", { name: "Tipo" });
    expect(combobox).toHaveTextContent("Reunión");
    expect(combobox).toHaveAttribute("aria-expanded", "false");

    fireEvent.keyDown(combobox, { key: "ArrowDown" });
    expect(combobox).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("option", { name: "Reunión" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.keyDown(combobox, { key: "ArrowDown" });
    fireEvent.keyDown(combobox, { key: "ArrowDown" });
    fireEvent.keyDown(combobox, { key: "Enter" });
    expect(combobox).toHaveTextContent("Visita");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    fireEvent.keyDown(combobox, { key: "Enter" });
    fireEvent.keyDown(combobox, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(combobox).toHaveTextContent("Visita");

    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(submitted).toBe("visit");
  });

  it("funciona controlado y muestra el placeholder sin valor", () => {
    function Controlled() {
      const [value, setValue] = useState("");
      return (
        <>
          <label htmlFor="c">Empresa</label>
          <Select
            id="c"
            value={value}
            onChange={setValue}
            options={options}
            placeholder="Selecciona una empresa"
          />
          <output>{value || "vacío"}</output>
        </>
      );
    }
    render(<Controlled />);
    const combobox = screen.getByRole("combobox", { name: "Empresa" });
    expect(combobox).toHaveTextContent("Selecciona una empresa");
    fireEvent.click(combobox);
    fireEvent.click(screen.getByRole("option", { name: "Llamada" }));
    expect(screen.getByText("call")).toBeInTheDocument();
    expect(combobox).toHaveTextContent("Llamada");
  });
});

describe("ConfirmDialog", () => {
  it("Escape cancela y el foco va al botón de confirmar", () => {
    let cancelled = 0;
    let confirmed = 0;
    render(
      <ConfirmDialog
        open
        title="¿Marcar como completada?"
        onConfirm={() => (confirmed += 1)}
        onCancel={() => (cancelled += 1)}
      />,
    );
    const dialog = screen.getByRole("alertdialog", {
      name: "¿Marcar como completada?",
    });
    expect(screen.getByRole("button", { name: "Confirmar" })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(cancelled).toBe(1);
    expect(confirmed).toBe(0);
  });
});

describe("ThemeToggle", () => {
  it("alterna modo noche y claro y recuerda la elección", () => {
    render(<ThemeToggle />);
    const toNight = screen.getByRole("button", {
      name: "Cambiar a modo noche",
    });
    expect(document.documentElement.dataset.theme).toBe("light");
    fireEvent.click(toNight);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("supra-theme")).toBe("dark");
    expect(
      screen.getByRole("button", { name: "Cambiar a modo claro" }),
    ).toHaveAttribute("aria-pressed", "true");
    cleanup();
    render(<ThemeToggle />);
    expect(
      screen.getByRole("button", { name: "Cambiar a modo claro" }),
    ).toBeInTheDocument();
  });
});

describe("login", () => {
  it("valida campos vacíos en la página sin enviar la solicitud", () => {
    window.history.replaceState({}, "", "/login");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(
      screen.getByText("Ingresa tu correo electrónico."),
    ).toBeInTheDocument();
    expect(screen.getByText("Ingresa tu contraseña.")).toBeInTheDocument();
    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(logins).toBe(0);

    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "ana@supra.pe" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(
      screen.queryByText("Ingresa tu correo electrónico."),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Ingresa tu contraseña.")).toBeInTheDocument();
    expect(logins).toBe(0);
  });
});
