import {
  cleanup,
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
import { setAccessToken } from "../api/client";
import { chooseOption } from "./select";

const api = "http://localhost:8000/api/v1";
const admin = {
  id: "u-admin",
  email: "admin@supra.test",
  role: "admin",
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
};
const advisor = {
  id: "u-ana",
  email: "ana@supra.test",
  role: "advisor",
  is_active: true,
  created_at: "2026-02-01T00:00:00Z",
};
const luis = {
  id: "u-luis",
  email: "luis@supra.test",
  role: "advisor",
  is_active: true,
  created_at: "2026-03-01T00:00:00Z",
};
let users = [admin, advisor, luis];
const created: unknown[] = [];
const patches: { id: string; body: unknown }[] = [];
const assignments: { id: string; body: unknown }[] = [];
let patchStatus = 200;

const company = {
  id: "c-1",
  legal_name: "Banco Andino S.A.",
  trade_name: "Banco Andino",
  tax_id: "20100000001",
  assigned_advisor_id: "u-ana",
  assigned_advisor_email: "ana@supra.test",
  status: "active",
  open_requirements: 2,
  total_requirements: 3,
  pending_activities: 1,
  overdue_activities: 0,
  last_activity_at: null,
  next_activity_at: null,
};

const server = setupServer(
  http.get(`${api}/users/me`, () => HttpResponse.json(admin)),
  http.get(`${api}/users`, () => HttpResponse.json({ items: users })),
  http.post(`${api}/users`, async ({ request }) => {
    const body = (await request.json()) as { email: string; role: string };
    created.push(body);
    const user = {
      id: "u-new",
      email: body.email,
      role: body.role,
      is_active: true,
      created_at: "2026-11-15T00:00:00Z",
    };
    users = [...users, user];
    return HttpResponse.json(user, { status: 201 });
  }),
  http.patch(`${api}/users/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    patches.push({ id: String(params.id), body });
    if (patchStatus !== 200)
      return HttpResponse.json(
        { detail: "at least one active admin is required" },
        { status: patchStatus },
      );
    users = users.map((user) =>
      user.id === params.id ? { ...user, ...body } : user,
    );
    return HttpResponse.json(users.find((user) => user.id === params.id));
  }),
  http.get(`${api}/companies/overview`, () =>
    HttpResponse.json({ items: [company], total: 1, active: 1 }),
  ),
  http.put(`${api}/companies/:id/assignment`, async ({ request, params }) => {
    const body = await request.json();
    assignments.push({ id: String(params.id), body });
    return HttpResponse.json({
      company_id: params.id,
      assigned_advisor_id: "u-luis",
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  setAccessToken(null);
  queryClient.clear();
  server.resetHandlers();
  users = [admin, advisor, luis];
  created.length = 0;
  patches.length = 0;
  assignments.length = 0;
  patchStatus = 200;
  window.history.replaceState({}, "", "/");
});
afterAll(() => server.close());

function open(path: string) {
  setAccessToken("token");
  window.history.replaceState({}, "", path);
  render(<App />);
}

describe("acciones del administrador", () => {
  it("crea un usuario con validación en la página y aviso de éxito", async () => {
    open("/perfil?seccion=usuarios");
    await screen.findByRole("button", { name: "Desactivar ana@supra.test" });
    const form = screen.getByRole("form", { name: "Nuevo usuario" });

    fireEvent.click(
      within(form).getByRole("button", { name: "Crear usuario" }),
    );
    expect(
      within(form).getByText("Ingresa un correo válido."),
    ).toBeInTheDocument();
    expect(
      within(form).getByText(
        "La contraseña debe tener al menos 12 caracteres.",
      ),
    ).toBeInTheDocument();
    expect(created).toEqual([]);

    fireEvent.change(within(form).getByLabelText(/^Correo/), {
      target: { value: " nuevo@supra.test " },
    });
    fireEvent.change(within(form).getByLabelText(/^Contraseña inicial/), {
      target: { value: "una clave bien larga" },
    });
    chooseOption("Rol", "Administrador", form);
    fireEvent.click(
      within(form).getByRole("button", { name: "Crear usuario" }),
    );

    await waitFor(() =>
      expect(created).toEqual([
        {
          email: "nuevo@supra.test",
          password: "una clave bien larga",
          role: "admin",
        },
      ]),
    );
    expect(
      await screen.findByText(
        "Usuario nuevo@supra.test creado como administrador.",
      ),
    ).toBeInTheDocument();
  });

  it("desactiva un usuario solo después de confirmar y no permite tocar la propia cuenta", async () => {
    open("/perfil?seccion=usuarios");
    await screen.findByRole("button", { name: "Desactivar ana@supra.test" });
    expect(
      screen.getByRole("button", { name: "Desactivar admin@supra.test" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Hacer asesor admin@supra.test" }),
    ).toBeDisabled();

    fireEvent.click(
      screen.getByRole("button", { name: "Desactivar ana@supra.test" }),
    );
    const dialog = screen.getByRole("alertdialog", {
      name: "¿Desactivar usuario?",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(patches).toEqual([]);

    fireEvent.click(
      screen.getByRole("button", { name: "Desactivar ana@supra.test" }),
    );
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Confirmar",
      }),
    );
    await waitFor(() =>
      expect(patches).toEqual([{ id: "u-ana", body: { is_active: false } }]),
    );
    expect(
      await screen.findByText(
        "ana@supra.test: cambio registrado correctamente.",
      ),
    ).toBeInTheDocument();
  });

  it("traduce el rechazo del backend al cambiar un rol", async () => {
    patchStatus = 422;
    open("/perfil?seccion=usuarios");
    await screen.findByRole("button", { name: "Desactivar luis@supra.test" });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Hacer administrador luis@supra.test",
      }),
    );
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Confirmar",
      }),
    );
    expect(
      await screen.findByText("Debe quedar al menos un administrador activo."),
    ).toBeInTheDocument();
    expect(patches).toEqual([{ id: "u-luis", body: { role: "admin" } }]);
  });

  it("reasigna una empresa a otro asesor con confirmación", async () => {
    open("/perfil?seccion=asignacion");
    const reassign = await screen.findByRole("button", {
      name: "Reasignar Banco Andino",
    });
    expect(reassign).toBeDisabled();
    chooseOption("Nuevo asesor para Banco Andino", "luis@supra.test");
    fireEvent.click(reassign);
    const dialog = screen.getByRole("alertdialog", {
      name: "¿Reasignar la empresa?",
    });
    expect(dialog).toHaveTextContent("Banco Andino pasará a luis@supra.test.");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Sí, reasignar" }),
    );
    await waitFor(() =>
      expect(assignments).toEqual([
        { id: "c-1", body: { assigned_advisor_id: "u-luis" } },
      ]),
    );
    expect(
      await screen.findByText("Banco Andino quedó asignada a luis@supra.test."),
    ).toBeInTheDocument();
  });
});
