import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { App, queryClient } from "../App";
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
  // Inicio loads the workspace after login.
  http.get(`${api}/activities`, () =>
    HttpResponse.json({ items: [], total: 0 }),
  ),
  http.get(`${api}/companies/overview`, () =>
    HttpResponse.json({ items: [], total: 0, active: 0 }),
  ),
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
  it("presenta marca honesta sin navegación privada y campos vacíos accesibles", () => {
    render(<App />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Iniciar sesión",
    );
    expect(
      screen.getByText("Empresas y contactos, en un solo lugar."),
    ).toBeInTheDocument();
    expect(screen.getByText(/acceso por roles/i)).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    const email = screen.getByLabelText(/correo/i);
    const password = screen.getByLabelText(/contraseña/i);
    expect(email).toHaveValue("");
    expect(email).toHaveAttribute("name", "email");
    expect(email).toHaveAttribute("autocomplete", "email");
    expect(password).toHaveValue("");
    expect(password).toHaveAttribute("name", "password");
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("autocomplete", "current-password");
  });

  it("anuncia espera, bloquea envíos duplicados y permite reintentar tras error", async () => {
    let release!: () => void;
    let requests = 0;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post(`${api}/auth/login`, async () => {
        requests += 1;
        await pending;
        return new HttpResponse(null, { status: 401 });
      }),
    );
    render(<App />);
    const email = screen.getByLabelText(/correo/i);
    const password = screen.getByLabelText(/contraseña/i);
    const form = screen.getByRole("form", { name: /iniciar sesión/i });
    fireEvent.change(email, { target: { value: "ana@supra.test" } });
    fireEvent.change(password, { target: { value: "clave-secreta" } });
    fireEvent.submit(form);
    await waitFor(() => expect(requests).toBe(1));
    expect(screen.getByRole("button", { name: /ingresando/i })).toBeDisabled();
    expect(email).toBeDisabled();
    expect(password).toBeDisabled();
    expect(form).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent(/verificando/i);
    fireEvent.submit(form);
    release();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /no fue posible/i,
    );
    expect(requests).toBe(1);
    expect(form).toHaveAttribute("aria-busy", "false");
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeEnabled();
    expect(email).toHaveValue("ana@supra.test");
    expect(password).toHaveValue("clave-secreta");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fireEvent.submit(form);
    await waitFor(() => expect(requests).toBe(2));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /no fue posible/i,
    );
  });

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

  it("redirige rutas protegidas y presenta una explicación útil sin persistir token", async () => {
    window.history.replaceState({}, "", "/empresas");
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: /iniciar sesión/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/accede a tu espacio de trabajo/i),
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

  it("al salir limpia el token, usuario y credenciales del caché de mutaciones", async () => {
    await login();
    expect(
      queryClient
        .getMutationCache()
        .getAll()
        .some(
          (mutation) =>
            (mutation.state.variables as { password?: string } | undefined)
              ?.password === "clave-secreta",
        ),
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /cerrar sesión/i }));
    expect(
      await screen.findByRole("heading", { name: /iniciar sesión/i }),
    ).toBeInTheDocument();
    expect(getAccessToken()).toBeNull();
    expect(queryClient.getQueryData(["current-user"])).toBeUndefined();
    expect(queryClient.getMutationCache().getAll()).toEqual([]);
  });

  it("expone una shell semántica con las cuatro secciones y aterriza en Inicio", async () => {
    await login();
    // jsdom also exposes the page header inside <main> as "banner"; the shell header comes first.
    expect(screen.getAllByRole("banner")[0]).toHaveTextContent("SUPRA CRM");
    const nav = screen.getByRole("navigation", { name: /módulos/i });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Inicio", "Empresas", "Inmuebles", "Perfil"]);
    expect(
      screen.queryByRole("button", { name: /próximamente/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { level: 1, name: "Hola, ana" }),
    ).toBeInTheDocument();
  });
});
