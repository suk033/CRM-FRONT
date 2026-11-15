import { useState } from "react";
import { Link } from "react-router-dom";
import { formatDue } from "../activities/activities";
import {
  Avatar,
  EmptyState,
  PageHeader,
  Panel,
  Pill,
} from "../../components/ui";
import {
  companyStatusLabels,
  useCompaniesOverview,
  type CompanyOverviewItem,
  type CompanyStatus,
} from "./companyApi";
import "./companies.css";

type Filter = CompanyStatus | "all";
const filters: { id: Filter; label: string }[] = [
  { id: "active", label: "Activas" },
  { id: "inactive", label: "Inactivas" },
  { id: "all", label: "Todas" },
];

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function matches(company: CompanyOverviewItem, query: string) {
  if (!query) return true;
  return [company.legal_name, company.trade_name, company.tax_id].some(
    (value) => value && normalize(value).includes(query),
  );
}

export function CompaniesOverviewPage() {
  const overview = useCompaniesOverview();
  const [filter, setFilter] = useState<Filter>("active");
  const [search, setSearch] = useState("");
  const items = overview.data?.items ?? [];
  const counts: Record<Filter, number> = {
    active: items.filter((item) => item.status === "active").length,
    inactive: items.filter((item) => item.status === "inactive").length,
    all: items.length,
  };
  const query = normalize(search.trim());
  const visible = items.filter(
    (item) =>
      (filter === "all" || item.status === filter) && matches(item, query),
  );

  return (
    <div className="ws-page">
      <PageHeader
        eyebrow="Cartera"
        title="Empresas"
        description="Empresas con requerimientos abiertos o actividad reciente, y lo que tienen pendiente."
        actions={
          <Link className="primary-action action-link" to="/empresas/nueva">
            Nueva empresa
          </Link>
        }
      />
      <Panel>
        <div className="ws-toolbar">
          <div className="ws-chips" role="group" aria-label="Estado">
            {filters.map((option) => (
              <button
                key={option.id}
                type="button"
                className="ws-chip"
                aria-pressed={filter === option.id}
                onClick={() => setFilter(option.id)}
              >
                {option.label}
                <span className="ws-chip-count">{counts[option.id]}</span>
              </button>
            ))}
          </div>
          <input
            className="ws-search"
            type="search"
            aria-label="Buscar empresa por nombre o RUC"
            placeholder="Buscar por nombre o RUC"
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
        </div>
        {overview.isLoading && <p role="status">Cargando empresas…</p>}
        {overview.isError && (
          <p className="form-error" role="alert">
            {overview.error.message}
          </p>
        )}
        {overview.data && visible.length === 0 && (
          <EmptyState>
            {query
              ? "Ninguna empresa coincide con la búsqueda."
              : "No hay empresas en este filtro."}
          </EmptyState>
        )}
        {visible.length > 0 && (
          <div className="ws-table-wrap">
            <table className="ws-table" aria-label="Empresas">
              <thead>
                <tr>
                  <th scope="col">Empresa</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Asesor</th>
                  <th scope="col">Req. abiertos</th>
                  <th scope="col">Pendientes</th>
                  <th scope="col">Próxima actividad</th>
                  <th scope="col">Última actividad</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((company) => (
                  <tr key={company.id}>
                    <td>
                      <Link to={`/empresas/${company.id}`}>
                        {company.trade_name || company.legal_name}
                      </Link>
                      <span className="ws-muted">
                        RUC: {company.tax_id || "No registrado"}
                      </span>
                    </td>
                    <td>
                      <Pill
                        tone={
                          company.status === "active" ? "success" : "neutral"
                        }
                      >
                        {companyStatusLabels[company.status]}
                      </Pill>
                    </td>
                    <td>
                      {company.assigned_advisor_email ? (
                        <span className="ws-cell-person">
                          <Avatar
                            email={company.assigned_advisor_email}
                            size="sm"
                          />
                          {company.assigned_advisor_email}
                        </span>
                      ) : (
                        <span className="ws-muted">Sin asignar</span>
                      )}
                    </td>
                    <td>
                      {company.open_requirements}
                      <span className="ws-muted">
                        de {company.total_requirements}
                      </span>
                    </td>
                    <td>
                      {company.pending_activities}
                      {company.overdue_activities > 0 && (
                        <>
                          {" "}
                          <Pill tone="danger">
                            {company.overdue_activities} vencida
                            {company.overdue_activities === 1 ? "" : "s"}
                          </Pill>
                        </>
                      )}
                    </td>
                    <td>
                      {company.next_activity_at
                        ? formatDue(company.next_activity_at)
                        : "—"}
                    </td>
                    <td>
                      {company.last_activity_at
                        ? formatDue(company.last_activity_at)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
