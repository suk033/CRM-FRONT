import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { components } from "../../api/schema";
import { call } from "../inventory/labels";
import { ModelReport } from "./ModelReport";

type Props = { user?: components["schemas"]["CurrentUserResponse"] };
const evidenceKey = ["ml-evidence"];

export function LearningPage({ user }: Props) {
  const client = useQueryClient();
  const evidence = useQuery({
    queryKey: evidenceKey,
    retry: false,
    queryFn: () => call(() => api.GET("/api/v1/ml/evidence")),
  });
  const train = useMutation({
    mutationFn: () => call(() => api.POST("/api/v1/ml/models")),
    onSuccess: () => client.invalidateQueries({ queryKey: evidenceKey }),
  });
  const data = evidence.data;

  return (
    <div className="module-page">
      <section
        className="workspace-card feature-card module-card"
        aria-labelledby="learning-title"
      >
        <p className="eyebrow">APRENDIZAJE</p>
        <h1 id="learning-title">Aprendizaje</h1>
        <p>
          Cada aceptación o rechazo de un candidato se guarda como evidencia.
          Con suficientes decisiones de ambas clases se entrena una regresión
          logística que complementa el ranking por reglas.
        </p>
        {evidence.isLoading && <p role="status">Cargando evidencia…</p>}
        {evidence.isError && (
          <p className="form-error" role="alert">
            {evidence.error.message}
          </p>
        )}
        {data && (
          <>
            <dl className="metric-tiles">
              <div>
                <dt>Decisiones</dt>
                <dd>{data.decisions}</dd>
              </div>
              <div>
                <dt>Aceptadas</dt>
                <dd>{data.accepted}</dd>
              </div>
              <div>
                <dt>Rechazadas</dt>
                <dd>{data.rejected}</dd>
              </div>
              <div>
                <dt>Mínimo requerido</dt>
                <dd>
                  {data.min_samples} · {data.min_per_class} por clase
                </dd>
              </div>
            </dl>
            <p className={data.trainable ? "form-success" : "empty-state"}>
              {data.trainable
                ? "Hay evidencia suficiente para entrenar un nuevo modelo."
                : "Aún falta evidencia para entrenar: registra más aceptaciones y rechazos."}
            </p>
          </>
        )}
        {user?.role === "admin" && (
          <div className="button-row">
            <button
              className="primary-action"
              disabled={train.isPending}
              onClick={() => train.mutate()}
            >
              {train.isPending ? "Entrenando…" : "Entrenar nuevo modelo"}
            </button>
          </div>
        )}
        {train.isError && (
          <p className="form-error" role="alert">
            {train.error.message}
          </p>
        )}
        {train.isSuccess && (
          <p className="form-success" role="status">
            Modelo versión {train.data.version} entrenado y activado.
          </p>
        )}
      </section>
      {data?.active_model ? (
        <ModelReport model={data.active_model} />
      ) : (
        data && (
          <section className="workspace-card feature-card module-card">
            <h2>Sin modelo activo</h2>
            <p className="empty-state">
              El ranking usa solo reglas transparentes hasta entrenar el primer
              modelo.
            </p>
          </section>
        )
      )}
    </div>
  );
}
