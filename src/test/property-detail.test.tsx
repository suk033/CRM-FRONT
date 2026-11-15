import { cleanup, render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { App, queryClient } from "../App";
import { setAccessToken } from "../api/client";

const api = "http://localhost:8000/api/v1";
const property = {
  id: "p-1",
  code: "LOC-001",
  owner_id: "o-1",
  title: "Local esquina Miraflores",
  property_type: "retail",
  city: "Lima",
  district: "Miraflores",
  address: "Av. Larco 123",
  latitude: -12.12,
  longitude: -77.03,
  area_m2: 120,
  floors: 2,
  monthly_rent: 8500,
  currency: "PEN",
  features: ["vitrina", "salida_humos"],
  status: "available",
  is_strategic_stock: true,
  notes: null,
  created_at: "2025-01-01T00:00:00Z",
};
function match(
  index: number,
  ruleScore: number,
  mlProbability: number | null,
  extra: Record<string, unknown> = {},
) {
  return {
    requirement_id: `r-${index}`,
    requirement_code: `REQ-00${index}`,
    requirement_title: `Requerimiento ${index}`,
    requirement_status: "open",
    company_id: `c-${index}`,
    company_name: `Empresa ${index}`,
    rule_score: ruleScore,
    rule_contributions: { price_fit: 0.25 },
    gaps: [],
    ml_probability: mlProbability,
    candidate_status: null,
    ...extra,
  };
}
let response: Record<string, unknown> = {};

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
  http.get(`${api}/properties/:id/matches`, () => HttpResponse.json(response)),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  setAccessToken(null);
  queryClient.clear();
  server.resetHandlers();
  window.history.replaceState({}, "", "/");
});
afterAll(() => server.close());

function open() {
  setAccessToken("token");
  window.history.replaceState({}, "", "/inmuebles/p-1");
  render(<App />);
}

describe("detalle de inmueble", () => {
  it("muestra ficha y ranking por modelo con brechas, decisión y enlaces", async () => {
    response = {
      property,
      ranking: "model",
      model_version: 3,
      matches: [
        match(1, 0.9, 0.42, {
          gaps: ["district_match", "price_fit"],
          candidate_status: "rejected",
        }),
        match(2, 0.6, 0.81),
      ],
    };
    open();
    expect(
      await screen.findByRole("heading", {
        name: "Local esquina Miraflores",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("LOC-001")).toBeInTheDocument();
    expect(screen.getByText("Local comercial")).toBeInTheDocument();
    expect(screen.getByText("Disponible")).toBeInTheDocument();
    expect(screen.getByText("Stock estratégico")).toBeInTheDocument();
    expect(screen.getByText("Av. Larco 123")).toBeInTheDocument();
    expect(screen.getByText("120 m²")).toBeInTheDocument();
    expect(screen.getByText("salida humos")).toBeInTheDocument();
    expect(screen.getByText("Ranking: Modelo v3")).toBeInTheDocument();

    const table = screen.getByRole("table", { name: "Ranking de empresas" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    // Model probability ranks: Empresa 2 (81 %) before Empresa 1 (42 %).
    expect(rows[0]).toHaveTextContent("Empresa 2");
    expect(rows[0]).toHaveTextContent("81 %");
    expect(rows[0]).toHaveTextContent("Sin brechas");
    expect(rows[0]).toHaveTextContent("Sin decisión");
    expect(within(rows[0]).getByRole("meter")).toHaveAttribute(
      "aria-valuenow",
      "81",
    );
    expect(rows[1]).toHaveTextContent("42 %");
    expect(within(rows[1]).getByText("Distrito")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Precio")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Rechazado")).toBeInTheDocument();
    expect(
      within(rows[1]).getByRole("link", { name: "Empresa 1" }),
    ).toHaveAttribute("href", "/empresas/c-1");
    expect(
      within(rows[1]).getByRole("link", { name: "Requerimiento 1" }),
    ).toHaveAttribute("href", "/requerimientos/r-1");
  });

  it("usa el puntaje de reglas cuando no hay modelo", async () => {
    response = {
      property,
      ranking: "rules",
      model_version: null,
      matches: [match(1, 0.55, null), match(2, 0.875, null)],
    };
    open();
    expect(await screen.findByText("Ranking: Reglas")).toBeInTheDocument();
    const rows = within(
      screen.getByRole("table", { name: "Ranking de empresas" }),
    )
      .getAllByRole("row")
      .slice(1);
    expect(rows[0]).toHaveTextContent("Empresa 2");
    expect(rows[0]).toHaveTextContent("88 %");
    expect(rows[1]).toHaveTextContent("55 %");
  });

  it("muestra estado vacío cuando no hay requerimientos abiertos en la ciudad", async () => {
    response = { property, ranking: "rules", model_version: null, matches: [] };
    open();
    expect(
      await screen.findByText(/no hay requerimientos abiertos en Lima/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("muestra un error seguro cuando el inmueble no existe", async () => {
    server.use(
      http.get(`${api}/properties/:id/matches`, () =>
        HttpResponse.json({ detail: "Property not found" }, { status: 404 }),
      ),
    );
    open();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /no encontramos el recurso/i,
    );
    expect(
      screen.getByRole("link", { name: "Volver a inmuebles" }),
    ).toHaveAttribute("href", "/inmuebles");
  });
});
