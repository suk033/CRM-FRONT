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
import { chooseOption } from "./select";
import { App, queryClient } from "../App";
import { setAccessToken } from "../api/client";

const api = "http://localhost:8000/api/v1";
const admin = {
  id: "1",
  email: "ana@supra.test",
  role: "admin",
  is_active: true,
  created_at: "2025-01-15T12:00:00Z",
};
const advisorUser = {
  ...admin,
  id: "2",
  email: "luis@supra.test",
  role: "advisor",
};
let currentUser = admin;
let reportRequests = 0;

const now = Date.now();
const activity = (id: string, title: string, owner: string, extra = {}) => ({
  id,
  company_id: "c1",
  company_name: "Café Andino",
  requirement_id: null,
  requirement_code: null,
  owner_id: owner,
  owner_email: owner,
  kind: "call",
  title,
  notes: null,
  due_at: new Date(now + 86400000).toISOString(),
  status: "pending",
  completed_at: null,
  created_at: new Date(now).toISOString(),
  overdue: false,
  ...extra,
});
const teamActivities = [
  activity("a1", "Llamar a Café Andino", "luis@supra.test"),
  activity("a2", "Visitar local Surco", "maria@supra.test", { overdue: true }),
];
const report = {
  generated_at: new Date(now).toISOString(),
  window_days: 30,
  advisors: [
    {
      user_id: "2",
      email: "luis@supra.test",
      is_active: true,
      companies: 4,
      open_requirements: 3,
      activities_done_30d: 6,
      activities_pending: 2,
      activities_overdue: 0,
      decisions_accepted: 3,
      decisions_rejected: 1,
      acceptance_rate: 0.75,
      last_activity_at: new Date(now).toISOString(),
    },
    {
      user_id: "3",
      email: "maria@supra.test",
      is_active: false,
      companies: 2,
      open_requirements: 1,
      activities_done_30d: 0,
      activities_pending: 0,
      activities_overdue: 2,
      decisions_accepted: 0,
      decisions_rejected: 0,
      acceptance_rate: null,
      last_activity_at: null,
    },
  ],
};
const evidence = {
  decisions: 4,
  accepted: 3,
  rejected: 1,
  min_samples: 30,
  min_per_class: 10,
  trainable: false,
  active_model: null,
};
let activityQueries: URLSearchParams[] = [];

const server = setupServer(
  http.get(`${api}/users/me`, () => HttpResponse.json(currentUser)),
  http.get(`${api}/reports/advisors`, () => {
    reportRequests += 1;
    return currentUser.role === "admin"
      ? HttpResponse.json(report)
      : HttpResponse.json({ detail: "forbidden" }, { status: 403 });
  }),
  http.get(`${api}/activities`, ({ request }) => {
    const params = new URL(request.url).searchParams;
    activityQueries.push(params);
    const status = params.get("status");
    const items =
      status === "done"
        ? [
            activity("d1", "Correo enviado", currentUser.email, {
              status: "done",
              completed_at: new Date(now - 86400000).toISOString(),
            }),
          ]
        : status === "cancelled"
          ? []
          : teamActivities;
    return HttpResponse.json({ items, total: items.length });
  }),
  http.get(`${api}/companies/overview`, () =>
    HttpResponse.json({
      total: 4,
      active: 3,
      items: [{ open_requirements: 2 }, { open_requirements: 1 }].map(
        (extra, index) => ({
          id: `c${index}`,
          legal_name: `Empresa ${index}`,
          trade_name: null,
          tax_id: null,
          assigned_advisor_id: "2",
          assigned_advisor_email: "luis@supra.test",
          status: "active",
          total_requirements: 3,
          pending_activities: 1,
          overdue_activities: 0,
          last_activity_at: null,
          next_activity_at: null,
          ...extra,
        }),
      ),
    }),
  ),
  http.get(`${api}/ml/evidence`, () => HttpResponse.json(evidence)),
  http.get(`${api}/ml/models`, () => HttpResponse.json({ items: [] })),
  http.get(`${api}/ml/behavior`, () =>
    HttpResponse.json({
      model_version: null,
      open_candidates: null,
      history: null,
      rule_agreement_rate: null,
    }),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  setAccessToken(null);
  queryClient.clear();
  server.resetHandlers();
  currentUser = admin;
  reportRequests = 0;
  activityQueries = [];
  window.history.replaceState({}, "", "/");
});
afterAll(() => server.close());

function renderProfile(path = "/perfil") {
  setAccessToken("token");
  window.history.replaceState({}, "", path);
  render(<App />);
}

describe("Perfil", () => {
  it("muestra la tarjeta de cuenta del administrador y la tabla de rendimiento", async () => {
    renderProfile();
    const account = await screen.findByRole("region", { name: "Tu cuenta" });
    expect(account).toHaveTextContent("ana@supra.test");
    expect(account).toHaveTextContent("Administrador");
    expect(account).toHaveTextContent("Activo");
    expect(account).toHaveTextContent(/Miembro desde.*2025/);

    expect(
      screen.getByRole("tab", { name: "Rendimiento de asesores" }),
    ).toHaveAttribute("aria-selected", "true");
    const table = await screen.findByRole("table");
    const luis = within(table).getByRole("row", { name: /luis@supra.test/ });
    expect(luis).toHaveTextContent("4");
    expect(
      within(luis).getByRole("img", { name: "Aceptación: 75 %" }),
    ).toBeInTheDocument();
    expect(
      within(luis).getByRole("img", { name: "Cumplimiento: 75 %" }),
    ).toBeInTheDocument();
    const maria = within(table).getByRole("row", { name: /maria@supra.test/ });
    expect(maria).toHaveClass("is-overdue");
    expect(maria).toHaveTextContent("Inactivo");
    expect(maria).toHaveTextContent("Sin actividad");
  });

  it("el asesor no ve el rendimiento del equipo y sí su resumen", async () => {
    currentUser = advisorUser;
    renderProfile("/perfil?seccion=rendimiento");
    const summary = await screen.findByLabelText("Indicadores personales");
    // Advisors have a single section: no tabs, no team performance, no ML model.
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Rendimiento de asesores"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Actividades del equipo"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Modelo ML")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(summary).getByText("Empresas").nextSibling,
      ).toHaveTextContent("4"),
    );
    const value = (label: string) =>
      within(summary).getByText(label).nextSibling?.textContent;
    await waitFor(() => expect(value("Pendientes")).toBe("2"));
    expect(value("Requerimientos abiertos")).toBe("3");
    expect(value("Vencidas")).toBe("1");
    await waitFor(() => expect(value("Completadas (30 días)")).toBe("1"));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(reportRequests).toBe(0);
  });

  it("?seccion=modelo abre la pestaña del modelo", async () => {
    renderProfile("/perfil?seccion=modelo");
    expect(
      await screen.findByRole("tab", { name: "Modelo ML" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByLabelText("Estado del modelo")).toHaveTextContent(
      "Solo reglas",
    );
    expect(
      await screen.findByText("Todavía no hay versiones entrenadas."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("cambiar de pestaña actualiza ?seccion", async () => {
    renderProfile();
    fireEvent.click(await screen.findByRole("tab", { name: "Modelo ML" }));
    expect(window.location.search).toBe("?seccion=modelo");
    expect(
      await screen.findByRole("heading", { name: "¿Qué hace el modelo?" }),
    ).toBeInTheDocument();
  });

  it("actividades del equipo filtran por estado y asesor", async () => {
    renderProfile("/perfil?seccion=equipo");
    expect(
      await screen.findByRole("region", {
        name: "Actividades de luis@supra.test",
      }),
    ).toHaveTextContent("Llamar a Café Andino");
    expect(
      screen.getByRole("region", { name: "Actividades de maria@supra.test" }),
    ).toHaveTextContent("Visitar local Surco");
    expect(activityQueries.at(-1)?.get("status")).toBe("pending");

    chooseOption("Asesor", "maria@supra.test");
    expect(screen.queryByText("Llamar a Café Andino")).not.toBeInTheDocument();
    expect(screen.getByText("Visitar local Surco")).toBeInTheDocument();

    chooseOption("Estado", "Canceladas");
    expect(
      await screen.findByText("No hay actividades con estos filtros."),
    ).toBeInTheDocument();
    expect(activityQueries.at(-1)?.get("status")).toBe("cancelled");
  });
});
