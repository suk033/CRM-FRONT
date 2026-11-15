import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { components } from "../../api/schema";
import { EmptyState, Panel, Pill, StatTile } from "../../components/ui";
import { ConfirmDialog, useToast } from "../../components/Feedback";
import { call, featureLabel } from "../inventory/labels";
import { ModelReport } from "./ModelReport";
import "./model-panel.css";

type Model = components["schemas"]["ModelResponse"];
type Metrics = Record<string, number>;
type Pending =
  { kind: "train" } | { kind: "activate"; version: number } | { kind: "rules" };

const evidenceKey = ["ml-evidence"];
const modelsKey = ["ml-models"];
const behaviorKey = ["ml-behavior"];
const dateFormat = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function percent(value: number | null | undefined) {
  return value === null || value === undefined
    ? "—"
    : `${Math.round(value * 100)} %`;
}
function ofTen(value: number) {
  return Math.round(value * 10);
}
function metricsOf(model: Model, key: "model" | "rule_baseline"): Metrics {
  const value = (model.metrics as Record<string, unknown>)[key];
  return (value ?? {}) as Metrics;
}
function crossValidation(model: Model) {
  return (
    model.metrics as {
      cross_validation?: { mean: number; std: number; folds: number };
    }
  ).cross_validation;
}
function improves(model: Model) {
  return Boolean(
    (model.metrics as { improves_on_rules?: boolean }).improves_on_rules,
  );
}

/** Admin view of the recommendation model: what it does, how well it works, how it behaves, and its versions. */
export function ModelPanel() {
  const client = useQueryClient();
  const { notify } = useToast();
  const [pending, setPending] = useState<Pending | null>(null);
  const evidence = useQuery({
    queryKey: evidenceKey,
    retry: false,
    queryFn: () => call(() => api.GET("/api/v1/ml/evidence")),
  });
  const models = useQuery({
    queryKey: modelsKey,
    retry: false,
    queryFn: () => call(() => api.GET("/api/v1/ml/models")),
  });
  const behavior = useQuery({
    queryKey: behaviorKey,
    retry: false,
    queryFn: () => call(() => api.GET("/api/v1/ml/behavior")),
  });
  const refresh = () =>
    Promise.all(
      [evidenceKey, modelsKey, behaviorKey].map((queryKey) =>
        client.invalidateQueries({ queryKey }),
      ),
    );

  const train = useMutation({
    mutationFn: () => call(() => api.POST("/api/v1/ml/models")),
  });
  const activate = useMutation({
    mutationFn: (version: number | null) =>
      call(() => api.PUT("/api/v1/ml/active-model", { body: { version } })),
  });

  function confirm() {
    if (!pending) return;
    const action = pending;
    const done = (message: string) => {
      setPending(null);
      notify(message);
      void refresh();
    };
    const failed = (error: Error) => {
      setPending(null);
      notify(error.message, "danger");
    };
    if (action.kind === "train") {
      train.mutate(undefined, {
        onSuccess: (model) =>
          done(`Versión ${model.version} entrenada y activada.`),
        onError: failed,
      });
    } else {
      activate.mutate(action.kind === "activate" ? action.version : null, {
        onSuccess: (result) =>
          done(
            result.version === null
              ? "El ranking usa ahora solo las reglas."
              : `La versión ${result.version} quedó activa.`,
          ),
        onError: failed,
      });
    }
  }

  const data = evidence.data;
  const active = data?.active_model ?? null;
  const versions = models.data?.items ?? [];

  return (
    <div className="ws-page model-panel">
      <Panel title="¿Qué hace el modelo?">
        <ol className="model-steps">
          <li>
            <strong>Aprende</strong>
            Cada vez que un asesor acepta o rechaza un local para un
            requerimiento, esa decisión se guarda.
          </li>
          <li>
            <strong>Estima</strong>
            Con esas decisiones calcula, para cada local candidato, la
            probabilidad de que el cliente lo acepte.
          </li>
          <li>
            <strong>Ordena</strong>
            Muestra primero los locales con más probabilidad y explica qué
            criterio sumó o restó.
          </li>
        </ol>
        <p className="ws-muted">
          La decisión final siempre es del asesor. Si no hay un modelo activo,
          la lista se ordena con las reglas (precio, área, distrito, tipo,
          características y disponibilidad).
        </p>
      </Panel>

      {evidence.isLoading && <p role="status">Cargando el modelo…</p>}
      {evidence.isError && (
        <p className="form-error" role="alert">
          {evidence.error.message}
        </p>
      )}

      {data && (
        <div className="ws-stats" aria-label="Estado del modelo">
          <StatTile
            label="Ranking actual"
            value={active ? `Modelo v${active.version}` : "Solo reglas"}
            tone={active ? "success" : "neutral"}
          />
          <StatTile
            label="Decisiones registradas"
            value={data.decisions}
            tone="info"
          />
          <StatTile
            label="Aceptadas / rechazadas"
            value={`${data.accepted} / ${data.rejected}`}
          />
          <StatTile
            label="Listo para entrenar"
            value={data.trainable ? "Sí" : "No"}
            hint={`Mínimo ${data.min_samples} decisiones y ${data.min_per_class} de cada tipo`}
            tone={data.trainable ? "success" : "warning"}
          />
        </div>
      )}

      {active && <Performance model={active} />}
      {active && <Behavior data={behavior.data} loading={behavior.isLoading} />}
      {active && <Weights model={active} />}

      <Panel
        title="Versiones del modelo"
        actions={
          <span className="model-actions">
            <button
              type="button"
              className="secondary-action"
              disabled={!active || activate.isPending}
              onClick={() => setPending({ kind: "rules" })}
            >
              Usar solo reglas
            </button>
            <button
              type="button"
              className="primary-action"
              disabled={!data?.trainable || train.isPending}
              onClick={() => setPending({ kind: "train" })}
            >
              Entrenar nueva versión
            </button>
          </span>
        }
      >
        {models.isError && (
          <p className="form-error" role="alert">
            {models.error.message}
          </p>
        )}
        {models.data && versions.length === 0 && (
          <EmptyState>Todavía no hay versiones entrenadas.</EmptyState>
        )}
        {versions.length > 0 && (
          <div className="ws-table-wrap">
            <table className="ws-table">
              <thead>
                <tr>
                  <th scope="col">Versión</th>
                  <th scope="col">Entrenada</th>
                  <th scope="col">Decisiones usadas</th>
                  <th scope="col">Exactitud balanceada</th>
                  <th scope="col">Frente a reglas</th>
                  <th scope="col">Estado</th>
                  <th scope="col">
                    <span className="ws-visually-hidden">Acción</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {versions.map((model) => {
                  const balanced = metricsOf(model, "model").balanced_accuracy;
                  return (
                    <tr key={model.version}>
                      <td>
                        <strong>v{model.version}</strong>
                      </td>
                      <td>{dateFormat.format(new Date(model.trained_at))}</td>
                      <td>{model.sample_count}</td>
                      <td>{percent(balanced)}</td>
                      <td>
                        <Pill tone={improves(model) ? "success" : "warning"}>
                          {improves(model) ? "Mejora" : "No mejora"}
                        </Pill>
                      </td>
                      <td>
                        {model.is_active ? (
                          <Pill tone="success">Activa</Pill>
                        ) : (
                          <Pill>Inactiva</Pill>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="secondary-action"
                          disabled={model.is_active || activate.isPending}
                          onClick={() =>
                            setPending({
                              kind: "activate",
                              version: model.version,
                            })
                          }
                        >
                          Activar
                          <span className="ws-visually-hidden">
                            {" "}
                            versión {model.version}
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {active && (
        <details className="ws-panel model-details">
          <summary>Detalle técnico de la versión activa</summary>
          <ModelReport model={active} />
        </details>
      )}

      <ConfirmDialog
        open={pending !== null}
        title={
          pending?.kind === "train"
            ? "¿Entrenar una nueva versión?"
            : pending?.kind === "rules"
              ? "¿Usar solo las reglas?"
              : `¿Activar la versión ${pending?.kind === "activate" ? pending.version : ""}?`
        }
        description={
          pending?.kind === "train"
            ? `Se entrenará con las ${data?.decisions ?? 0} decisiones registradas y quedará activa en lugar de la actual.`
            : pending?.kind === "rules"
              ? "El modelo se desactiva y los candidatos se ordenan con las reglas. Puedes volver a activar cualquier versión."
              : "Los rankings de candidatos usarán esta versión desde ahora."
        }
        confirmLabel={pending?.kind === "train" ? "Entrenar" : "Confirmar"}
        busy={train.isPending || activate.isPending}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}

function Performance({ model }: { model: Model }) {
  const m = metricsOf(model, "model");
  const r = metricsOf(model, "rule_baseline");
  const cv = crossValidation(model);
  const rows = [
    {
      label: "Aciertos en general",
      model: `${Math.round((m.accuracy ?? 0) * 100)} de cada 100`,
      rules: `${Math.round((r.accuracy ?? 0) * 100)} de cada 100`,
      help: "Casos de prueba en los que predijo bien si el cliente aceptaría o no.",
    },
    {
      label: "Detecta lo que el cliente acepta",
      model: `${ofTen(m.recall ?? 0)} de cada 10`,
      rules: `${ofTen(r.recall ?? 0)} de cada 10`,
      help: "De los locales que el cliente terminó aceptando, cuántos marcó como recomendados.",
    },
    {
      label: "Cuando recomienda, acierta",
      model: `${ofTen(m.precision ?? 0)} de cada 10`,
      rules: `${ofTen(r.precision ?? 0)} de cada 10`,
      help: "De los locales que recomendó, cuántos fueron aceptados.",
    },
  ];
  return (
    <Panel
      title={`¿Qué tan bien funciona? · versión ${model.version}`}
      actions={
        <Pill tone={improves(model) ? "success" : "warning"}>
          {improves(model) ? "Mejora a las reglas" : "No mejora a las reglas"}
        </Pill>
      }
    >
      <div className="ws-table-wrap">
        <table className="ws-table" aria-label="Desempeño frente a las reglas">
          <thead>
            <tr>
              <th scope="col">Pregunta</th>
              <th scope="col">Modelo</th>
              <th scope="col">Reglas</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">
                  {row.label}
                  <span className="ws-muted">{row.help}</span>
                </th>
                <td>
                  <strong>{row.model}</strong>
                </td>
                <td>{row.rules}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cv && (
        <p className="ws-muted">
          Estabilidad: repetido en {cv.folds} pruebas con datos distintos,
          mantiene una exactitud balanceada de{" "}
          <strong>{percent(cv.mean)}</strong> (± {percent(cv.std)}). Entrenada
          con {model.sample_count} decisiones.
        </p>
      )}
    </Panel>
  );
}

function Behavior({
  data,
  loading,
}: {
  data?: components["schemas"]["ModelBehaviorResponse"];
  loading: boolean;
}) {
  if (loading) return <p role="status">Cargando el comportamiento…</p>;
  if (!data || !data.open_candidates || !data.history) return null;
  const open = data.open_candidates;
  const share = (value: number) =>
    open.total ? (value / open.total) * 100 : 0;
  const buckets = [
    { label: "Alta (70 % o más)", value: open.high, tone: "success" },
    { label: "Media (40 % a 69 %)", value: open.medium, tone: "warning" },
    { label: "Baja (menos de 40 %)", value: open.low, tone: "danger" },
  ] as const;
  return (
    <Panel title="¿Cómo se comporta hoy?">
      <div className="ws-grid ws-grid-2">
        <div>
          <p className="model-subtitle">
            Probabilidad que asigna a los {open.total} candidatos de
            requerimientos abiertos
          </p>
          <ul
            className="model-buckets"
            aria-label="Candidatos por probabilidad"
          >
            {buckets.map((bucket) => (
              <li key={bucket.label}>
                <span>{bucket.label}</span>
                <span className={`model-bar ws-tone-${bucket.tone}`}>
                  <span style={{ width: `${share(bucket.value)}%` }} />
                </span>
                <strong>{bucket.value}</strong>
              </li>
            ))}
          </ul>
        </div>
        <dl className="model-facts">
          <div>
            <dt>Probabilidad promedio que dio a lo que se aceptó</dt>
            <dd>{percent(data.history.avg_probability_accepted)}</dd>
          </div>
          <div>
            <dt>Probabilidad promedio que dio a lo que se rechazó</dt>
            <dd>{percent(data.history.avg_probability_rejected)}</dd>
          </div>
          <div>
            <dt>Coincide con las decisiones de los asesores</dt>
            <dd>{percent(data.history.agreement_rate)}</dd>
          </div>
          <div>
            <dt>Coincide con la recomendación de las reglas</dt>
            <dd>{percent(data.rule_agreement_rate)}</dd>
          </div>
        </dl>
      </div>
      <p className="ws-muted">
        Cuanto más separadas estén las probabilidades de lo aceptado y lo
        rechazado, mejor distingue el modelo un buen candidato de uno malo. La
        coincidencia con los asesores se mide sobre las {data.history.decisions}{" "}
        decisiones registradas.
      </p>
    </Panel>
  );
}

function Weights({ model }: { model: Model }) {
  const items = model.feature_names
    .map((name, index) => ({ name, value: model.coefficients[index] ?? 0 }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const max = Math.max(...items.map((item) => Math.abs(item.value)), 0.0001);
  return (
    <Panel title="¿Qué criterios pesan más?">
      <ul className="model-weights" aria-label="Peso de cada criterio">
        {items.map((item) => (
          <li key={item.name}>
            <span>{featureLabel(item.name)}</span>
            <span
              className={`model-bar ${item.value >= 0 ? "ws-tone-info" : "ws-tone-danger"}`}
            >
              <span
                style={{ width: `${(Math.abs(item.value) / max) * 100}%` }}
              />
            </span>
            <span className="ws-muted">
              {item.value >= 0 ? "suma" : "resta"}
            </span>
          </li>
        ))}
      </ul>
      <p className="ws-muted">
        Una barra más larga significa que ese criterio influye más en la
        probabilidad de aceptación.
      </p>
    </Panel>
  );
}
