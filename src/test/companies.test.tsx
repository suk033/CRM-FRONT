import { fireEvent, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { App } from "../App";
import { setAccessToken } from "../api/client";

const api = "http://localhost:8000/api/v1";
const user = {
  id: "user-1",
  email: "ana@supra.test",
  role: "advisor" as const,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
};
const company = {
  id: "company-1",
  legal_name: "Acme Holdings",
  trade_name: "Acme",
  tax_id: "AB-123",
  created_at: "2026-01-01T00:00:00Z",
};
let contacts: Array<{
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  created_at: string;
}> = [];

const server = setupServer(
  http.get(`${api}/users/me`, () => HttpResponse.json(user)),
  http.get(`${api}/companies`, () =>
    HttpResponse.json({ items: [company], page: 1, page_size: 12, total: 1 }),
  ),
  http.post(`${api}/companies`, () =>
    HttpResponse.json(company, { status: 201 }),
  ),
  http.get(`${api}/companies/:companyId`, () =>
    HttpResponse.json({ ...company, contacts }),
  ),
  http.post(`${api}/companies/:companyId/contacts`, async ({ request }) => {
    const body = (await request.json()) as {
      first_name: string;
      last_name: string;
      email?: string;
      phone?: string;
      position?: string;
    };
    const contact = {
      id: `contact-${contacts.length + 1}`,
      company_id: "company-1",
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email ?? null,
      phone: body.phone ?? null,
      position: body.position ?? null,
      created_at: "2026-01-01T00:00:00Z",
    };
    contacts = [...contacts, contact];
    return HttpResponse.json(contact, { status: 201 });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  contacts = [];
  setAccessToken(null);
  server.resetHandlers();
  window.history.replaceState({}, "", "/");
});
afterAll(() => server.close());

function renderAuthenticated(path: string) {
  window.history.replaceState({}, "", path);
  setAccessToken("token");
  render(<App />);
}

describe("empresas y contactos", () => {
  it("muestra empresas desde el listado protegido", async () => {
    renderAuthenticated("/empresas");

    expect(
      await screen.findByRole("heading", { name: "Empresas" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: /Acme Holdings/ }),
    ).toHaveAttribute("href", "/empresas/company-1");
    expect(screen.getByText("1 empresas encontradas")).toBeInTheDocument();
  });

  it("crea una empresa y agrega un contacto", async () => {
    renderAuthenticated("/empresas/nueva");

    fireEvent.change(await screen.findByLabelText("Nombre legal"), {
      target: { value: "Acme Holdings" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear empresa" }));
    expect(
      await screen.findByRole("heading", { name: "Acme Holdings" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByLabelText("Apellido"), {
      target: { value: "Lovelace" },
    });
    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "ada@acme.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Agregar contacto" }));

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@acme.test")).toBeInTheDocument();
  });
});
