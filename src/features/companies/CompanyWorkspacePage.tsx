import { useRef, useState } from "react";
import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ActivityForm,
  ActivityList,
  formatDue,
  useActivities,
} from "../activities/activities";
import { CompanyContacts } from "../contacts/CompanyContacts";
import {
  RequirementCreateForm,
  RequirementTable,
  openRequirementStatuses,
  useCompanyRequirements,
} from "../requirements/CompanyRequirements";
import {
  Avatar,
  PageHeader,
  Panel,
  Pill,
  StatTile,
  Tabs,
} from "../../components/ui";
import { GuidedCompanyView } from "./Companies";
import {
  companyStatusLabels,
  detailMessage,
  useCompaniesOverview,
  useCompanyDetail,
  type CompanyDetail,
  type SafeError,
} from "./companyApi";
import "./companies.css";

const tabIds = [
  "resumen",
  "requerimientos",
  "actividades",
  "contactos",
] as const;
type TabId = (typeof tabIds)[number];

function isTab(value: string | null): value is TabId {
  return tabIds.includes(value as TabId);
}

function LoadingCompany() {
  return (
    <section className="workspace-card feature-card" aria-busy="true">
      <p className="eyebrow">EMPRESAS</p>
      <h1>Cargando empresa…</h1>
    </section>
  );
}

export function CompanyWorkspacePage() {
  const { companyId = "" } = useParams();
  const location = useLocation();
  const guided =
    new URLSearchParams(location.search).get("guided") === "contacto";
  const receipt: unknown = location.state;
  const createdHere =
    guided &&
    typeof receipt === "object" &&
    receipt !== null &&
    "createdCompanyId" in receipt &&
    typeof receipt.createdCompanyId === "string" &&
    receipt.createdCompanyId === companyId;
  const retryBusy = useRef(false);
  const [retryError, setRetryError] = useState<SafeError | null>(null);
  const detail = useCompanyDetail(companyId);

  if (detail.isLoading && !retryError) return <LoadingCompany />;

  if (!detail.data && (detail.isError || (detail.isFetching && retryError))) {
    return (
      <section className="workspace-card feature-card">
        <p className="eyebrow">EMPRESAS</p>
        <h1>
          {createdHere
            ? "La empresa se creó, pero no pudimos consultar su ficha"
            : "No pudimos abrir el detalle"}
        </h1>
        {createdHere && (
          <p>
            La empresa se conserva. No vuelvas a crearla. ID:{" "}
            <strong>{companyId}</strong>. El contacto aún no se ha registrado en
            este paso.
          </p>
        )}
        <p className="form-error" role="alert">
          {detailMessage(detail.error ?? retryError!)}
        </p>
        <div className="button-row">
          <button
            className="primary-action"
            disabled={detail.isFetching}
            onClick={() => {
              if (detail.isFetching || retryBusy.current) return;
              retryBusy.current = true;
              setRetryError(detail.error);
              void detail.refetch().finally(() => {
                retryBusy.current = false;
              });
            }}
          >
            {detail.isFetching
              ? "Reintentando…"
              : createdHere
                ? "Reintentar consulta"
                : "Reintentar"}
          </button>
          <Link className="secondary-action action-link" to="/empresas">
            Volver a empresas
          </Link>
        </div>
      </section>
    );
  }

  const company = detail.data;
  if (!company) return <LoadingCompany />;

  if (guided) {
    return (
      <GuidedCompanyView
        company={company}
        companyId={companyId}
        detailError={detail.isError}
      />
    );
  }
  return (
    <CompanyWorkspace
      key={companyId}
      company={company}
      detailError={detail.isError}
    />
  );
}

function CompanyWorkspace({
  company,
  detailError,
}: {
  company: CompanyDetail;
  detailError: boolean;
}) {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab: TabId = isTab(requested)
    ? requested
    : location.hash === "#contactos"
      ? "contactos"
      : "resumen";
  const overview = useCompaniesOverview();
  const summary = overview.data?.items.find((item) => item.id === company.id);
  const requirements = useCompanyRequirements(company.id);
  const activities = useActivities({ company_id: company.id });

  const allRequirements = requirements.data?.items ?? [];
  const openRequirements = allRequirements.filter((item) =>
    openRequirementStatuses.includes(item.status),
  );
  const allActivities = activities.data?.items ?? [];
  const pending = allActivities
    .filter((item) => item.status === "pending")
    .sort((a, b) => a.due_at.localeCompare(b.due_at));
  const completed = allActivities
    .filter((item) => item.status !== "pending")
    .sort((a, b) => b.due_at.localeCompare(a.due_at));
  const overdue = pending.filter((item) => item.overdue).length;
  const requirementOptions = openRequirements.map(({ id, code, title }) => ({
    id,
    code,
    title,
  }));

  function selectTab(next: TabId) {
    setParams(next === "resumen" ? {} : { tab: next }, { replace: true });
  }

  const loadError =
    (requirements.isError && requirements.error.message) ||
    (activities.isError && activities.error.message);

  return (
    <div className="ws-page">
      <Link className="new-company-back" to="/empresas">
        <span aria-hidden="true">←</span> Volver a Empresas
      </Link>
      <PageHeader
        eyebrow="Empresa"
        title={company.legal_name}
        description={
          <span className="company-meta">
            {company.trade_name && <span>{company.trade_name}</span>}
            <span>RUC: {company.tax_id || "No registrado"}</span>
            {summary && (
              <Pill tone={summary.status === "active" ? "success" : "neutral"}>
                {companyStatusLabels[summary.status]}
              </Pill>
            )}
            {summary &&
              (summary.assigned_advisor_email ? (
                <span className="company-advisor">
                  <Avatar email={summary.assigned_advisor_email} size="sm" />
                  {summary.assigned_advisor_email}
                </span>
              ) : (
                <span>Sin asesor asignado</span>
              ))}
          </span>
        }
      />
      <Tabs
        label="Secciones de la empresa"
        active={tab}
        onChange={selectTab}
        tabs={[
          { id: "resumen", label: "Resumen" },
          {
            id: "requerimientos",
            label: "Requerimientos",
            count: allRequirements.length,
          },
          { id: "actividades", label: "Actividades", count: pending.length },
          {
            id: "contactos",
            label: "Contactos",
            count: company.contacts.length,
          },
        ]}
      />
      {loadError && (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      )}

      {tab === "resumen" && (
        <div role="tabpanel" aria-label="Resumen" className="ws-grid">
          <div className="ws-stats">
            <StatTile
              label="Requerimientos abiertos"
              value={openRequirements.length}
              hint={`${allRequirements.length} en total`}
              tone="info"
            />
            <StatTile
              label="Actividades pendientes"
              value={pending.length}
              tone="warning"
            />
            <StatTile
              label="Vencidas"
              value={overdue}
              tone={overdue > 0 ? "danger" : "neutral"}
            />
            <StatTile
              label="Última actividad"
              value={
                summary?.last_activity_at
                  ? formatDue(summary.last_activity_at)
                  : "Sin registro"
              }
            />
          </div>
          <div className="ws-grid-2">
            <Panel
              title="Próximas actividades"
              actions={
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => selectTab("actividades")}
                >
                  Agendar
                </button>
              }
            >
              <ActivityList
                items={pending.slice(0, 5)}
                showCompany={false}
                empty="No hay actividades pendientes."
              />
            </Panel>
            <Panel title="Requerimientos abiertos">
              <RequirementTable
                items={openRequirements}
                empty="No hay requerimientos abiertos."
              />
            </Panel>
          </div>
        </div>
      )}

      {tab === "requerimientos" && (
        <div role="tabpanel" aria-label="Requerimientos" className="ws-grid">
          <Panel title="Requerimientos de la empresa">
            {requirements.isLoading ? (
              <p role="status">Cargando requerimientos…</p>
            ) : (
              <RequirementTable items={allRequirements} />
            )}
          </Panel>
          <Panel title="Nuevo requerimiento">
            <RequirementCreateForm companyId={company.id} />
          </Panel>
        </div>
      )}

      {tab === "actividades" && (
        <div role="tabpanel" aria-label="Actividades" className="ws-grid">
          <Panel title="Agendar actividad">
            <ActivityForm
              companyId={company.id}
              requirements={requirementOptions}
            />
          </Panel>
          <div className="ws-grid-2">
            <Panel title="Pendientes">
              <ActivityList
                items={pending}
                showCompany={false}
                empty="No hay actividades pendientes."
              />
            </Panel>
            <Panel title="Completadas">
              <ActivityList
                items={completed}
                showCompany={false}
                empty="Todavía no hay actividades completadas."
              />
            </Panel>
          </div>
        </div>
      )}

      {tab === "contactos" && (
        <div role="tabpanel" aria-label="Contactos">
          <CompanyContacts
            companyId={company.id}
            contacts={company.contacts}
            detailError={detailError}
          />
        </div>
      )}
    </div>
  );
}
