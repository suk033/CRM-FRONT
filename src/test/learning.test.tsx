import {
  cleanup,
  fireEvent,
  render,
  screen,
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
let currentUser: typeof admin = admin;

const server = setupServer(
  http.get(`${api}/users/me`, () => HttpResponse.json(currentUser)),
  http.get(`${api}/ml/evidence`, () => HttpResponse.json(evidence)),
  http.post(`${api}/ml/models`, () =>
    HttpResponse.json(
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
  window.history.replaceState({}, "", "/");
});
afterAll(() => server.close());

function renderLearning() {
  setAccessToken("token");
  window.history.replaceState({}, "", "/aprendizaje");
  render(<App />);
}

describe("aprendizaje", () => {
  it("muestra evidencia, métricas frente a reglas y coeficientes", async () => {
    renderLearning();
    expect(
      await screen.findByRole("heading", {
        name: "Regresión logística · versión 3",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Decisiones").nextSibling).toHaveTextContent("40");
    expect(screen.getByText("Aceptadas").nextSibling).toHaveTextContent("22");
    expect(screen.getByText("Rechazadas").nextSibling).toHaveTextContent("18");

    const accuracy = screen.getByRole("row", { name: /^Exactitud 0.840/ });
    expect(accuracy).toHaveTextContent("0.720");
    expect(screen.getByRole("row", { name: /Log loss/ })).toHaveTextContent(
      "0.4100.550",
    );
    expect(screen.getByText("0.812 ± 0.043")).toBeInTheDocument();
    const matrix = screen.getByRole("table", { name: /matriz de confusión/i });
    expect(within(matrix).getByText("VP 11")).toBeInTheDocument();
    expect(within(matrix).getByText("FN 3")).toBeInTheDocument();
    const coefficients = screen.getByRole("list", {
      name: "Coeficientes por criterio",
    });
    expect(coefficients).toHaveTextContent("Precio1.200");
    expect(coefficients).toHaveTextContent("Área-0.600");
    expect(screen.getByText(/mejora a la línea base/)).toBeInTheDocument();
  });

  it("muestra el detalle 409 cuando la evidencia es insuficiente", async () => {
    renderLearning();
    fireEvent.click(
      await screen.findByRole("button", { name: "Entrenar nuevo modelo" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La operación no se puede completar todavía. need at least 10 rejected decisions",
    );
  });

  it("oculta el entrenamiento a los asesores", async () => {
    currentUser = { ...admin, role: "advisor" };
    renderLearning();
    await screen.findByRole("heading", {
      name: "Regresión logística · versión 3",
    });
    expect(
      screen.queryByRole("button", { name: "Entrenar nuevo modelo" }),
    ).not.toBeInTheDocument();
  });
});
