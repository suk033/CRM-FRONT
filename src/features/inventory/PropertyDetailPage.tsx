import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api/client";
import type { components } from "../../api/schema";
import {
  EmptyState,
  PageHeader,
  Panel,
  Pill,
  type Tone,
} from "../../components/ui";
import {
  call,
  candidateStatusLabels,
  featureLabel,
  propertyFeatureLabel,
  formatArea,
  formatMoney,
  formatPercent,
  propertyStatusLabels,
  propertyTypeLabels,
  requirementStatusLabels,
  type CandidateStatus,
  type PropertyStatus,
} from "./labels";
import "./inventory.css";

type PropertyMatchItem = components["schemas"]["PropertyMatchItem"];

const statusTones: Record<PropertyStatus, Tone> = {
  available: "success",
  reserved: "warning",
  rented: "neutral",
};
const decisionTones: Record<CandidateStatus, Tone> = {
  suggested: "info",
  shortlisted: "warning",
  accepted: "success",
  rejected: "danger",
};

/** The model probability ranks when the backend has one; otherwise the rule score. */
function matchScore(match: PropertyMatchItem) {
  return match.ml_probability ?? match.rule_score;
}

export function PropertyDetailPage() {
  const { propertyId = "" } = useParams();
  const matches = useQuery({
    queryKey: ["property-matches", propertyId],
    enabled: Boolean(propertyId),
    retry: false,
    queryFn: () =>
      call(() =>
        api.GET("/api/v1/properties/{property_id}/matches", {
          params: { path: { property_id: propertyId } },
        }),
      ),
  });

  if (matches.isLoading) {
    return (
      <div className="ws-page" aria-busy="true">
        <h1>Cargando inmueble…</h1>
      </div>
    );
  }
  if (!matches.data) {
    return (
      <div className="ws-page">
        <h1>No pudimos abrir el inmueble</h1>
        <p className="form-error" role="alert">
          {matches.error?.message}
        </p>
        <Link className="secondary-action action-link" to="/inmuebles">
          Volver a inmuebles
        </Link>
      </div>
    );
  }

  const { property, ranking, model_version } = matches.data;
  const ranked = [...matches.data.matches].sort(
    (a, b) => matchScore(b) - matchScore(a),
  );
  const rankingLabel =
    ranking === "model" ? `Modelo v${model_version ?? "?"}` : "Reglas";

  return (
    <div className="ws-page">
      <Link className="new-company-back" to="/inmuebles">
        <span aria-hidden="true">←</span> Volver a Inmuebles
      </Link>
      <PageHeader
        eyebrow={property.code}
        title={property.title}
        description={
          <span className="property-pills">
            <Pill tone="info">
              {propertyTypeLabels[property.property_type]}
            </Pill>
            <Pill tone={statusTones[property.status]}>
              {propertyStatusLabels[property.status]}
            </Pill>
            {property.is_strategic_stock && (
              <Pill tone="warning">Stock estratégico</Pill>
            )}
          </span>
        }
      />
      <div className="ws-grid-main">
        <Panel
          title="Empresas que hacen match"
          actions={<Pill>Ranking: {rankingLabel}</Pill>}
        >
          {ranked.length === 0 ? (
            <EmptyState>
              No hay requerimientos abiertos en {property.city} que encajen con
              este inmueble.
            </EmptyState>
          ) : (
            <div className="ws-table-wrap">
              <table className="ws-table" aria-label="Ranking de empresas">
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Empresa</th>
                    <th scope="col">Requerimiento</th>
                    <th scope="col">
                      {ranking === "model" ? "Probabilidad" : "Puntaje"}
                    </th>
                    <th scope="col">Brechas</th>
                    <th scope="col">Decisión</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((match, index) => {
                    const score = matchScore(match);
                    return (
                      <tr key={match.requirement_id}>
                        <td>{index + 1}</td>
                        <td>
                          <Link to={`/empresas/${match.company_id}`}>
                            {match.company_name}
                          </Link>
                        </td>
                        <td>
                          <Link to={`/requerimientos/${match.requirement_id}`}>
                            {match.requirement_title}
                          </Link>
                          <span className="ws-muted">
                            {match.requirement_code} ·{" "}
                            {requirementStatusLabels[match.requirement_status]}
                          </span>
                        </td>
                        <td>
                          <span className="property-score">
                            <span
                              className="ws-score-bar"
                              role="meter"
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={Math.round(score * 100)}
                              aria-label={`Afinidad con ${match.company_name}`}
                            >
                              <span style={{ width: `${score * 100}%` }} />
                            </span>
                            {formatPercent(score, 0)}
                          </span>
                        </td>
                        <td>
                          {match.gaps.length === 0 ? (
                            <span className="ws-muted">Sin brechas</span>
                          ) : (
                            <span className="property-chips">
                              {match.gaps.map((gap) => (
                                <Pill key={gap} tone="warning">
                                  {featureLabel(gap)}
                                </Pill>
                              ))}
                            </span>
                          )}
                        </td>
                        <td>
                          {match.candidate_status ? (
                            <Pill tone={decisionTones[match.candidate_status]}>
                              {candidateStatusLabels[match.candidate_status]}
                            </Pill>
                          ) : (
                            <span className="ws-muted">Sin decisión</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel title="Ficha del inmueble">
          <dl className="property-facts">
            {[
              ["Distrito", property.district],
              ["Ciudad", property.city],
              ["Dirección", property.address],
              ["Área", formatArea(property.area_m2)],
              ["Pisos", String(property.floors)],
              [
                "Renta mensual",
                formatMoney(property.monthly_rent, property.currency),
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {property.features.length > 0 && (
            <div>
              <h3 className="property-subtitle">Características</h3>
              <span className="property-chips">
                {property.features.map((feature) => (
                  <Pill key={feature}>{propertyFeatureLabel(feature)}</Pill>
                ))}
              </span>
            </div>
          )}
          {property.notes && <p className="ws-muted">{property.notes}</p>}
        </Panel>
      </div>
    </div>
  );
}
