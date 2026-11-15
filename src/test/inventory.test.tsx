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
import { chooseOption } from "./select";
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
    expect(requests[0].get("status")).toBe("available");
    expect(screen.getByRole("combobox", { name: "Estado" })).toHaveTextContent(
      "Disponible",
    );
    expect(
      screen.getByRole("link", { name: "Local esquina Miraflores" }),
    ).toHaveAttribute("href", "/inmuebles/p-1");

    fireEvent.change(screen.getByLabelText("Buscar"), {
      target: { value: " esquina " },
    });
    fireEvent.change(screen.getByLabelText("Ciudad"), {
      target: { value: "Lima" },
    });
    chooseOption("Tipo", "Local comercial");
    chooseOption("Estado", "Reservado");
    chooseOption("Stock estratégico", "Solo estratégicos");
    fireEvent.click(screen.getByRole("button", { name: "Filtrar" }));

    await waitFor(() => expect(requests).toHaveLength(2));
    const filtered = requests[1];
    expect(filtered.get("q")).toBe("esquina");
    expect(filtered.get("city")).toBe("Lima");
    expect(filtered.get("property_type")).toBe("retail");
    expect(filtered.get("status")).toBe("reserved");
    expect(filtered.get("strategic_stock")).toBe("true");
    expect(filtered.get("page_size")).toBe("10");
  });

  it("permite ver todos los estados quitando el filtro por defecto", async () => {
    setAccessToken("token");
    window.history.replaceState({}, "", "/inmuebles");
    render(<App />);
    await screen.findByText("LOC-001");
    chooseOption("Estado", "Todos");
    fireEvent.click(screen.getByRole("button", { name: "Filtrar" }));
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1].has("status")).toBe(false);
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
  it("importa locales desde la plantilla CSV y refresca el listado", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${api}/properties/import`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(
          {
            created: 2,
            owners_created: 1,
            items: [property, { ...property, id: "p-2", code: "LOC-002" }],
          },
          { status: 201 },
        );
      }),
    );
    setAccessToken("token");
    window.history.replaceState({}, "", "/inmuebles");
    render(<App />);
    await screen.findByText("LOC-001");

    const template = screen.getByRole("link", {
      name: "Descargar plantilla CSV",
    });
    expect(template).toHaveAttribute("download", "plantilla_locales_supra.csv");
    expect(decodeURIComponent(template.getAttribute("href") ?? "")).toContain(
      "titulo;tipo;ciudad;distrito",
    );

    const csv = "titulo;tipo\nLocal;local_comercial";
    fireEvent.change(screen.getByLabelText("Archivo CSV de locales"), {
      target: { files: [new File([csv], "locales.csv", { type: "text/csv" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Importar locales" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Se importaron 2 inmuebles (LOC-001, LOC-002) y 1 propietario nuevo.",
    );
    expect(bodies).toEqual([{ content: csv }]);
    await waitFor(() => expect(requests.length).toBeGreaterThanOrEqual(2));
  });

  it("muestra los errores por fila cuando el archivo es inválido", async () => {
    server.use(
      http.post(`${api}/properties/import`, () =>
        HttpResponse.json(
          {
            detail: {
              message: "invalid rows; nothing was imported",
              errors: [
                { row: 3, field: "tipo", message: "Input should be 'retail'" },
                { row: 4, field: "ciudad", message: "Field required" },
              ],
            },
          },
          { status: 422 },
        ),
      ),
    );
    setAccessToken("token");
    window.history.replaceState({}, "", "/inmuebles");
    render(<App />);
    await screen.findByText("LOC-001");

    const importButton = screen.getByRole("button", {
      name: "Importar locales",
    });
    expect(importButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Archivo CSV de locales"), {
      target: { files: [new File(["x"], "malo.csv", { type: "text/csv" })] },
    });
    fireEvent.click(importButton);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No se importó ningún inmueble.");
    expect(alert).toHaveTextContent("Fila 3 · tipo: Input should be 'retail'");
    expect(alert).toHaveTextContent("Fila 4 · ciudad: Field required");
  });
});
