import {
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
import { getAccessToken, setAccessToken } from "../api/client";

const base = "http://localhost:8000/api/v1";
const company = {
  id: "company-a",
  legal_name: "SUPRA",
  trade_name: null,
  tax_id: null,
  created_at: "2025-01-01T00:00:00Z",
};
const contact = {
  id: "contact-a",
  first_name: "Ana",
  last_name: "López",
  email: "ana@supra.test",
  phone: "555123",
  position: "Compras",
};
let posts = 0;
let gets = 0;
let body: unknown;
let saved = false;
const server = setupServer(
  http.get(`${base}/users/me`, () =>
    HttpResponse.json({
      id: "1",
      email: "admin@supra.test",
      role: "admin",
      is_active: true,
      created_at: company.created_at,
    }),
  ),
  http.get(`${base}/companies/:id`, ({ params }) => {
    gets++;
    return HttpResponse.json({
      ...company,
      id: params.id,
      contacts: saved ? [contact] : [],
    });
  }),
  http.post(`${base}/companies/:id/contacts`, async ({ request }) => {
    posts++;
    body = await request.json();
    saved = true;
    return HttpResponse.json(
      { ...contact, first_name: "NO USAR POST" },
      { status: 201 },
    );
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
  saved = false;
  window.history.replaceState({}, "", "/");
});
function open() {
  setAccessToken("same-token");
  window.history.replaceState({}, "", "/empresas/company-a");
  render(<App />);
}
async function fill(channel = "phone") {
  fireEvent.change(await screen.findByLabelText(/^nombre/i), {
    target: { value: " Ana " },
  });
  fireEvent.change(screen.getByLabelText(/^apellidos/i), {
    target: { value: " López " },
  });
  fireEvent.change(
    screen.getByLabelText(channel === "phone" ? /^teléfono/i : /^correo/i),
    {
      target: { value: channel === "phone" ? " 555123 " : " ana@supra.test " },
    },
  );
}
function submit() {
  fireEvent.submit(screen.getByLabelText(/^nombre/i).closest("form")!);
}

it("Contactos ofrece lookup honesto sin empresa seleccionada", async () => {
  open();
  await screen.findByLabelText(/^nombre/i);
  fireEvent.click(screen.getByRole("link", { name: /^contactos$/i }));
  expect(
    await screen.findByRole("heading", { name: "Contactos por empresa" }),
  ).toBeInTheDocument();
  expect(screen.getByText(/no existe un listado global/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /abrir contactos/i }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/ID de empresa/i);
  fireEvent.change(screen.getByLabelText(/ID de empresa/i), {
    target: { value: " company-b " },
  });
  fireEvent.click(screen.getByRole("button", { name: /abrir contactos/i }));
  await screen.findByLabelText(/^nombre/i);
  expect(window.location.pathname).toBe("/empresas/company-b");
  expect(window.location.hash).toBe("#contactos");
});

it.each(["first", "last", "neither", "email"])(
  "valida %s antes de POST y enfoca error",
  async (kind) => {
    open();
    await fill();
    if (kind === "first" || kind === "last")
      fireEvent.change(
        screen.getByLabelText(kind === "first" ? /^nombre/i : /^apellidos/i),
        { target: { value: "   " } },
      );
    if (kind === "neither")
      fireEvent.change(screen.getByLabelText(/^teléfono/i), {
        target: { value: " " },
      });
    if (kind === "email")
      fireEvent.change(screen.getByLabelText(/^correo/i), {
        target: { value: "incorrecto" },
      });
    submit();
    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent(
      kind === "first"
        ? /nombre/i
        : kind === "last"
          ? /apellidos/i
          : kind === "neither"
            ? /correo.*teléfono/i
            : /correo.*válido/i,
    );
    expect(error).toHaveFocus();
    expect(posts).toBe(0);
  },
);
it.each(["phone", "email"])(
  "envía %s limpio con null y refresca GET real",
  async (channel) => {
    open();
    await fill(channel);
    fireEvent.change(screen.getByLabelText(/^puesto/i), {
      target: { value: "  " },
    });
    submit();
    expect(await screen.findByRole("status")).toHaveTextContent(/guardado/i);
    expect(await screen.findByText("Ana López")).toBeInTheDocument();
    expect(screen.getByText(contact.email)).toBeInTheDocument();
    expect(screen.getByText(contact.phone)).toBeInTheDocument();
    expect(screen.getByText("Compras")).toBeInTheDocument();
    expect(body).toEqual({
      first_name: "Ana",
      last_name: "López",
      email: channel === "email" ? "ana@supra.test" : null,
      phone: channel === "phone" ? "555123" : null,
      position: null,
    });
    expect(screen.getByLabelText(/^nombre/i)).toHaveValue("");
    expect(gets).toBe(2);
    expect(screen.queryByText(/NO USAR POST/)).not.toBeInTheDocument();
  },
);
it("bloquea doble envío y conserva campos mientras POST está pendiente", async () => {
  let release!: () => void;
  const pending = new Promise<void>((r) => {
    release = r;
  });
  server.use(
    http.post(`${base}/companies/:id/contacts`, async () => {
      posts++;
      await pending;
      return HttpResponse.json(contact, { status: 201 });
    }),
  );
  open();
  await fill();
  submit();
  await waitFor(() => expect(posts).toBe(1));
  try {
    expect(screen.getByRole("button", { name: /guardando/i })).toBeDisabled();
    expect(screen.getByLabelText(/^nombre/i)).toBeDisabled();
    submit();
    expect(posts).toBe(1);
    expect(screen.getByLabelText(/^nombre/i)).toHaveValue(" Ana ");
  } finally {
    release();
  }
  await screen.findByRole("status");
  expect(posts).toBe(1);
});
it.each([422, 404, "network"])(
  "error seguro %s conserva datos y admite retry",
  async (status) => {
    server.use(
      http.post(`${base}/companies/:id/contacts`, () =>
        status === "network"
          ? HttpResponse.error()
          : HttpResponse.json(
              { detail: "PRIVATE INTERNALS" },
              { status: Number(status) },
            ),
      ),
    );
    open();
    await fill();
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      status === 422 ? /revisa/i : status === 404 ? /empresa/i : /conexión/i,
    );
    expect(screen.getByLabelText(/^nombre/i)).toHaveValue(" Ana ");
    expect(screen.queryByText(/PRIVATE INTERNALS/)).not.toBeInTheDocument();
    server.resetHandlers();
    submit();
    await screen.findByRole("status");
  },
);
it("401 limpia sesión, consultas y mutaciones", async () => {
  server.use(
    http.post(
      `${base}/companies/:id/contacts`,
      () => new HttpResponse(null, { status: 401 }),
    ),
  );
  open();
  await fill();
  submit();
  await screen.findByRole("heading", { name: /iniciar sesión/i });
  expect(getAccessToken()).toBeNull();
  expect(queryClient.getQueriesData({ queryKey: ["company"] })).toEqual([]);
  expect(queryClient.getMutationCache().getAll()).toEqual([]);
});
it("guardado con refresh fallido no es fallo de POST y retry solo GET", async () => {
  open();
  await fill();
  server.use(
    http.get(`${base}/companies/:id`, () => {
      gets++;
      return HttpResponse.error();
    }),
  );
  submit();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    /guardado.*actualizar/i,
  );
  expect(screen.getByLabelText(/^nombre/i)).toHaveValue("");
  expect(posts).toBe(1);
  expect(
    screen.queryByText(/todavía no hay contactos/i),
  ).not.toBeInTheDocument();
  server.resetHandlers();
  fireEvent.click(
    screen.getByRole("button", { name: /actualizar contactos/i }),
  );
  await screen.findByText("Ana López");
  await waitFor(() =>
    expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
  );
  expect(posts).toBe(1);
});
it.each(["logout", "navigation", "company-change", "new-session"])(
  "ignora callback tardío: %s",
  async (mode) => {
    let release!: () => void;
    const pending = new Promise<void>((r) => {
      release = r;
    });
    server.use(
      http.post(`${base}/companies/:id/contacts`, async () => {
        posts++;
        await pending;
        return HttpResponse.json(contact, { status: 201 });
      }),
    );
    open();
    await fill();
    submit();
    await waitFor(() => expect(posts).toBe(1));
    const mutation = queryClient.getMutationCache().getAll()[0];
    try {
      if (mode === "logout" || mode === "new-session") {
        fireEvent.click(screen.getByRole("button", { name: /cerrar sesión/i }));
        await screen.findByRole("heading", { name: /iniciar sesión/i });
        if (mode === "new-session") {
          cleanup();
          open();
          await screen.findByLabelText(/^nombre/i);
        }
      } else if (mode === "navigation") {
        fireEvent.click(screen.getByRole("link", { name: /^empresas$/i }));
        await screen.findByRole("heading", { name: /crear empresa/i });
      } else {
        window.history.pushState({}, "", "/empresas/company-b");
        window.dispatchEvent(new PopStateEvent("popstate"));
        await waitFor(() =>
          expect(screen.getByText("company-b")).toBeInTheDocument(),
        );
      }
      const before = gets;
      release();
      await waitFor(() => expect(mutation.state.status).toBe("success"));
      expect(gets).toBe(before);
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      if (mode === "new-session" || mode === "company-change")
        expect(screen.getByLabelText(/^nombre/i)).toHaveValue("");
    } finally {
      release();
    }
  },
);
