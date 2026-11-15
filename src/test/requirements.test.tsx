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
const user = {
  id: "1",
  email: "ana@supra.test",
  role: "advisor",
  is_active: true,
  created_at: "2025-01-01T00:00:00Z",
};
const requirement = {
  id: "r-1",
  code: "REQ-001",
  company_id: "c-1",
  title: "Local para cafetería",
  property_type: "retail",
  city: "Lima",
  districts: ["Miraflores", "Barranco"],
  min_area_m2: 80,
  max_area_m2: 150,
  max_monthly_budget: 9000,
  required_features: ["vitrina"],
  status: "open",
  created_at: "2025-01-01T00:00:00Z",
};
function makeProperty(id: string, code: string, title: string) {
  return {
    id,
    code,
    owner_id: "o-1",
    title,
    property_type: "retail",
    city: "Lima",
    district: "Miraflores",
    address: "Av. Larco 123",
    latitude: -12.12,
    longitude: -77.03,
    area_m2: 120,
    floors: 1,
    monthly_rent: 8500,
    currency: "PEN",
    features: ["vitrina"],
    status: "available",
    is_strategic_stock: false,
    notes: null,
    created_at: "2025-01-01T00:00:00Z",
  };
}
const features = {
  price_fit: 1,
  area_fit: 1,
  district_match: 1,
  type_match: 1,
  feature_coverage: 0.5,
  availability: 1,
  strategic_stock: 0,
};
function makeCandidate(id: string, property: ReturnType<typeof makeProperty>) {
  return {
    id,
    property,
    rule_score: 0.875,
    features,
    rule_contributions: {
      price_fit: 0.25,
      area_fit: 0.2,
      district_match: 0.15,
      type_match: 0.15,
      feature_coverage: 0.05,
      availability: 0.075,
      strategic_stock: 0,
    },
    gaps: ["feature_coverage", "strategic_stock"],
    ml_probability: 0.731,
    ml_contributions: { price_fit: 0.4, area_fit: 0.1 },
    status: "suggested",
    decision_reason: null,
    decided_at: null,
  };
}
const first = makeCandidate(
  "cand-1",
  makeProperty("p-1", "LOC-001", "Local A"),
);
const second = makeCandidate(
  "cand-2",
  makeProperty("p-2", "LOC-002", "Local B"),
);
let stored: (typeof first)[] = [];
let decisionBody: unknown;
let requirementBody: unknown;
let proposalBody: unknown;
let routeBody: unknown;

const matchResponse = () => ({
  requirement,
  ranking: "model",
  model_version: 2,
  candidates: stored,
});

const server = setupServer(
  http.get(`${api}/users/me`, () => HttpResponse.json(user)),
  http.get(`${api}/requirements`, () =>
    HttpResponse.json({
      items: [requirement],
      page: 1,
      page_size: 50,
      total: 1,
    }),
  ),
  http.get(`${api}/companies`, () =>
    HttpResponse.json({
      items: [
        {
          id: "c-1",
          legal_name: "Café Andino SAC",
          trade_name: "Café Andino",
          tax_id: null,
          created_at: "2025-01-01T00:00:00Z",
        },
      ],
      page: 1,
      page_size: 50,
      total: 1,
    }),
  ),
  http.post(`${api}/requirements`, async ({ request }) => {
    requirementBody = await request.json();
    return HttpResponse.json(requirement, { status: 201 });
  }),
  http.get(`${api}/requirements/:id/matches`, () =>
    HttpResponse.json(matchResponse()),
  ),
  http.post(`${api}/requirements/:id/matches`, () => {
    stored = [first, second];
    return HttpResponse.json(matchResponse());
  }),
  http.put(
    `${api}/requirements/:id/candidates/:candidateId/decision`,
    async ({ request, params }) => {
      decisionBody = await request.json();
      const body = decisionBody as { status: string; reason: string };
      const candidate = stored.find((item) => item.id === params.candidateId)!;
      return HttpResponse.json({
        ...candidate,
        status: body.status,
        decision_reason: body.reason,
        decided_at: "2025-01-02T00:00:00Z",
      });
    },
  ),
  http.post(
    `${api}/requirements/:id/proposal/optimize`,
    async ({ request }) => {
      proposalBody = await request.json();
      return HttpResponse.json({
        algorithm: "hill_climbing",
        objective_source: "rules",
        selected: [first, second],
        objective: 1.725,
        initial_property_ids: ["p-2"],
        initial_objective: 0.9,
        iterations: 4,
        restarts: 3,
        history: [0.9, 1.725],
      });
    },
  ),
  http.post(`${api}/routes/visits`, async ({ request }) => {
    routeBody = await request.json();
    return HttpResponse.json({
      stops: [first.property, second.property],
      bfs: {
        algorithm: "bfs",
        property_ids: ["p-2", "p-1"],
        distance_km: 7.25,
        legs_km: [3.5, 3.75],
        nodes_expanded: 40,
      },
      astar: {
        algorithm: "astar",
        property_ids: ["p-2", "p-1"],
        distance_km: 7.25,
        legs_km: [3.5, 3.75],
        nodes_expanded: 10,
      },
      same_optimum: true,
      node_reduction_pct: 75,
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  setAccessToken(null);
  queryClient.clear();
  server.resetHandlers();
  stored = [];
  decisionBody = undefined;
  requirementBody = undefined;
  proposalBody = undefined;
  routeBody = undefined;
  window.history.replaceState({}, "", "/");
});
afterAll(() => server.close());

function renderAt(path: string) {
  setAccessToken("token");
  window.history.replaceState({}, "", path);
  render(<App />);
}

describe("requerimientos", () => {
  it("lista requerimientos y crea uno con listas separadas por coma", async () => {
    renderAt("/requerimientos");
    expect(
      await screen.findByRole("link", { name: "Local para cafetería" }),
    ).toHaveAttribute("href", "/requerimientos/r-1");
    expect(screen.getByText("REQ-001")).toBeInTheDocument();

    await screen.findByRole("option", { name: "Café Andino" });
    fireEvent.change(screen.getByLabelText("Empresa"), {
      target: { value: "c-1" },
    });
    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: " Local para cafetería " },
    });
    fireEvent.change(screen.getByLabelText("Ciudad"), {
      target: { value: "Lima" },
    });
    fireEvent.change(screen.getByLabelText(/^Distritos/), {
      target: { value: "Miraflores, Barranco ," },
    });
    fireEvent.change(screen.getByLabelText(/Área mínima/), {
      target: { value: "80" },
    });
    fireEvent.change(screen.getByLabelText(/Área máxima/), {
      target: { value: "150" },
    });
    fireEvent.change(screen.getByLabelText(/Presupuesto mensual/), {
      target: { value: "9000" },
    });
    fireEvent.change(screen.getByLabelText(/Características requeridas/), {
      target: { value: "vitrina" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Crear requerimiento" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Local para cafetería",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(requirementBody).toEqual({
      company_id: "c-1",
      title: "Local para cafetería",
      property_type: "retail",
      city: "Lima",
      districts: ["Miraflores", "Barranco"],
      min_area_m2: 80,
      max_area_m2: 150,
      max_monthly_budget: 9000,
      required_features: ["vitrina"],
    });
  });

  it("busca candidatos, muestra el ranking y registra un rechazo con motivo", async () => {
    renderAt("/requerimientos/r-1");
    expect(
      await screen.findByRole("heading", {
        name: "Local para cafetería",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/aún no hay candidatos/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Buscar candidatos" }));
    const ranking = await screen.findByRole("list", {
      name: "Ranking de candidatos",
    });
    const items = within(ranking).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("#1 · LOC-001 · Local A");
    expect(items[0]).toHaveTextContent("Puntaje reglas: 87.5 %");
    expect(items[0]).toHaveTextContent("Probabilidad modelo: 73.1 %");
    expect(screen.getByText(/versión 2/)).toBeInTheDocument();

    const breakdown = within(items[0]).getByText("Ver desglose por criterio");
    fireEvent.click(breakdown);
    expect(
      within(items[0]).getByRole("rowheader", { name: "Precio" }),
    ).toBeInTheDocument();
    expect(items[0]).toHaveTextContent(
      "Brechas: Características, Stock estratégico",
    );

    fireEvent.click(screen.getByRole("button", { name: "Rechazar LOC-001" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar rechazo" }));
    expect(
      await screen.findByText("Indica el motivo del rechazo."),
    ).toBeInTheDocument();
    expect(decisionBody).toBeUndefined();

    fireEvent.change(screen.getByLabelText("Motivo del rechazo"), {
      target: { value: "  Sin salida de humos " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar rechazo" }));
    await waitFor(() =>
      expect(decisionBody).toEqual({
        status: "rejected",
        reason: "Sin salida de humos",
      }),
    );
    expect(
      await within(items[0]).findByText("Rechazado", { selector: ".badge" }),
    ).toBeInTheDocument();
    expect(items[0]).toHaveTextContent("Motivo: Sin salida de humos");
  });

  it("muestra la propuesta de Hill Climbing y la ruta BFS vs A*", async () => {
    stored = [first, second];
    renderAt("/requerimientos/r-1");
    await screen.findByRole("list", { name: "Ranking de candidatos" });

    fireEvent.change(screen.getByLabelText("Tamaño de la propuesta"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText(/Presupuesto total/), {
      target: { value: "18000" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Optimizar propuesta" }),
    );
    const proposal = screen
      .getByRole("heading", { name: "Armar propuesta (Hill Climbing)" })
      .closest("section")!;
    expect(await within(proposal).findByText("1.725")).toBeInTheDocument();
    expect(within(proposal).getByText("0.900")).toBeInTheDocument();
    expect(within(proposal).getByText("4")).toBeInTheDocument();
    expect(within(proposal).getByText(/LOC-002 · Local B/)).toBeInTheDocument();
    expect(proposalBody).toEqual({
      size: 2,
      total_budget: 18000,
      restarts: 5,
      seed: 7,
    });

    const routeSection = screen
      .getByRole("heading", { name: "Ruta de visitas (BFS vs A*)" })
      .closest("section")!;
    fireEvent.click(within(routeSection).getByLabelText(/LOC-001/));
    fireEvent.click(within(routeSection).getByLabelText(/LOC-002/));
    expect(
      within(routeSection).getByLabelText("Latitud de partida"),
    ).toHaveValue(-12.0464);
    fireEvent.change(
      within(routeSection).getByLabelText("Longitud de partida"),
      {
        target: { value: "-77.03" },
      },
    );
    fireEvent.click(
      within(routeSection).getByRole("button", { name: "Calcular ruta" }),
    );

    const bfs = await within(routeSection).findByRole("heading", {
      name: "BFS",
    });
    const astar = within(routeSection).getByRole("heading", { name: "A*" });
    expect(bfs.closest("article")).toHaveTextContent("40");
    expect(astar.closest("article")).toHaveTextContent("10");
    expect(astar.closest("article")).toHaveTextContent("7.25 km");
    expect(
      within(astar.closest("article")!).getAllByRole("listitem")[1],
    ).toHaveTextContent("LOC-002");
    expect(routeSection).toHaveTextContent("75.0 % menos nodos");
    expect(routeSection).toHaveTextContent("misma distancia óptima");
    expect(routeBody).toEqual({
      start: { latitude: -12.0464, longitude: -77.03 },
      property_ids: ["p-1", "p-2"],
    });
  });
});
