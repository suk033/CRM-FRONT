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
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { optionLabels } from "./select";
import { App, queryClient } from "../App";
import { setAccessToken } from "../api/client";

const api = "http://localhost:8000/api/v1";
const advisor = {
  id: "1",
  email: "luis.rojas@supra.test",
  role: "advisor",
  is_active: true,
  created_at: "2025-01-01T00:00:00Z",
};
let currentUser = advisor;

// Local times so day grouping does not depend on the machine's timezone.
const at = (day: number, hour: number) =>
  new Date(2026, 2, day, hour, 0, 0).toISOString();

function activity(
  id: string,
  title: string,
  due_at: string,
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    company_id: "c1",
    company_name: "Café Andino",
    requirement_id: null,
    requirement_code: null,
    owner_id: "1",
    owner_email: advisor.email,
    kind: "meeting",
    title,
    notes: null,
    due_at,
    status: "pending",
    completed_at: null,
    created_at: at(1, 8),
    overdue: false,
    ...extra,
  };
}

const pending = [
  activity("a3", "Visita al local de Miraflores", at(12, 10)),
  activity("a1", "Llamar a gerencia", at(9, 11), { overdue: true }),
  activity("a2", "Reunión de presentación", at(10, 15)),
  activity("a4", "Enviar propuesta final", at(25, 10)),
];
const done = [
  activity("d1", "Correo de bienvenida", at(5, 9), {
    status: "done",
    completed_at: at(5, 10),
  }),
];
const overview = {
  total: 3,
  active: 2,
  items: [
    {
      id: "c1",
      legal_name: "Café Andino S.A.C.",
      trade_name: "Café Andino",
      tax_id: null,
      assigned_advisor_id: "1",
      assigned_advisor_email: advisor.email,
      status: "active",
      open_requirements: 2,
      total_requirements: 3,
      pending_activities: 4,
      overdue_activities: 1,
      last_activity_at: at(5, 10),
      next_activity_at: at(10, 15),
    },
    {
      id: "c2",
      legal_name: "Textiles del Sur S.A.",
      trade_name: null,
      tax_id: null,
      assigned_advisor_id: "1",
      assigned_advisor_email: advisor.email,
      status: "active",
      open_requirements: 3,
      total_requirements: 3,
      pending_activities: 0,
      overdue_activities: 0,
      last_activity_at: null,
      next_activity_at: null,
    },
    {
      id: "c3",
      legal_name: "Ferretería Lima",
      trade_name: null,
      tax_id: null,
      assigned_advisor_id: "1",
      assigned_advisor_email: advisor.email,
      status: "inactive",
      open_requirements: 0,
      total_requirements: 1,
      pending_activities: 0,
      overdue_activities: 0,
      last_activity_at: null,
      next_activity_at: null,
    },
  ],
};
let patches: unknown[] = [];

const server = setupServer(
  http.get(`${api}/users/me`, () => HttpResponse.json(currentUser)),
  http.get(`${api}/activities`, ({ request }) => {
    const status = new URL(request.url).searchParams.get("status");
    const items = status === "done" ? done : pending;
    return HttpResponse.json({ items, total: items.length });
  }),
  http.get(`${api}/companies/overview`, () => HttpResponse.json(overview)),
  http.patch(`${api}/activities/:id`, async ({ request, params }) => {
    const body = await request.json();
    patches.push({ id: params.id, body });
    return HttpResponse.json({
      ...pending.find((a) => a.id === params.id),
      status: "done",
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 2, 10, 9, 0, 0));
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
  setAccessToken(null);
  queryClient.clear();
  server.resetHandlers();
  currentUser = advisor;
  patches = [];
  window.history.replaceState({}, "", "/");
});
afterAll(() => server.close());

function renderHome() {
  setAccessToken("token");
  window.history.replaceState({}, "", "/");
  render(<App />);
}

function group(name: RegExp) {
  return screen.getByRole("region", { name }) as HTMLElement;
}

describe("Inicio", () => {
  it("saluda al asesor y agrupa pendientes en vencidas, hoy y próximas", async () => {
    renderHome();
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Hola, luis.rojas",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/estos son tus pendientes/)).toHaveTextContent(
      /^Asesor ·/,
    );
    await screen.findByText("Llamar a gerencia");

    const overdue = group(/^Vencidas/);
    expect(within(overdue).getAllByRole("listitem")).toHaveLength(1);
    expect(overdue).toHaveTextContent("Llamar a gerencia");

    const today = group(/^Hoy/);
    expect(within(today).getAllByRole("listitem")).toHaveLength(1);
    expect(today).toHaveTextContent("Reunión de presentación");

    const upcoming = group(/^Próximas/);
    const rows = within(upcoming).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Visita al local de Miraflores"),
      expect.stringContaining("Enviar propuesta final"),
    ]);
    expect(
      screen.queryByRole("link", { name: /rendimiento del equipo/i }),
    ).not.toBeInTheDocument();
  });

  it("muestra KPIs de vencidas, hoy, 7 días, empresas activas y requerimientos", async () => {
    renderHome();
    await screen.findByText("Llamar a gerencia");
    const tiles = screen.getByLabelText("Indicadores");
    await waitFor(() =>
      expect(
        within(tiles).getByText("Empresas activas").nextSibling,
      ).toHaveTextContent("2"),
    );
    const value = (label: string) =>
      within(tiles).getByText(label).nextSibling?.textContent;
    expect(value("Vencidas")).toBe("1");
    expect(value("Para hoy")).toBe("1");
    expect(value("Próximos 7 días")).toBe("1");
    expect(value("Requerimientos abiertos")).toBe("5");
  });

  it("completar una actividad envía PATCH status done", async () => {
    renderHome();
    fireEvent.click(
      await screen.findByRole("checkbox", {
        name: "Completar: Reunión de presentación",
      }),
    );
    const dialog = screen.getByRole("alertdialog", {
      name: "¿Marcar como completada?",
    });
    expect(patches).toEqual([]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(patches).toEqual([]);

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Completar: Reunión de presentación",
      }),
    );
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Sí, completar",
      }),
    );
    await waitFor(() =>
      expect(patches).toEqual([{ id: "a2", body: { status: "done" } }]),
    );
    expect(
      await screen.findByText(
        '"Reunión de presentación" se registró como completada.',
      ),
    ).toBeInTheDocument();
  });

  it("lista empresas que requieren atención, completadas y el formulario por empresa", async () => {
    renderHome();
    const attention = await screen.findByRole("region", {
      name: "Empresas que requieren atención",
    });
    await within(attention).findByRole("link", { name: "Café Andino" });
    expect(
      within(attention).getByRole("link", { name: "Café Andino" }),
    ).toHaveAttribute("href", "/empresas/c1");
    expect(attention).toHaveTextContent("1 vencida");
    expect(
      within(attention).getByRole("link", { name: "Textiles del Sur S.A." }),
    ).toHaveAttribute("href", "/empresas/c2");
    expect(attention).not.toHaveTextContent("Ferretería Lima");

    const completed = screen.getByRole("region", {
      name: "Completadas recientemente",
    });
    expect(
      await within(completed).findByText("Correo de bienvenida"),
    ).toBeInTheDocument();

    const form = screen.getByRole("form", { name: "Nueva actividad" });
    expect(
      within(form).getByRole("combobox", { name: "Empresa" }),
    ).toHaveTextContent("Selecciona una empresa");
    expect(optionLabels("Empresa", form)).toEqual([
      "Café Andino",
      "Textiles del Sur S.A.",
      "Ferretería Lima",
    ]);
  });

  it("el administrador ve el trabajo del equipo y un enlace al rendimiento", async () => {
    currentUser = { ...advisor, email: "ana@supra.test", role: "admin" };
    renderHome();
    expect(
      await screen.findByRole("heading", { name: "Pendientes del equipo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver rendimiento del equipo" }),
    ).toHaveAttribute("href", "/perfil?seccion=rendimiento");
  });

  it("muestra el error de la API sin inventar pendientes", async () => {
    server.use(
      http.get(`${api}/activities`, () =>
        HttpResponse.json({ detail: "fallo" }, { status: 500 }),
      ),
    );
    renderHome();
    expect((await screen.findAllByRole("alert")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Llamar a gerencia")).not.toBeInTheDocument();
  });
});
