import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { App, queryClient } from "../App";
import { setAccessToken } from "../api/client";

const api = "http://localhost:8000/api/v1";
const company = {
  id: "company-new",
  legal_name: "Empresa confirmada",
  trade_name: null,
  tax_id: null,
  created_at: "2025-01-01T00:00:00Z",
};
let posts = 0;
let gets = 0;
let body: unknown;
const server = setupServer(
  http.get(`${api}/users/me`, () =>
    HttpResponse.json({
      id: "1",
      email: "test@example.test",
      role: "admin",
      is_active: true,
      created_at: company.created_at,
    }),
  ),
  http.post(`${api}/companies`, async ({ request }) => {
    posts++;
    body = await request.json();
    return HttpResponse.json(company, { status: 201 });
  }),
  http.get(`${api}/companies/:id`, () => {
    gets++;
    return HttpResponse.json({ ...company, contacts: [] });
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => {
  cleanup();
  setAccessToken(null);
  queryClient.clear();
  server.resetHandlers();
  posts = 0;
  gets = 0;
  body = undefined;
  window.history.replaceState({}, "", "/");
});
function openDetail(receipt?: unknown) {
  setAccessToken("same-token");
  window.history.replaceState(
    { usr: receipt },
    "",
    `/empresas/${company.id}?guided=contacto#contactos`,
  );
  render(<App />);
}
function open(auth = true) {
  if (auth) setAccessToken("same-token");
  window.history.replaceState({}, "", "/empresas/nueva");
  render(<App />);
}
async function fill(value = " Demo ") {
  const input = await screen.findByLabelText(/razón social/i);
  fireEvent.change(input, { target: { value } });
  return input.closest("form")!;
}

it("recupera la ficha tras POST aceptado solo con GET y bloquea reintentos pendientes", async () => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.get(`${api}/companies/:id`, async () => {
      gets++;
      if (gets === 1) return new HttpResponse(null, { status: 503 });
      await pending;
      return HttpResponse.json({ ...company, contacts: [] });
    }),
  );
  open();
  fireEvent.submit(await fill());
  await screen.findByText(
    "La empresa se creó, pero no pudimos consultar su ficha",
  );
  expect(screen.getByText(company.id)).toBeInTheDocument();
  expect(screen.getByText(/La empresa se conserva/i)).toBeInTheDocument();
  expect(screen.queryByLabelText(/^Nombre \*/)).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Guardar empresa/i }),
  ).not.toBeInTheDocument();
  const retry = screen.getByRole("button", { name: "Reintentar consulta" });
  try {
    act(() => {
      fireEvent.click(retry);
      fireEvent.click(retry);
    });
    await waitFor(() => expect(gets).toBe(2));
    expect(
      screen.getByRole("button", { name: "Reintentando…" }),
    ).toBeDisabled();
    expect(queryClient.getQueryData(["company", company.id])).toBeUndefined();
    expect(screen.queryByLabelText(/^Nombre \*/)).not.toBeInTheDocument();
    expect(posts).toBe(1);
  } finally {
    release();
  }
  await screen.findByRole("heading", { name: "Nueva empresa y contacto" });
  expect(screen.getByLabelText(/^Nombre \*/)).toBeInTheDocument();
  expect(gets).toBe(2);
  expect(posts).toBe(1);
});
it.each([
  undefined,
  { createdCompanyId: "other" },
  { createdCompanyId: 42 },
  company.id,
])(
  "no inventa creación con bookmark o recibo inválido: %j",
  async (receipt) => {
    server.use(
      http.get(`${api}/companies/:id`, () => {
        gets++;
        return HttpResponse.json({ detail: "private" }, { status: 404 });
      }),
    );
    openDetail(receipt);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No encontramos esa empresa.",
    );
    expect(
      screen.queryByText(/La empresa se creó|La empresa se conserva|guardada/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Nombre \*/)).not.toBeInTheDocument();
    expect(posts).toBe(0);
  },
);
it.each([false, true])(
  "confirma datos GET y reutiliza contacto con recuperación GET-only: %s",
  async (refreshFails) => {
    let contactPosts = 0;
    let contactBody: unknown;
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const contact = {
      id: "contact-server",
      company_id: company.id,
      first_name: "Ana",
      last_name: "Servidor",
      email: "ana@example.test",
      phone: null,
      position: "Gerente",
      created_at: company.created_at,
    };
    server.use(
      http.get(`${api}/companies/:id`, async () => {
        gets++;
        if (gets === 2) {
          await pending;
          if (refreshFails) return new HttpResponse(null, { status: 503 });
        }
        return HttpResponse.json({
          ...company,
          legal_name: "Razón del servidor",
          trade_name: "Marca del servidor",
          tax_id: "FISCAL-GET",
          contacts: gets === 1 ? [] : [contact],
        });
      }),
      http.post(`${api}/companies/:id/contacts`, async ({ request }) => {
        contactPosts++;
        contactBody = await request.json();
        return HttpResponse.json(
          { ...contact, first_name: "POST no autoritativo" },
          { status: 201 },
        );
      }),
    );
    open();
    fireEvent.submit(await fill());
    await screen.findByRole("heading", { name: "Nueva empresa y contacto" });
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("list", { name: /pasos/i })).toHaveTextContent(
      /1.*Empresa confirmada.*2.*Contacto/s,
    );
    expect(
      screen.getByText("Contacto", { selector: "li[aria-current=step]" }),
    ).toBeInTheDocument();
    for (const value of [
      "Razón del servidor",
      "Marca del servidor",
      "FISCAL-GET",
      company.id,
      new Date(company.created_at).toLocaleString("es-MX"),
    ])
      expect(screen.getByText(value)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "2. Contacto" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir a la ficha" })).toHaveAttribute(
      "href",
      `/empresas/${company.id}`,
    );
    expect(
      screen.queryByRole("link", { name: /Cancelar|Deshacer/i }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Nombre \*/), {
      target: { value: " Ana " },
    });
    fireEvent.change(screen.getByLabelText(/Apellidos/), {
      target: { value: " Servidor " },
    });
    fireEvent.change(screen.getByLabelText(/Correo electrónico/), {
      target: { value: " ana@example.test " },
    });
    fireEvent.change(screen.getByLabelText(/Puesto/), {
      target: { value: " Gerente " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar contacto" }));
    try {
      await waitFor(() => expect(gets).toBe(2));
      expect(contactBody).toEqual({
        first_name: "Ana",
        last_name: "Servidor",
        email: "ana@example.test",
        phone: null,
        position: "Gerente",
      });
      expect(screen.queryByText("Ana Servidor")).not.toBeInTheDocument();
      expect(
        screen.queryByText("POST no autoritativo"),
      ).not.toBeInTheDocument();
      expect(queryClient.getQueryData(["company", company.id])).toMatchObject({
        contacts: [],
      });
    } finally {
      release();
    }
    if (refreshFails) {
      expect(await screen.findByRole("alert")).toHaveTextContent(
        /Contacto guardado, pero no pudimos actualizar/i,
      );
      expect(
        screen.getByText(/lista puede estar desactualizada/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Guardar contacto" }),
      ).toBeDisabled();
      fireEvent.click(
        screen.getByRole("button", { name: "Actualizar contactos" }),
      );
    }
    await screen.findByText("Ana Servidor");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Detalle actualizado.",
    );
    expect(gets).toBe(refreshFails ? 3 : 2);
    expect(contactPosts).toBe(1);
    expect(posts).toBe(1);
  },
);

it("un bookmark confirma empresa solo al recibir GET y omite datos opcionales ausentes", async () => {
  openDetail();
  await screen.findByRole("heading", { name: "Nueva empresa y contacto" });
  expect(
    screen.getByRole("heading", { name: "1. Empresa confirmada" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(company.legal_name, { selector: "dd" }),
  ).toBeInTheDocument();
  expect(screen.queryByText("Nombre comercial")).not.toBeInTheDocument();
  expect(
    screen.queryByText("Identificación fiscal / RUC"),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText(/^Nombre \*/)).toBeInTheDocument();
  expect(posts).toBe(0);
  expect(gets).toBe(1);
});

it("protege la ruta estática", async () => {
  open(false);
  await screen.findByRole("heading", { name: /iniciar sesión/i });
  expect(gets).toBe(0);
});
it("muestra solo campos soportados, pasos honestos y navegación de salida", async () => {
  open();
  await screen.findByRole("heading", { name: "Nueva empresa" });
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.getAllByRole("textbox")).toHaveLength(3);
  expect(screen.getByLabelText(/razón social/i)).toBeRequired();
  expect(screen.getByLabelText(/razón social/i)).toHaveAttribute(
    "maxlength",
    "200",
  );
  expect(screen.getByLabelText(/nombre comercial/i)).toHaveAttribute(
    "maxlength",
    "200",
  );
  expect(screen.getByLabelText(/identificación fiscal/i)).toHaveAttribute(
    "maxlength",
    "50",
  );
  expect(screen.getByLabelText(/identificación fiscal/i)).not.toBeRequired();
  expect(screen.getByRole("list", { name: /pasos/i })).toHaveTextContent(
    /Empresa.*Contacto/s,
  );
  expect(
    screen.getByRole("heading", { name: /2. Contacto/i }),
  ).toBeInTheDocument();
  expect(screen.getByText(/Primero guardaremos/i)).toBeInTheDocument();
  expect(
    screen.queryByText(
      /Andrea|Sector|Sitio web|Responsable interno|Canal preferido|11 dígitos/i,
    ),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /volver/i })).toHaveAttribute(
    "href",
    "/empresas",
  );
  fireEvent.click(screen.getByRole("link", { name: "Cancelar" }));
  await screen.findByRole("heading", { name: "Crear empresa" });
  expect(posts).toBe(0);
  expect(gets).toBe(0);
});
it.each([false, true])(
  "guarda payload exacto y espera GET sin sembrar detalle, opcionales: %s",
  async (optional) => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(`${api}/companies/:id`, async () => {
        gets++;
        await pending;
        return HttpResponse.json({ ...company, contacts: [] });
      }),
    );
    open();
    const form = await fill();
    fireEvent.change(screen.getByLabelText(/nombre comercial/i), {
      target: { value: optional ? " Marca " : "   " },
    });
    fireEvent.change(screen.getByLabelText(/identificación fiscal/i), {
      target: { value: optional ? " AB-1 " : " " },
    });
    fireEvent.submit(form);
    try {
      await screen.findByRole("heading", { name: /cargando empresa/i });
      expect(body).toEqual({
        legal_name: "Demo",
        trade_name: optional ? "Marca" : null,
        tax_id: optional ? "AB-1" : null,
      });
      expect(window.location.pathname).toBe(`/empresas/${company.id}`);
      expect(window.location.search).toBe("?guided=contacto");
      expect(window.location.hash).toBe("#contactos");
      expect(window.history.state.usr).toEqual({
        createdCompanyId: company.id,
      });
      expect(queryClient.getQueryData(["company", company.id])).toBeUndefined();
      expect(screen.queryByLabelText(/nombres/i)).not.toBeInTheDocument();
    } finally {
      release();
    }
    await screen.findByRole("heading", { name: "Nueva empresa y contacto" });
    expect(posts).toBe(1);
    expect(gets).toBe(1);
  },
);
it("bloquea envíos simultáneos y deshabilita campos pendientes", async () => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.post(`${api}/companies`, async () => {
      posts++;
      await pending;
      return HttpResponse.json(company, { status: 201 });
    }),
  );
  open();
  const form = await fill();
  act(() => {
    fireEvent.submit(form);
    fireEvent.submit(form);
  });
  try {
    await waitFor(() => expect(posts).toBe(1));
    expect(screen.getByLabelText(/razón social/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: /guardando/i })).toBeDisabled();
    fireEvent.submit(form);
    expect(posts).toBe(1);
  } finally {
    release();
  }
  await screen.findByRole("heading", { name: "Nueva empresa y contacto" });
});
it.each([409, 422, "network"])(
  "muestra error seguro y enfocado: %s",
  async (status) => {
    server.use(
      http.post(`${api}/companies`, () =>
        status === "network"
          ? HttpResponse.error()
          : HttpResponse.json(
              { detail: "private internals" },
              { status: Number(status) },
            ),
      ),
    );
    open();
    const form = await fill();
    fireEvent.submit(form);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      status === 409
        ? /fiscal ya existe/i
        : status === 422
          ? /revisa los datos/i
          : /conexión/i,
    );
    expect(alert).toHaveFocus();
    expect(alert).not.toHaveTextContent(/private internals/i);
    expect(screen.getByLabelText(/razón social/i)).toHaveValue(" Demo ");
  },
);
it.each(["   ", "x".repeat(201)])(
  "valida razón social sin POST",
  async (value) => {
    open();
    const form = await fill(value);
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent(/razón social/i);
    expect(posts).toBe(0);
  },
);
it.each(["leave", "logout", "same-token"])(
  "ignora respuesta tardía: %s",
  async (mode) => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post(`${api}/companies`, async () => {
        posts++;
        await pending;
        return HttpResponse.json(company, { status: 201 });
      }),
    );
    open();
    const form = await fill();
    fireEvent.submit(form);
    await waitFor(() => expect(posts).toBe(1));
    const mutation = queryClient.getMutationCache().getAll()[0];
    try {
      if (mode === "leave") {
        fireEvent.click(screen.getByRole("link", { name: "Cancelar" }));
        await screen.findByRole("heading", { name: "Crear empresa" });
      } else {
        act(() => {
          setAccessToken(null);
          if (mode === "same-token") setAccessToken("same-token");
        });
        await screen.findByRole("heading", { name: /iniciar sesión/i });
      }
      release();
      await waitFor(() => expect(mutation.state.status).toBe("success"));
      expect(gets).toBe(0);
      expect(window.location.pathname).toBe(
        mode === "leave" ? "/empresas" : "/login",
      );
    } finally {
      release();
    }
  },
);
