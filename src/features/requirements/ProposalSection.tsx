import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { components } from "../../api/schema";
import { call, formatArea, formatMoney } from "../inventory/labels";

type ProposalRequest = components["schemas"]["ProposalRequest"];

// Backend defaults: random restarts and a fixed seed keep the demo reproducible.
const restarts = 5;
const seed = 7;
const maxSize = 10;

export function ProposalSection({ requirementId }: { requirementId: string }) {
  const [formError, setFormError] = useState<string | null>(null);
  const optimize = useMutation({
    mutationFn: (body: ProposalRequest) =>
      call(() =>
        api.POST("/api/v1/requirements/{requirement_id}/proposal/optimize", {
          params: { path: { requirement_id: requirementId } },
          body,
        }),
      ),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const size = Number(form.get("size"));
    const budgetText = String(form.get("total_budget") ?? "").trim();
    const budget = budgetText ? Number(budgetText) : null;
    if (!Number.isInteger(size) || size < 1 || size > maxSize) {
      setFormError(
        `El tamaño de la propuesta debe ser un entero entre 1 y ${maxSize}.`,
      );
      return;
    }
    if (budget !== null && (!Number.isFinite(budget) || budget <= 0)) {
      setFormError("El presupuesto total debe ser positivo.");
      return;
    }
    optimize.mutate({ size, total_budget: budget, restarts, seed });
  }

  const result = optimize.data;
  return (
    <section
      className="workspace-card feature-card module-card"
      aria-labelledby="proposal-title"
      aria-busy={optimize.isPending}
    >
      <h2 id="proposal-title">Armar propuesta (Hill Climbing)</h2>
      <p>
        Parte de una combinación inicial y cambia un inmueble a la vez mientras
        mejore el objetivo, con reinicios aleatorios para evitar óptimos
        locales.
      </p>
      <form className="filter-form" onSubmit={submit} noValidate>
        <div className="field-group">
          <label className="form-field" htmlFor="proposal-size">
            Tamaño de la propuesta
          </label>
          <input
            id="proposal-size"
            name="size"
            type="number"
            min={1}
            max={maxSize}
            defaultValue={3}
          />
        </div>
        <div className="field-group">
          <label className="form-field" htmlFor="proposal-budget">
            Presupuesto total (opcional)
          </label>
          <input
            id="proposal-budget"
            name="total_budget"
            type="number"
            min={0}
          />
        </div>
        <button
          className="primary-action"
          type="submit"
          disabled={optimize.isPending}
        >
          {optimize.isPending ? "Optimizando…" : "Optimizar propuesta"}
        </button>
      </form>
      {(formError || optimize.isError) && (
        <p className="form-error" role="alert">
          {formError ?? optimize.error?.message}
        </p>
      )}
      {result && (
        <div className="result-panel" role="status">
          <dl className="metric-tiles">
            <div>
              <dt>Objetivo inicial</dt>
              <dd>{result.initial_objective.toFixed(3)}</dd>
            </div>
            <div>
              <dt>Objetivo final</dt>
              <dd>{result.objective.toFixed(3)}</dd>
            </div>
            <div>
              <dt>Iteraciones</dt>
              <dd>{result.iterations}</dd>
            </div>
            <div>
              <dt>Reinicios</dt>
              <dd>{result.restarts}</dd>
            </div>
          </dl>
          <h3>Inmuebles seleccionados</h3>
          <ul className="contact-list">
            {result.selected.map(({ id, property }) => (
              <li key={id}>
                <strong>
                  {property.code} · {property.title}
                </strong>{" "}
                — {property.district} · {formatArea(property.area_m2)} ·{" "}
                {formatMoney(property.monthly_rent, property.currency)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
