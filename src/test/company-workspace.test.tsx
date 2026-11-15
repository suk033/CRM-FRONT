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

const api = "http://localhost:8000/api/v1";
const company = {
  id: "c-1",
  legal_name: "Café Andino SAC",
  trade_name: "Café Andino",
  tax_id: "20111222333",
  created_at: "2025-01-01T00:00:00Z",
  contacts: [
    {
      id: "k-1",
      first_name: "Lucía",
      last_name: "Paz",
      email: "lucia@andino.test",
      phone: null,
      position: "Gerente",
    },
  ],
};
const requirement = (id: string, status: string) => ({
  id,
  code: `REQ-${id}`,
  company_id: company.id,
  title: `Local ${id}`,
  property_type: "retail",
  city: "Lima",
  districts: ["Miraflores"],
  min_area_m2: 80,
  max_area_m2: 150,
  max_monthly_budget: 9000,
  required_features: [],
  status,
  created_at: "2025-01-01T00:00:00Z",
});
const activity = (
  id: string,
  title: string,
  status: string,
  overdue = false,
) => ({
  id,
  company_id: company.id,
  company_name: company.trade_name,
  requirement_id: null,
  requirement_code: null,
  owner_id: "1",
  owner_email: "ana@supra.test",
  kind: "meeting",
  title,
  notes: null,
  due_at: "2025-03-01T15:00:00Z",
  status,
  completed_at: null,
  created_at: "2025-01-01T00:00:00Z",
  overdue,
});
let activityBody: Record<string, unknown> | undefined;
let activityQueries: URLSearchParams[] = [];
let overviewGets = 0;
let activities = [
  activity("a-1", "Reunión de presentación", "pending", true),
  activity("a-2", "Visita a local", "pending"),
  activity("a-3", "Llamada inicial", "done"),
];

const server = setupServer(
  http.get(`${api}/users/me`, () =>
    HttpResponse.json({
      id: "1",
      email: "ana@supra.test",
      role: "advisor",
      is_active: true,
      created_at: "2025-01-01T00:00:00Z",
    }),
  ),
  http.get(`${api}/companies/overview`, () => {
    overviewGets++;
    return HttpResponse.json({
      items: [
        {
          id: company.id,
          legal_name: company.legal_name,
          trade_name: company.trade_name,
          tax_id: company.tax_id,
          assigned_advisor_id: "1",
          assigned_advisor_email: "ana@supra.test",
          status: "active",
          open_requirements: 1,
          total_requirements: 2,
          pending_activities: 2,
          overdue_activities: 1,
          last_activity_at: null,
          next_activity_at: null,
        },
      ],
      total: 1,
      active: 1,
    });
  }),
  http.get(`${api}/companies/:id`, () => HttpResponse.json(company)),
  http.get(`${api}/requirements`, () =>
    HttpResponse.json({
      items: [requirement("1", "open"), requirement("2", "won")],
      page: 1,
      page_size: 100,
      total: 2,
    }),
  ),
  http.get(`${api}/activities`, ({ request }) => {
    activityQueries.push(new URL(request.url).searchParams);
    return HttpResponse.json({ items: activities });
  }),
  http.post(`${api}/activities`, async ({ request }) => {
    activityBody = (await request.json()) as Record<string, unknown>;
    const created = {
      ...activity("a-4", String(activityBody.title), "pending"),
      kind: String(activityBody.kind),
    };
    activities = [...activities, created];
    return HttpResponse.json(created, { status: 201 });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  setAccessToken(null);
  queryClient.clear();
  server.resetHandlers();
  activityBody = undefined;
  activityQueries = [];
  overviewGets = 0;
  activities = [
    activity("a-1", "Reunión de presentación", "pending", true),
    activity("a-2", "Visita a local", "pending"),
    activity("a-3", "Llamada inicial", "done"),
  ];
  window.history.replaceState({}, "", "/");
});
afterAll(() => server.close());

function open(path = "/empresas/c-1") {
  setAccessToken("token");
  window.history.replaceState({}, "", path);
  render(<App />);
}

describe("espacio de empresa", () => {
  it("muestra cabecera y resumen con KPIs, próximas actividades y requerimientos abiertos", async () => {
    open();
    expect(
      await screen.findByRole("heading", {
        name: company.legal_name,
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("RUC: 20111222333")).toBeInTheDocument();
    expect(await screen.findByText("Activa")).toBeInTheDocument();
    expect(
      screen.getByText("ana@supra.test", { selector: ".company-advisor" }),
    ).toBeInTheDocument();
    expect(activityQueries[0].get("company_id")).toBe("c-1");

    const tabs = screen.getByRole("tablist", {
      name: "Secciones de la empresa",
    });
    expect(within(tabs).getByRole("tab", { name: "Resumen" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const summary = screen.getByRole("tabpanel", { name: "Resumen" });
    await within(summary).findByText("Reunión de presentación");
    const pendingTile = within(summary)
      .getByText("Actividades pendientes")
      .closest(".ws-stat")!;
    expect(pendingTile).toHaveTextContent("2");
    const overdueTile = within(summary)
      .getByText("Vencidas")
      .closest(".ws-stat")!;
    expect(overdueTile).toHaveTextContent("1");
    expect(overdueTile).toHaveClass("ws-tone-danger");
    expect(
      within(summary).queryByText("Llamada inicial"),
    ).not.toBeInTheDocument();
    expect(
      within(summary).getByRole("link", { name: "Local 1" }),
    ).toHaveAttribute("href", "/requerimientos/1");
    expect(within(summary).queryByRole("link", { name: "Local 2" })).toBeNull();
  });

  it("guarda la pestaña en ?tab= y lista requerimientos y contactos", async () => {
    open();
    fireEvent.click(await screen.findByRole("tab", { name: /Requerimientos/ }));
    expect(window.location.search).toBe("?tab=requerimientos");
    const panel = screen.getByRole("tabpanel", { name: "Requerimientos" });
    expect(
      within(panel).getByRole("link", { name: "Local 2" }),
    ).toBeInTheDocument();
    expect(within(panel).getByText("Ganado")).toBeInTheDocument();
    expect(
      within(panel).getByRole("form", { name: "Nuevo requerimiento" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Contactos/ }));
    expect(window.location.search).toBe("?tab=contactos");
    expect(screen.getByText("Lucía Paz")).toBeInTheDocument();
    cleanup();

    open("/empresas/c-1?tab=actividades");
    expect(
      await screen.findByRole("tab", { name: /Actividades/ }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("agenda una actividad con la empresa fija y refresca listas y cartera", async () => {
    open("/empresas/c-1?tab=actividades");
    const panel = await screen.findByRole("tabpanel", { name: "Actividades" });
    await within(panel).findByText("Llamada inicial");
    expect(
      within(panel).queryByLabelText("Empresa", { selector: "select" }),
    ).not.toBeInTheDocument();
    await within(panel).findByRole("option", { name: "REQ-1 · Local 1" });
    expect(
      within(panel).queryByRole("option", { name: "REQ-2 · Local 2" }),
    ).not.toBeInTheDocument();

    fireEvent.change(within(panel).getByLabelText("Tipo"), {
      target: { value: "call" },
    });
    fireEvent.change(within(panel).getByLabelText("Título"), {
      target: { value: "  Llamada de seguimiento " },
    });
    fireEvent.change(within(panel).getByLabelText("Requerimiento"), {
      target: { value: "1" },
    });
    const overviewBefore = overviewGets;
    fireEvent.click(
      within(panel).getByRole("button", { name: "Agendar actividad" }),
    );
    expect(await within(panel).findByRole("status")).toHaveTextContent(
      "Actividad agendada.",
    );
    expect(activityBody).toMatchObject({
      company_id: "c-1",
      requirement_id: "1",
      kind: "call",
      title: "Llamada de seguimiento",
      notes: null,
    });
    expect(typeof activityBody?.due_at).toBe("string");
    expect(
      await within(panel).findByText("Llamada de seguimiento"),
    ).toBeInTheDocument();
    await waitFor(() => expect(overviewGets).toBeGreaterThan(overviewBefore));
    expect(screen.getByRole("tab", { name: /Actividades/ })).toHaveTextContent(
      "3",
    );
  });
});
