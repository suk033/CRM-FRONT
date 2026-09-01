import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { App } from "../App";
import { getAccessToken, setAccessToken } from "../api/client";

const api = "http://localhost:8000/api/v1";
const user = {
  id: "1",
  email: "ana@supra.test",
  role: "admin",
  is_active: true,
  created_at: "2025-01-01T00:00:00Z",
};
let seen: Request[] = [];
const server = setupServer(
  http.post(`${api}/auth/login`, async ({ request }) => {
    seen.push(request.clone());
    return HttpResponse.json({
      access_token: "token-secreto",
      token_type: "bearer",
      expires_at: "2025-02-01T00:00:00Z",
      expires_in: 3600,
    });
  }),
  http.get(`${api}/users/me`, ({ request }) => {
    seen.push(request.clone());
    return HttpResponse.json(user);
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  setAccessToken(null);
  server.resetHandlers();
  seen = [];
  window.history.replaceState({}, "", "/");
});
afterAll(() => server.close());

async function login() {
  render(<App />);
  fireEvent.change(screen.getByLabelText(/correo/i), {
    target: { value: "ana@supra.test" },
  });
  fireEvent.change(screen.getByLabelText(/contraseña/i), {
    target: { value: "clave-secreta" },
  });
  fireEvent.click(screen.getByRole("button", { name: /ingresar/i }));
  await screen.findByText("ana@supra.test");
}

describe("autenticación", () => {
  it("envía el JSON exacto, adjunta Bearer y muestra el usuario", async () => {
    await login();
    expect(await seen[0].json()).toEqual({
      email: "ana@supra.test",
      password: "clave-secreta",
    });
    expect(seen[1].headers.get("authorization")).toBe("Bearer token-secreto");
    expect(screen.getByText("ana@supra.test")).toBeInTheDocument();
    expect(screen.getByText(/Administrador · Activo/)).toBeInTheDocument();
  });

  it("muestra un mensaje genérico ante 401 o red", async () => {
    server.use(
      http.post(
        `${api}/auth/login`,
        () => new HttpResponse(null, { status: 401 }),
      ),
    );
    render(<App />);
    fireEvent.change(screen.getByLabelText(/correo/i), {
      target: { value: "ana@supra.test" },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "clave-secreta" },
    });
    fireEvent.click(screen.getByRole("button", { name: /ingresar/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /no fue posible iniciar sesión/i,
    );
    server.use(http.post(`${api}/auth/login`, () => HttpResponse.error()));
    fireEvent.click(screen.getByRole("button", { name: /ingresar/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /no fue posible iniciar sesión/i,
    );
  });

  it("redirige rutas protegidas y no persiste el token", async () => {
    window.history.replaceState({}, "", "/empresas");
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: /iniciar sesión/i }),
    ).toBeInTheDocument();
    expect(document.documentElement.innerHTML).not.toContain("token-secreto");
    expect(sessionStorage.length + localStorage.length).toBe(0);
  });

  it("limpia autenticación y caché ante 401 de usuario actual", async () => {
    server.use(
      http.get(
        `${api}/users/me`,
        () => new HttpResponse(null, { status: 401 }),
      ),
    );
    render(<App />);
    fireEvent.change(screen.getByLabelText(/correo/i), {
      target: { value: "ana@supra.test" },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "clave-secreta" },
    });
    fireEvent.click(screen.getByRole("button", { name: /ingresar/i }));
    await waitFor(() => expect(getAccessToken()).toBeNull());
  });

  it("al salir limpia el token y la consulta de usuario", async () => {
    await login();
    fireEvent.click(screen.getByRole("button", { name: /cerrar sesión/i }));
    expect(
      await screen.findByRole("heading", { name: /iniciar sesión/i }),
    ).toBeInTheDocument();
    expect(getAccessToken()).toBeNull();
  });

  it("expone una shell semántica con futuros módulos deshabilitados", async () => {
    await login();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: /módulos/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("button", { name: /próximamente/i })
        .every((button) => (button as HTMLButtonElement).disabled),
    ).toBe(true);
  });
});
