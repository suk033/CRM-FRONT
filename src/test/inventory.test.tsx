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
import { setAccessToken } from "../api/client";

const api = "http://localhost:8000/api/v1";
const user = {
  id: "1",
  email: "ana@supra.test",
  role: "advisor",
  is_active: true,
  created_at: "2025-01-01T00:00:00Z",
};
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
  floors: 1,
  monthly_rent: 8500,
  currency: "PEN",
  features: ["vitrina"],
  status: "available",
  is_strategic_stock: true,
  notes: null,
  created_at: "2025-01-01T00:00:00Z",
};
const requests: URLSearchParams[] = [];

const server = setupServer(
  http.get(`${api}/users/me`, () => HttpResponse.json(user)),
  http.get(`${api}/properties`, ({ request }) => {
    requests.push(new URL(request.url).searchParams);
    return HttpResponse.json({
      items: [property],
      page: 1,
      page_size: 10,
      total: 1,
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  setAccessToken(null);
  queryClient.clear();
  server.resetHandlers();
  requests.length = 0;
  window.history.replaceState({}, "", "/");
});
afterAll(() => server.close());

describe("inmuebles", () => {
  it("lista inmuebles y envía los filtros elegidos al backend", async () => {
    setAccessToken("token");
    window.history.replaceState({}, "", "/inmuebles");
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Inmuebles", level: 1 }),
    ).toBeInTheDocument();
    expect(await screen.findByText("LOC-001")).toBeInTheDocument();
    expect(screen.getByText("Local esquina Miraflores")).toBeInTheDocument();
    expect(screen.getByText("Miraflores, Lima")).toBeInTheDocument();
    expect(screen.getByText("120 m²")).toBeInTheDocument();
    expect(
      screen.getByText("Disponible", { selector: ".badge" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Stock estratégico", { selector: ".badge" }),
    ).toBeInTheDocument();
    expect(requests[0].get("page")).toBe("1");
    expect(requests[0].has("city")).toBe(false);

    fireEvent.change(screen.getByLabelText("Buscar"), {
      target: { value: " esquina " },
    });
    fireEvent.change(screen.getByLabelText("Ciudad"), {
      target: { value: "Lima" },
    });
    fireEvent.change(screen.getByLabelText("Tipo"), {
      target: { value: "retail" },
    });
    fireEvent.change(screen.getByLabelText("Estado"), {
      target: { value: "available" },
    });
    fireEvent.change(screen.getByLabelText("Stock estratégico"), {
      target: { value: "yes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Filtrar" }));

    await waitFor(() => expect(requests).toHaveLength(2));
    const filtered = requests[1];
    expect(filtered.get("q")).toBe("esquina");
    expect(filtered.get("city")).toBe("Lima");
    expect(filtered.get("property_type")).toBe("retail");
    expect(filtered.get("status")).toBe("available");
    expect(filtered.get("strategic_stock")).toBe("true");
    expect(filtered.get("page_size")).toBe("10");
  });

  it("muestra un mensaje cuando el backend falla", async () => {
    server.use(
      http.get(`${api}/properties`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    setAccessToken("token");
    window.history.replaceState({}, "", "/inmuebles");
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /no fue posible completar la solicitud/i,
    );
  });
});
