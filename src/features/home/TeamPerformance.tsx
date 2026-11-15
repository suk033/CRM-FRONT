import { Link } from "react-router-dom";
import { Avatar, EmptyState, Panel, Pill, StatTile } from "../../components/ui";
import { useAdvisorReport, useCompaniesOverview } from "./workspaceData";

type Advisor = {
  email: string;
  companies: number;
  open_requirements: number;
  activities_done_30d: number;
  activities_pending: number;
  activities_overdue: number;
  decisions_accepted: number;
  decisions_rejected: number;
  acceptance_rate: number | null;
};

function percent(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)} %`;
}
function completion(advisor: Advisor) {
  const total = advisor.activities_done_30d + advisor.activities_pending;
  return total ? advisor.activities_done_30d / total : null;
}
function shortName(email: string) {
  return email.split("@")[0];
}

/** Admin home: how SuPra is performing, by collaborator. */
export function TeamPerformance() {
  const report = useAdvisorReport();
  const overview = useCompaniesOverview();
  const advisors = (report.data?.advisors ?? []) as Advisor[];
  const companies = overview.data?.items ?? [];
  const sum = (pick: (advisor: Advisor) => number) =>
    advisors.reduce((total, advisor) => total + pick(advisor), 0);
  const accepted = sum((a) => a.decisions_accepted);
  const decided = accepted + sum((a) => a.decisions_rejected);
  const ready = report.isSuccess && overview.isSuccess;
  const value = (content: string | number) => (ready ? content : "…");
  const openRequirements = companies.reduce(
    (total, company) => total + company.open_requirements,
    0,
  );
  const max = Math.max(
    1,
    ...advisors.map((a) =>
      Math.max(a.activities_done_30d, a.activities_pending),
    ),
  );
  const ranked = [...advisors].sort(
    (a, b) => (completion(b) ?? -1) - (completion(a) ?? -1),
  );

  return (
    <>
      <div className="ws-stats" aria-label="Rendimiento de SuPra">
        <StatTile
          label="Empresas activas"
          tone="success"
          value={value(`${overview.data?.active ?? 0} de ${companies.length}`)}
        />
        <StatTile
          label="Requerimientos abiertos"
          tone="info"
          value={value(openRequirements)}
        />
        <StatTile
          label="Actividades completadas"
          hint={`Últimos ${report.data?.window_days ?? 30} días`}
          value={value(sum((a) => a.activities_done_30d))}
        />
        <StatTile
          label="Actividades vencidas"
          tone="danger"
          hint={`${sum((a) => a.activities_pending)} pendientes en total`}
          value={value(sum((a) => a.activities_overdue))}
        />
        <StatTile
          label="Aceptación de candidatos"
          tone="warning"
          hint={`${accepted} aceptados de ${decided} decididos`}
          value={value(decided ? percent(accepted / decided) : "—")}
        />
      </div>

      <div className="ws-grid ws-grid-main">
        <Panel
          title="Actividades por colaborador"
          actions={
            <Link className="secondary-action" to="/perfil?seccion=rendimiento">
              Ver tabla completa
            </Link>
          }
        >
          {report.isLoading && <p role="status">Cargando rendimiento…</p>}
          {report.isError && (
            <p className="form-error" role="alert">
              {report.error.message}
            </p>
          )}
          {report.isSuccess && advisors.length === 0 && (
            <EmptyState>No hay asesores registrados.</EmptyState>
          )}
          {advisors.length > 0 && (
            <>
              <ul className="perf-legend" aria-label="Leyenda">
                <li>
                  <span
                    className="perf-swatch perf-series-1"
                    aria-hidden="true"
                  />
                  Completadas (30 días)
                </li>
                <li>
                  <span
                    className="perf-swatch perf-series-2"
                    aria-hidden="true"
                  />
                  Pendientes
                </li>
              </ul>
              <ul
                className="perf-chart"
                aria-label="Actividades completadas y pendientes por asesor"
              >
                {advisors.map((advisor) => (
                  <li
                    key={advisor.email}
                    className="perf-row"
                    tabIndex={0}
                    aria-label={`${advisor.email}: ${advisor.activities_done_30d} completadas, ${advisor.activities_pending} pendientes, ${advisor.activities_overdue} vencidas`}
                  >
                    <span className="perf-name">
                      {shortName(advisor.email)}
                    </span>
                    <span className="perf-bars" aria-hidden="true">
                      <span className="perf-bar-line">
                        <span
                          className="perf-bar perf-series-1"
                          style={{
                            width: `${(advisor.activities_done_30d / max) * 100}%`,
                          }}
                        />
                        <span className="perf-value">
                          {advisor.activities_done_30d}
                        </span>
                      </span>
                      <span className="perf-bar-line">
                        <span
                          className="perf-bar perf-series-2"
                          style={{
                            width: `${(advisor.activities_pending / max) * 100}%`,
                          }}
                        />
                        <span className="perf-value">
                          {advisor.activities_pending}
                        </span>
                      </span>
                    </span>
                    <span className="perf-tooltip" role="presentation">
                      <strong>{advisor.email}</strong>
                      <span>Completadas: {advisor.activities_done_30d}</span>
                      <span>Pendientes: {advisor.activities_pending}</span>
                      <span>Vencidas: {advisor.activities_overdue}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>

        <Panel title="Colaboradores">
          {ranked.length === 0 && report.isSuccess && (
            <EmptyState>Sin datos de colaboradores.</EmptyState>
          )}
          <ul className="perf-people">
            {ranked.map((advisor) => (
              <li key={advisor.email}>
                <Avatar email={advisor.email} />
                <div>
                  <strong>{advisor.email}</strong>
                  <span className="ws-muted">
                    {advisor.companies} empresas · {advisor.open_requirements}{" "}
                    requerimientos abiertos
                  </span>
                  <span className="perf-people-stats">
                    <span>Cumplimiento {percent(completion(advisor))}</span>
                    <span>Aceptación {percent(advisor.acceptance_rate)}</span>
                    {advisor.activities_overdue > 0 ? (
                      <Pill tone="danger">
                        {advisor.activities_overdue} vencidas
                      </Pill>
                    ) : (
                      <Pill tone="success">Al día</Pill>
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
