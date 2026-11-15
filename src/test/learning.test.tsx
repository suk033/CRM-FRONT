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
const admin = {
  id: "1",
  email: "ana@supra.test",
  role: "admin",
  is_active: true,
  created_at: "2025-01-01T00:00:00Z",
};
const classification = (accuracy: number, logLoss: number) => ({
  accuracy,
  balanced_accuracy: accuracy - 0.01,
  precision: 0.8,
  recall: 0.75,
  f1: 0.77,
  roc_auc: 0.88,
  log_loss: logLoss,
  brier: 0.12,
  confusion_matrix: { tn: 9, fp: 2, fn: 3, tp: 11 },
  threshold: 0.5,
});
const evidence = {
  decisions: 40,
  accepted: 22,
  rejected: 18,
  min_samples: 30,
  min_per_class: 10,
  trainable: true,
  active_model: {
    version: 3,
    algorithm: "logistic_regression",
    feature_names: ["price_fit", "area_fit"],
    coefficients: [1.2, -0.6],
    intercept: -0.4,
    metrics: {
      model: classification(0.84, 0.41),
      rule_baseline: classification(0.72, 0.55),
      cross_validation: {
        folds: 5,
        metric: "balanced_accuracy",
        mean: 0.812,
        std: 0.043,
      },
      split: { train_count: 30, test_count: 10 },
      class_balance: { accepted: 22, rejected: 18 },
      improves_on_rules: true,
    },
    sample_count: 40,
    is_active: true,
    trained_at: "2025-01-02T00:00:00Z",
  },
};
const versions = [
  evidence.active_model,
  {
    ...evidence.active_model,
    version: 2,
    is_active: false,
    sample_count: 30,
    trained_at: "2025-01-01T00:00:00Z",
    metrics: { ...evidence.active_model.metrics, improves_on_rules: false },
  },
];
const behavior = {
  model_version: 3,
  open_candidates: { total: 20, high: 5, medium: 7, low: 8 },
  history: {
    decisions: 40,
    avg_probability_accepted: 0.81,
    avg_probability_rejected: 0.22,
    agreement_rate: 0.9,
  },
  rule_agreement_rate: 0.75,
};
let currentUser: typeof admin = admin;
const activations: unknown[] = [];
let trainStatus = 409;

const server = setupServer(
  http.get(`${api}/users/me`, () => HttpResponse.json(currentUser)),
  http.get(`${api}/ml/evidence`, () => HttpResponse.json(evidence)),
  http.get(`${api}/ml/models`, () => HttpResponse.json({ items: versions })),
  http.get(`${api}/ml/behavior`, () => HttpResponse.json(behavior)),
  http.put(`${api}/ml/active-model`, async ({ request }) => {
    const body = (await request.json()) as { version: number | null };
    activations.push(body);
    return HttpResponse.json({
      version: body.version,
      ranking: body.version === null ? "rules" : "model",
    });
  }),
  http.post(`${api}/ml/models`, () =>
    trainStatus === 201
      ? HttpResponse.json(
          { ...evidence.active_model, version: 4 },
          { status: 201 },
        )
      : HttpResponse.json(
          { detail: "need at least 10 rejected decisions" },
          { status: 409 },
        ),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  setAccessToken(null);
  queryClient.clear();
  server.resetHandlers();
  currentUser = admin;
  activations.length = 0;
  trainStatus = 409;
  window.history.replaceState({}, "", "/");
});
afterAll(() => server.close());

function renderLearning() {
  setAccessToken("token");
  window.history.replaceState({}, "", "/aprendizaje");
  render(<App />);
}

describe("aprendizaje", () => {
  it("la ruta antigua /aprendizaje abre la pestaña Modelo ML del perfil", async () => {
    renderLearning();
    expect(
      await screen.findByRole("tab", { name: "Modelo ML" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(window.location.pathname).toBe("/perfil");
    expect(window.location.search).toBe("?seccion=modelo");
  });

  it("explica el modelo y muestra su desempeño y comportamiento en lenguaje simple", async () => {
    renderLearning();
    expect(
      await screen.findByRole("heading", { name: "¿Qué hace el modelo?" }),
    ).toBeInTheDocument();
    const status = await screen.findByLabelText("Estado del modelo");
    expect(status).toHaveTextContent("Modelo v3");
    expect(status).toHaveTextContent("22 / 18");

    const performance = screen.getByRole("table", {
      name: "Desempeño frente a las reglas",
    });
    expect(
      within(performance).getByRole("row", { name: /Aciertos en general/ }),
    ).toHaveTextContent("84 de cada 100");
    expect(
      within(performance).getByRole("row", { name: /Aciertos en general/ }),
    ).toHaveTextContent("72 de cada 100");
    expect(screen.getAllByText("Mejora a las reglas").length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getByText(/mantiene una exactitud balanceada de/),
    ).toHaveTextContent("81 %");

    const buckets = await screen.findByRole("list", {
      name: "Candidatos por probabilidad",
    });
    expect(buckets).toHaveTextContent("Alta (70 % o más)5");
    expect(
      screen.getByText("Probabilidad promedio que dio a lo que se aceptó")
        .nextSibling,
    ).toHaveTextContent("81 %");
    expect(
      screen.getByText("Coincide con las decisiones de los asesores")
        .nextSibling,
    ).toHaveTextContent("90 %");
    expect(
      screen.getByRole("list", { name: "Peso de cada criterio" }),
    ).toHaveTextContent("Precio");
  });

  it("activa otra versión o vuelve a reglas con confirmación", async () => {
    renderLearning();
    const activate = await screen.findByRole("button", {
      name: "Activar versión 2",
    });
    expect(
      screen.getByRole("button", { name: "Activar versión 3" }),
    ).toBeDisabled();
    fireEvent.click(activate);
    const dialog = screen.getByRole("alertdialog", {
      name: "¿Activar la versión 2?",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(activations).toEqual([{ version: 2 }]));
    expect(
      await screen.findByText("La versión 2 quedó activa."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Usar solo reglas" }));
    fireEvent.click(
      within(
        screen.getByRole("alertdialog", { name: "¿Usar solo las reglas?" }),
      ).getByRole("button", { name: "Confirmar" }),
    );
    await waitFor(() =>
      expect(activations).toEqual([{ version: 2 }, { version: null }]),
    );
    expect(
      await screen.findByText("El ranking usa ahora solo las reglas."),
    ).toBeInTheDocument();
  });

  it("entrenar pide confirmación y muestra el rechazo del backend", async () => {
    renderLearning();
    const trainButton = await screen.findByRole("button", {
      name: "Entrenar nueva versión",
    });
    await waitFor(() => expect(trainButton).toBeEnabled());
    fireEvent.click(trainButton);
    fireEvent.click(
      within(
        screen.getByRole("alertdialog", {
          name: "¿Entrenar una nueva versión?",
        }),
      ).getByRole("button", { name: "Entrenar" }),
    );
    expect(
      await screen.findByText(
        "La operación no se puede completar todavía. need at least 10 rejected decisions",
      ),
    ).toBeInTheDocument();

    trainStatus = 201;
    fireEvent.click(
      screen.getByRole("button", { name: "Entrenar nueva versión" }),
    );
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Entrenar",
      }),
    );
    expect(
      await screen.findByText("Versión 4 entrenada y activada."),
    ).toBeInTheDocument();
  });

  it("el modelo y su entrenamiento son solo del administrador", async () => {
    currentUser = { ...admin, role: "advisor" };
    renderLearning();
    expect(
      await screen.findByLabelText("Indicadores personales"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "¿Qué hace el modelo?" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Entrenar nueva versión" }),
    ).not.toBeInTheDocument();
  });
});
