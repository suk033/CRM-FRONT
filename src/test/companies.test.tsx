import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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
const company = {
  id: "11111111-1111-1111-1111-111111111111",
  legal_name: "SUPRA Demo SA",
  trade_name: "SUPRA",
  tax_id: "RFC123",
  created_at: "2025-01-15T12:00:00Z",
};
let postBody: unknown;
let companyPosts = 0;

const server = setupServer(
  http.get(`${api}/users/me`, () => HttpResponse.json(user)),
  http.post(`${api}/companies`, async ({ request }) => {
    companyPosts += 1;
    postBody = await request.json();
    return HttpResponse.json(company, { status: 201 });
  }),
  http.get(`${api}/companies/:companyId`, ({ params }) =>
    HttpResponse.json({
      ...company,
      id: String(params.companyId),
      contacts: [],
    }),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  setAccessToken(null);
  queryClient.clear();
  server.resetHandlers();
  postBody = undefined;
  companyPosts = 0;
  window.history.replaceState({}, "", "/");
});
afterAll(() => server.close());

function renderAuthenticated(path = "/empresas") {
  setAccessToken("token-secreto");
  window.history.replaceState({}, "", path);
  render(<App />);
}

describe("empresas", () => {
  it("crea una empresa con payload limpio y muestra el detalle real", async () => {
    renderAuthenticated();

    fireEvent.change(await screen.findByLabelText(/razón social/i), {
      target: { value: "  SUPRA Demo SA  " },
    });
    fireEvent.change(screen.getByLabelText(/nombre comercial/i), {
      target: { value: "  SUPRA  " },
    });
    fireEvent.change(screen.getByLabelText(/identificación fiscal/i), {
      target: { value: "  RFC123  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /crear empresa/i }));

    expect(
      await screen.findByRole("heading", { name: "SUPRA Demo SA" }),
    ).toBeInTheDocument();
    expect(postBody).toEqual({
      legal_name: "SUPRA Demo SA",
      trade_name: "SUPRA",
      tax_id: "RFC123",
    });
    expect(screen.getByText("RFC123")).toBeInTheDocument();
    expect(screen.getByText(/todavía no hay contactos/i)).toBeInTheDocument();
  });

  it("consulta contactos reales del GET después de crear, sin sembrar detalle", async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(`${api}/companies/:companyId`, async () => {
        await pending;
        return HttpResponse.json({
          ...company,
          contacts: [
            {
              id: "contact-1",
              first_name: "Ana",
              last_name: "López",
              position: "Compras",
              email: "ana@supra.test",
              phone: null,
            },
          ],
        });
      }),
    );
    renderAuthenticated();
    fireEvent.change(await screen.findByLabelText(/razón social/i), {
      target: { value: "Demo" },
    });
    fireEvent.click(screen.getByRole("button", { name: /crear empresa/i }));
    try {
      expect(
        await screen.findByRole("heading", { name: /cargando empresa/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/todavía no hay contactos/i),
      ).not.toBeInTheDocument();
    } finally {
      release();
    }
    expect(await screen.findByText("Ana López")).toBeInTheDocument();
  });

  it("envía opcionales vacíos como null y evita duplicar POST pendiente", async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post(`${api}/companies`, async ({ request }) => {
        companyPosts += 1;
        postBody = await request.json();
        await pending;
        return HttpResponse.json(company, { status: 201 });
      }),
    );
    renderAuthenticated();
    const legal = await screen.findByLabelText(/razón social/i);
    fireEvent.change(legal, { target: { value: " Demo " } });
    fireEvent.change(screen.getByLabelText(/nombre comercial/i), {
      target: { value: "   " },
    });
    const form = legal.closest("form")!;
    fireEvent.submit(form);
    await waitFor(() => expect(companyPosts).toBe(1));
    try {
      expect(screen.getByRole("button", { name: /creando/i })).toBeDisabled();
      fireEvent.submit(form);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(legal).toBeDisabled();
      expect(companyPosts).toBe(1);
      expect(postBody).toEqual({
        legal_name: "Demo",
        trade_name: null,
        tax_id: null,
      });
    } finally {
      release();
    }
    await screen.findByRole("heading", { name: "SUPRA Demo SA" });
    expect(companyPosts).toBe(1);
  });

  it("borra variables y resultados de creación al salir", async () => {
    renderAuthenticated();
    fireEvent.change(await screen.findByLabelText(/razón social/i), {
      target: { value: company.legal_name },
    });
    fireEvent.click(screen.getByRole("button", { name: /crear empresa/i }));
    await screen.findByRole("heading", { name: company.legal_name });
    expect(queryClient.getMutationCache().getAll()[0].state.variables).toEqual({
      legal_name: company.legal_name,
      trade_name: null,
      tax_id: null,
    });
    expect(queryClient.getMutationCache().getAll()[0].state.data).toEqual(
      company,
    );
    fireEvent.click(screen.getByRole("button", { name: /cerrar sesión/i }));
    await screen.findByRole("heading", { name: /iniciar sesión/i });
    expect(queryClient.getMutationCache().getAll()).toEqual([]);
  });

  it.each([false, true])(
    "ignora POST pendiente tras salir, nueva sesión: %s",
    async (relogin) => {
      let release!: () => void;
      const pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      let detailGets = 0;
      server.use(
        http.post(`${api}/companies`, async () => {
          companyPosts += 1;
          await pending;
          return HttpResponse.json(company, { status: 201 });
        }),
        http.get(`${api}/companies/:companyId`, () => {
          detailGets += 1;
          return HttpResponse.json({ ...company, contacts: [] });
        }),
        http.post(`${api}/auth/login`, () =>
          HttpResponse.json({
            access_token: "token-secreto",
            token_type: "bearer",
            expires_at: "2025-02-01T00:00:00Z",
            expires_in: 3600,
          }),
        ),
      );
      renderAuthenticated();
      fireEvent.change(await screen.findByLabelText(/razón social/i), {
        target: { value: company.legal_name },
      });
      fireEvent.click(screen.getByRole("button", { name: /crear empresa/i }));
      await waitFor(() => expect(companyPosts).toBe(1));
      const mutation = queryClient.getMutationCache().getAll()[0];
      try {
        fireEvent.click(screen.getByRole("button", { name: /cerrar sesión/i }));
        await screen.findByRole("heading", { name: /iniciar sesión/i });
        if (relogin) {
          fireEvent.change(screen.getByLabelText(/correo/i), {
            target: { value: user.email },
          });
          fireEvent.change(screen.getByLabelText(/contraseña/i), {
            target: { value: "clave" },
          });
          fireEvent.click(screen.getByRole("button", { name: /ingresar/i }));
          await screen.findByRole("heading", { name: "Inicio" });
        }
        release();
        await waitFor(() => expect(mutation.state.status).toBe("success"));
        expect(window.location.pathname).toBe(relogin ? "/" : "/login");
        expect(detailGets).toBe(0);
        expect(queryClient.getQueriesData({ queryKey: ["company"] })).toEqual(
          [],
        );
        expect(
          queryClient
            .getMutationCache()
            .getAll()
            .some(
              (entry) =>
                (entry.state.data as { id?: string } | undefined)?.id ===
                  company.id ||
                (entry.state.variables as { legal_name?: string } | undefined)
                  ?.legal_name === company.legal_name,
            ),
        ).toBe(false);
      } finally {
        release();
      }
    },
  );

  it("deshabilita reintentar mientras la consulta está pendiente", async () => {
    server.use(
      http.get(
        `${api}/companies/:companyId`,
        () => new HttpResponse(null, { status: 404 }),
      ),
    );
    renderAuthenticated(`/empresas/${company.id}`);
    await screen.findByRole("alert");
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let gets = 0;
    server.use(
      http.get(`${api}/companies/:companyId`, async () => {
        gets += 1;
        await pending;
        return HttpResponse.json({ ...company, contacts: [] });
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    try {
      await waitFor(() => expect(gets).toBe(1));
      const retry = screen.getByRole("button", { name: /reintentando/i });
      expect(retry).toBeDisabled();
      fireEvent.click(retry);
      expect(gets).toBe(1);
    } finally {
      release();
    }
    await screen.findByRole("heading", { name: company.legal_name });
    expect(gets).toBe(1);
  });

  it.each(["logout", "auth-clear"])(
    "borra caché de empresas al terminar sesión: %s",
    async (mode) => {
      renderAuthenticated(`/empresas/${company.id}`);
      await screen.findByRole("heading", { name: company.legal_name });
      expect(queryClient.getQueryData(["company", company.id])).toBeDefined();
      if (mode === "logout")
        fireEvent.click(screen.getByRole("button", { name: /cerrar sesión/i }));
      else setAccessToken(null);
      await screen.findByRole("heading", { name: /iniciar sesión/i });
      expect(queryClient.getQueryData(["company", company.id])).toBeUndefined();
      expect(getAccessToken()).toBeNull();
    },
  );

  it.each(["POST", "GET"])(
    "limpia token y redirige ante company401: %s",
    async (method) => {
      server.use(
        method === "POST"
          ? http.post(
              `${api}/companies`,
              () => new HttpResponse(null, { status: 401 }),
            )
          : http.get(
              `${api}/companies/:companyId`,
              () => new HttpResponse(null, { status: 401 }),
            ),
      );
      renderAuthenticated(
        method === "POST" ? "/empresas" : "/empresas/unauthorized",
      );
      if (method === "POST") {
        fireEvent.change(await screen.findByLabelText(/razón social/i), {
          target: { value: "Demo" },
        });
        fireEvent.click(screen.getByRole("button", { name: /crear empresa/i }));
      }
      await screen.findByRole("heading", { name: /iniciar sesión/i });
      expect(getAccessToken()).toBeNull();
      expect(queryClient.getQueriesData({ queryKey: ["company"] })).toEqual([]);
    },
  );

  it("conserva el formulario ante red fallida en POST y permite recuperarse", async () => {
    server.use(http.post(`${api}/companies`, () => HttpResponse.error()));
    renderAuthenticated();
    const legal = await screen.findByLabelText(/razón social/i);
    fireEvent.change(legal, { target: { value: "Demo" } });
    fireEvent.click(screen.getByRole("button", { name: /crear empresa/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/conexión/i);
    expect(legal).toHaveValue("Demo");
    expect(screen.queryByText(/failed to fetch/i)).not.toBeInTheDocument();
    server.resetHandlers();
    fireEvent.click(screen.getByRole("button", { name: /crear empresa/i }));
    await screen.findByRole("heading", { name: company.legal_name });
  });

  it("valida razón social en blanco antes de enviar", async () => {
    renderAuthenticated();

    fireEvent.change(await screen.findByLabelText(/razón social/i), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: /crear empresa/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/razón social/i);
    expect(companyPosts).toBe(0);
  });

  it("permite consultar por ID cuando no existe listado", async () => {
    renderAuthenticated();

    fireEvent.change(await screen.findByLabelText(/id de empresa/i), {
      target: { value: "22222222-2222-2222-2222-222222222222" },
    });
    fireEvent.click(screen.getByRole("button", { name: /ver detalle/i }));

    expect(
      await screen.findByRole("heading", { name: "SUPRA Demo SA" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe(
      "/empresas/22222222-2222-2222-2222-222222222222",
    );
  });

  it("muestra errores seguros para duplicados, validación y empresa no encontrada", async () => {
    server.use(
      http.post(`${api}/companies`, () =>
        HttpResponse.json({ detail: "duplicate tax" }, { status: 409 }),
      ),
    );
    renderAuthenticated();

    fireEvent.change(await screen.findByLabelText(/razón social/i), {
      target: { value: "Demo" },
    });
    fireEvent.click(screen.getByRole("button", { name: /crear empresa/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /fiscal ya existe/i,
    );

    server.use(
      http.post(`${api}/companies`, () =>
        HttpResponse.json({ detail: "validation internals" }, { status: 422 }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /crear empresa/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /revisa los datos/i,
    );
  });

  it("muestra empresa no encontrada sin detalles internos", async () => {
    server.use(
      http.get(
        `${api}/companies/:companyId`,
        () => new HttpResponse(null, { status: 404 }),
      ),
    );
    renderAuthenticated("/empresas/no-existe");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /no encontramos esa empresa/i,
    );
  });

  it("maneja fallos de red sin mostrar detalles internos", async () => {
    server.use(
      http.get(`${api}/companies/:companyId`, () => HttpResponse.error()),
    );
    renderAuthenticated("/empresas/red-caida");

    expect(await screen.findByRole("alert")).toHaveTextContent(/conexión/i);
    expect(screen.queryByText(/failed to fetch/i)).not.toBeInTheDocument();
    server.resetHandlers();
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(
      await screen.findByRole("heading", { name: company.legal_name }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
