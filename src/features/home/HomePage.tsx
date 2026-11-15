import { Link } from "react-router-dom";
import {
  ActivityForm,
  ActivityList,
  formatDue,
  useActivities,
} from "../activities/activities";
import {
  EmptyState,
  PageHeader,
  Panel,
  Pill,
  StatTile,
} from "../../components/ui";
import {
  companyName,
  groupPending,
  recentlyCompleted,
  roleLabel,
  useCompaniesOverview,
  type CompanyOverview,
  type CurrentUser,
} from "./workspaceData";
import "./home.css";
import { Agenda } from "./Agenda";
import { TeamPerformance } from "./TeamPerformance";

function needsAttention(company: CompanyOverview) {
  return (
    company.overdue_activities > 0 ||
    (company.status === "active" && company.next_activity_at === null)
  );
}

export function HomePage({ user }: { user?: CurrentUser }) {
  const pending = useActivities({ status: "pending", limit: 500 });
  const done = useActivities({ status: "done", limit: 100 });
  const overview = useCompaniesOverview();
  const isAdmin = user?.role === "admin";

  const groups = groupPending(pending.data?.items ?? []);
  const companies = overview.data?.items ?? [];
  const openRequirements = companies.reduce(
    (sum, company) => sum + company.open_requirements,
    0,
  );
  const attention = companies
    .filter(needsAttention)
    .sort((a, b) => b.overdue_activities - a.overdue_activities)
    .slice(0, 6);
  const count = (value: number, ready: boolean) => (ready ? value : "…");

  return (
    <div className="ws-page">
      <PageHeader
        eyebrow="Inicio"
        title={user ? `Hola, ${user.email.split("@")[0]}` : "Inicio"}
        description={
          user ? (
            <>
              {roleLabel(user.role)} ·{" "}
              {isAdmin
                ? "así va SuPra y el trabajo de tus colaboradores."
                : "estos son tus pendientes con tus empresas."}
            </>
          ) : (
            <span role="status">Cargando tu sesión…</span>
          )
        }
        actions={
          isAdmin && (
            <Link className="secondary-action" to="/perfil?seccion=rendimiento">
              Ver rendimiento del equipo
            </Link>
          )
        }
      />

      {isAdmin ? (
        <TeamPerformance />
      ) : (
        <div className="ws-stats" aria-label="Indicadores">
          <StatTile
            label="Vencidas"
            tone="danger"
            value={count(groups.overdue.length, pending.isSuccess)}
          />
          <StatTile
            label="Para hoy"
            tone="warning"
            value={count(groups.today.length, pending.isSuccess)}
          />
          <StatTile
            label="Próximos 7 días"
            tone="info"
            value={count(groups.nextSevenDays, pending.isSuccess)}
          />
          <StatTile
            label="Empresas activas"
            tone="success"
            value={count(overview.data?.active ?? 0, overview.isSuccess)}
          />
          <StatTile
            label="Requerimientos abiertos"
            value={count(openRequirements, overview.isSuccess)}
          />
        </div>
      )}

      <Agenda
        title={isAdmin ? "Agenda del equipo" : "Mi agenda de la semana"}
        showOwner={isAdmin}
      />

      <div className="ws-grid ws-grid-main">
        <Panel title={isAdmin ? "Pendientes del equipo" : "Mis pendientes"}>
          {pending.isLoading && <p role="status">Cargando actividades…</p>}
          {pending.isError && (
            <p className="form-error" role="alert">
              {pending.error.message}
            </p>
          )}
          {pending.isSuccess && (
            <div className="home-groups">
              <section aria-labelledby="group-overdue">
                <h3 id="group-overdue" className="home-group-title">
                  Vencidas <Pill tone="danger">{groups.overdue.length}</Pill>
                </h3>
                <ActivityList
                  items={groups.overdue}
                  empty="Nada vencido. ¡Buen trabajo!"
                />
              </section>
              <section aria-labelledby="group-today">
                <h3 id="group-today" className="home-group-title">
                  Hoy <Pill tone="warning">{groups.today.length}</Pill>
                </h3>
                <ActivityList
                  items={groups.today}
                  empty="No tienes actividades para hoy."
                />
              </section>
              <section aria-labelledby="group-upcoming">
                <h3 id="group-upcoming" className="home-group-title">
                  Próximas <Pill tone="info">{groups.upcoming.length}</Pill>
                </h3>
                <ActivityList
                  items={groups.upcoming}
                  empty="No hay actividades próximas agendadas."
                />
              </section>
            </div>
          )}
        </Panel>

        <div className="ws-grid home-side">
          <Panel title="Nueva actividad">
            {overview.isError ? (
              <p className="form-error" role="alert">
                {overview.error.message}
              </p>
            ) : (
              <ActivityForm
                companies={companies.map((company) => ({
                  id: company.id,
                  name: companyName(company),
                }))}
              />
            )}
          </Panel>

          <Panel title="Empresas que requieren atención">
            {overview.isLoading && <p role="status">Cargando empresas…</p>}
            {overview.isSuccess &&
              (attention.length === 0 ? (
                <EmptyState>Todas tus empresas tienen seguimiento.</EmptyState>
              ) : (
                <ul className="home-attention">
                  {attention.map((company) => (
                    <li key={company.id}>
                      <Link to={`/empresas/${company.id}`}>
                        {companyName(company)}
                      </Link>
                      <span className="ws-muted">
                        {company.overdue_activities > 0
                          ? `${company.overdue_activities} vencida${company.overdue_activities === 1 ? "" : "s"}`
                          : "Sin próxima actividad"}
                      </span>
                    </li>
                  ))}
                </ul>
              ))}
          </Panel>

          <Panel title="Completadas recientemente">
            {done.isLoading && <p role="status">Cargando completadas…</p>}
            {done.isError && (
              <p className="form-error" role="alert">
                {done.error.message}
              </p>
            )}
            {done.isSuccess &&
              (recentlyCompleted(done.data.items).length === 0 ? (
                <EmptyState>Aún no hay actividades completadas.</EmptyState>
              ) : (
                <ul className="home-attention" aria-label="Completadas">
                  {recentlyCompleted(done.data.items).map((activity) => (
                    <li key={activity.id}>
                      <span>{activity.title}</span>
                      <span className="ws-muted">
                        {activity.company_name} ·{" "}
                        {formatDue(activity.completed_at ?? activity.due_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              ))}
          </Panel>
        </div>
      </div>
    </div>
  );
}
