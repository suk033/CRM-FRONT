import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api/client";
import type { components } from "../../api/schema";
import {
  call,
  formatArea,
  formatMoney,
  propertyTypeLabels,
  requirementStatusLabels,
} from "../inventory/labels";
import { CandidateList, type Decision } from "./CandidateList";
import { ProposalSection } from "./ProposalSection";
import { RouteSection } from "./RouteSection";

type MatchResponse = components["schemas"]["MatchResponse"];
type Requirement = components["schemas"]["RequirementResponse"];

function RequirementSummary({ requirement }: { requirement: Requirement }) {
  return (
    <dl className="detail-list detail-grid">
      {[
        ["Código", requirement.code],
        ["Tipo", propertyTypeLabels[requirement.property_type]],
        ["Ciudad", requirement.city],
        ["Distritos", requirement.districts.join(", ") || "Cualquiera"],
        [
          "Área",
          `${formatArea(requirement.min_area_m2)} – ${formatArea(requirement.max_area_m2)}`,
        ],
        ["Presupuesto mensual", formatMoney(requirement.max_monthly_budget)],
        [
          "Características",
          requirement.required_features.join(", ") || "Sin requisitos",
        ],
        ["Estado", requirementStatusLabels[requirement.status]],
      ].map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RequirementDetailPage() {
  const { requirementId = "" } = useParams();
  const client = useQueryClient();
  const key = ["matches", requirementId];
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const matches = useQuery({
    queryKey: key,
    enabled: Boolean(requirementId),
    retry: false,
    queryFn: () =>
      call(() =>
        api.GET("/api/v1/requirements/{requirement_id}/matches", {
          params: { path: { requirement_id: requirementId } },
        }),
      ),
  });
  const rescore = useMutation({
    mutationFn: () =>
      call(() =>
        api.POST("/api/v1/requirements/{requirement_id}/matches", {
          params: { path: { requirement_id: requirementId } },
        }),
      ),
    onSuccess: (data) => client.setQueryData(key, data),
  });
  const decide = useMutation({
    mutationFn: ({ candidateId, ...body }: Decision) =>
      call(() =>
        api.PUT(
          "/api/v1/requirements/{requirement_id}/candidates/{candidate_id}/decision",
          {
            params: {
              path: {
                requirement_id: requirementId,
                candidate_id: candidateId,
              },
            },
            body,
          },
        ),
      ),
    onMutate: () => setDecisionError(null),
    onSuccess: (updated) =>
      client.setQueryData<MatchResponse>(key, (current) =>
        current
          ? {
              ...current,
              candidates: current.candidates.map((candidate) =>
                candidate.id === updated.id ? updated : candidate,
              ),
            }
          : current,
      ),
    onError: (error) => setDecisionError(error.message),
  });

  if (matches.isLoading) {
    return (
      <section className="workspace-card feature-card" aria-busy="true">
        <p className="eyebrow">REQUERIMIENTOS</p>
        <h1>Cargando requerimiento…</h1>
      </section>
    );
  }
  if (!matches.data) {
    return (
      <section className="workspace-card feature-card">
        <p className="eyebrow">REQUERIMIENTOS</p>
        <h1>No pudimos abrir el requerimiento</h1>
        <p className="form-error" role="alert">
          {matches.error?.message}
        </p>
        <Link className="secondary-action action-link" to="/requerimientos">
          Volver a requerimientos
        </Link>
      </section>
    );
  }

  const { requirement, candidates, ranking, model_version } = matches.data;
  return (
    <div className="module-page">
      <section
        className="workspace-card feature-card module-card"
        aria-labelledby="requirement-title"
      >
        <Link className="new-company-back" to="/requerimientos">
          Volver a Requerimientos
        </Link>
        <p className="eyebrow">DETALLE DE REQUERIMIENTO</p>
        <h1 id="requirement-title">{requirement.title}</h1>
        <RequirementSummary requirement={requirement} />
      </section>

      <section
        className="workspace-card feature-card module-card"
        aria-labelledby="candidates-title"
        aria-busy={rescore.isPending}
      >
        <h2 id="candidates-title">Candidatos</h2>
        <p>
          {ranking === "model"
            ? `Ranking por modelo de aprendizaje (versión ${model_version}) con reglas explicables como respaldo.`
            : "Ranking por reglas transparentes: cada criterio aporta un peso al puntaje."}
        </p>
        <div className="button-row">
          <button
            className="primary-action"
            disabled={rescore.isPending}
            onClick={() => rescore.mutate()}
          >
            {rescore.isPending ? "Buscando…" : "Buscar candidatos"}
          </button>
        </div>
        {rescore.isError && (
          <p className="form-error" role="alert">
            {rescore.error.message}
          </p>
        )}
        {decisionError && (
          <p className="form-error" role="alert">
            {decisionError}
          </p>
        )}
        {candidates.length === 0 ? (
          <p className="empty-state">
            Aún no hay candidatos. Usa «Buscar candidatos» para puntuar el
            inventario.
          </p>
        ) : (
          <CandidateList
            candidates={candidates}
            busy={decide.isPending}
            onDecide={(decision) => decide.mutate(decision)}
          />
        )}
      </section>

      <ProposalSection requirementId={requirementId} />
      <RouteSection candidates={candidates} />
    </div>
  );
}
