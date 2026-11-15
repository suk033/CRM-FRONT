import { useState } from "react";
import type { FormEvent } from "react";
import type { components } from "../../api/schema";
import {
  candidateStatusLabels,
  featureLabel,
  formatArea,
  formatMoney,
  formatPercent,
} from "../inventory/labels";

type Candidate = components["schemas"]["CandidateResponse"];
export type Decision = {
  candidateId: string;
  status: "shortlisted" | "accepted" | "rejected";
  reason: string | null;
};

function Breakdown({ candidate }: { candidate: Candidate }) {
  const names = Object.keys(candidate.rule_contributions);
  return (
    <details className="candidate-breakdown">
      <summary>Ver desglose por criterio</summary>
      <table className="data-table compact-table">
        <thead>
          <tr>
            <th scope="col">Criterio</th>
            <th scope="col">Ajuste</th>
            <th scope="col">Aporte reglas</th>
            {candidate.ml_contributions && <th scope="col">Aporte modelo</th>}
          </tr>
        </thead>
        <tbody>
          {names.map((name) => (
            <tr key={name}>
              <th scope="row">{featureLabel(name)}</th>
              <td>{formatPercent(candidate.features[name] ?? 0, 0)}</td>
              <td>{candidate.rule_contributions[name].toFixed(3)}</td>
              {candidate.ml_contributions && (
                <td>{(candidate.ml_contributions[name] ?? 0).toFixed(3)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        <strong>Brechas:</strong>{" "}
        {candidate.gaps.length > 0
          ? candidate.gaps.map(featureLabel).join(", ")
          : "Ninguna, cumple todos los criterios."}
      </p>
    </details>
  );
}

function CandidateItem({
  candidate,
  rank,
  busy,
  onDecide,
}: {
  candidate: Candidate;
  rank: number;
  busy: boolean;
  onDecide: (decision: Decision) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reasonError, setReasonError] = useState(false);
  const { property } = candidate;
  const reasonId = `reason-${candidate.id}`;

  function submitRejection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(
      new FormData(event.currentTarget).get("reason") ?? "",
    ).trim();
    if (!reason) {
      setReasonError(true);
      return;
    }
    setReasonError(false);
    setRejecting(false);
    onDecide({ candidateId: candidate.id, status: "rejected", reason });
  }

  return (
    <li className="candidate-item">
      <div className="candidate-header">
        <h3>
          #{rank} · {property.code} · {property.title}
        </h3>
        <span className={`badge badge-${candidate.status}`}>
          {candidateStatusLabels[candidate.status]}
        </span>
      </div>
      <p>
        {property.district}, {property.city} · {formatArea(property.area_m2)} ·{" "}
        {formatMoney(property.monthly_rent, property.currency)}
        {property.is_strategic_stock && " · Stock estratégico"}
      </p>
      <div className="score-row">
        <span>
          Puntaje reglas: <strong>{formatPercent(candidate.rule_score)}</strong>
        </span>
        {candidate.ml_probability !== null && (
          <span>
            Probabilidad modelo:{" "}
            <strong>{formatPercent(candidate.ml_probability)}</strong>
          </span>
        )}
      </div>
      <div className="score-bar" aria-hidden="true">
        <span
          style={{ width: `${Math.min(100, candidate.rule_score * 100)}%` }}
        />
      </div>
      {candidate.decision_reason && (
        <p>
          <strong>Motivo:</strong> {candidate.decision_reason}
        </p>
      )}
      <Breakdown candidate={candidate} />
      <div className="button-row">
        <button
          className="secondary-action"
          disabled={busy}
          aria-label={`Preseleccionar ${property.code}`}
          onClick={() =>
            onDecide({
              candidateId: candidate.id,
              status: "shortlisted",
              reason: null,
            })
          }
        >
          Preseleccionar
        </button>
        <button
          className="secondary-action"
          disabled={busy}
          aria-label={`Aceptar ${property.code}`}
          onClick={() =>
            onDecide({
              candidateId: candidate.id,
              status: "accepted",
              reason: null,
            })
          }
        >
          Aceptar
        </button>
        <button
          className="secondary-action"
          disabled={busy}
          aria-label={`Rechazar ${property.code}`}
          aria-expanded={rejecting}
          onClick={() => setRejecting((open) => !open)}
        >
          Rechazar
        </button>
      </div>
      {rejecting && (
        <form className="lookup-form" onSubmit={submitRejection} noValidate>
          <label className="form-field" htmlFor={reasonId}>
            Motivo del rechazo
          </label>
          <input id={reasonId} name="reason" maxLength={500} />
          {reasonError && (
            <p className="form-error" role="alert">
              Indica el motivo del rechazo.
            </p>
          )}
          <button className="primary-action" type="submit" disabled={busy}>
            Confirmar rechazo
          </button>
        </form>
      )}
    </li>
  );
}

export function CandidateList({
  candidates,
  busy,
  onDecide,
}: {
  candidates: Candidate[];
  busy: boolean;
  onDecide: (decision: Decision) => void;
}) {
  return (
    <ol className="candidate-list" aria-label="Ranking de candidatos">
      {candidates.map((candidate, index) => (
        <CandidateItem
          key={candidate.id}
          candidate={candidate}
          rank={index + 1}
          busy={busy}
          onDecide={onDecide}
        />
      ))}
    </ol>
  );
}
