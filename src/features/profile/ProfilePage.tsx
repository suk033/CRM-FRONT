import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ActivityList,
  formatDue,
  useActivities,
  type Activity,
} from "../activities/activities";
import {
  Avatar,
  EmptyState,
  PageHeader,
  Panel,
  Pill,
  StatTile,
  Tabs,
} from "../../components/ui";
import { formatPercent } from "../inventory/labels";
import { LearningPanel } from "../learning/LearningPanel";
import {
  completedWithin,
  roleLabel,
  useAdvisorReport,
  useCompaniesOverview,
  type CurrentUser,
} from "../home/workspaceData";
import "./profile.css";
import { Select } from "../../components/Select";

type Section = "resumen" | "rendimiento" | "equipo" | "modelo";

const memberSince = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function ProfilePage({ user }: { user?: CurrentUser }) {
  const [params, setParams] = useSearchParams();
  if (!user) {
    return (
      <div className="ws-page">
        <PageHeader title="Perfil" />
        <p role="status">Cargando tu perfil…</p>
      </div>
    );
  }
  const isAdmin = user.role === "admin";
  const tabs: { id: Section; label: string }[] = isAdmin
    ? [
        { id: "rendimiento", label: "Rendimiento de asesores" },
        { id: "equipo", label: "Actividades del equipo" },
        { id: "modelo", label: "Modelo ML" },
      ]
    : [{ id: "resumen", label: "Mi resumen" }];
  const requested = params.get("seccion");
  const active = tabs.find((tab) => tab.id === requested)?.id ?? tabs[0].id;
  const select = (id: Section) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("seccion", id);
        return next;
      },
      { replace: true },
    );

  return (
    <div className="ws-page">
      <PageHeader
        eyebrow="Perfil"
        title="Perfil"
        description={
          isAdmin
            ? "Tu cuenta, el rendimiento del equipo y el modelo de recomendación."
            : "Tu cuenta y tu avance con tus empresas."
        }
      />
      <Panel title="Tu cuenta">
        <div className="profile-card">
          <Avatar email={user.email} size="lg" />
          <dl className="profile-facts">
            <div>
              <dt>Correo</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Rol</dt>
              <dd>{roleLabel(user.role)}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>
                <Pill tone={user.is_active ? "success" : "danger"}>
                  {user.is_active ? "Activo" : "Inactivo"}
                </Pill>
              </dd>
            </div>
            <div>
              <dt>Miembro desde</dt>
              <dd>{memberSince.format(new Date(user.created_at))}</dd>
            </div>
          </dl>
        </div>
      </Panel>

      {tabs.length > 1 && (
        <Tabs
          label="Secciones del perfil"
          tabs={tabs}
          active={active}
          onChange={select}
        />
      )}
      <div
        role={tabs.length > 1 ? "tabpanel" : undefined}
        aria-label={tabs.find((t) => t.id === active)?.label}
      >
        {active === "resumen" && <MySummary />}
        {active === "rendimiento" && <AdvisorPerformance />}
        {active === "equipo" && <TeamActivities />}
        {active === "modelo" && <LearningPanel user={user} />}
      </div>
    </div>
  );
}

function MySummary() {
  const overview = useCompaniesOverview();
  const pending = useActivities({ status: "pending", limit: 500 });
  const done = useActivities({ status: "done", limit: 500 });
  const companies = overview.data?.items ?? [];
  const pendingItems = pending.data?.items ?? [];
  const error = overview.error ?? pending.error ?? done.error;
  const value = (n: number, ready: boolean) => (ready ? n : "…");
  return (
    <div className="ws-grid">
      {error && (
        <p className="form-error" role="alert">
          {error.message}
        </p>
      )}
      <div className="ws-stats" aria-label="Indicadores personales">
        <StatTile
          label="Empresas"
          value={value(overview.data?.total ?? 0, overview.isSuccess)}
        />
        <StatTile
          label="Requerimientos abiertos"
          tone="info"
          value={value(
            companies.reduce((sum, c) => sum + c.open_requirements, 0),
            overview.isSuccess,
          )}
        />
        <StatTile
          label="Pendientes"
          tone="warning"
          value={value(pendingItems.length, pending.isSuccess)}
        />
        <StatTile
          label="Vencidas"
          tone="danger"
          value={value(
            pendingItems.filter((a) => a.overdue).length,
            pending.isSuccess,
          )}
        />
        <StatTile
          label="Completadas (30 días)"
          tone="success"
          value={value(
            completedWithin(done.data?.items ?? [], 30),
            done.isSuccess,
          )}
        />
      </div>
    </div>
  );
}

function Bar({ ratio, label }: { ratio: number; label: string }) {
  const clamped = Math.min(Math.max(ratio, 0), 1);
  const percent = Math.round(clamped * 100);
  return (
    <span className="profile-bar">
      <span
        className="ws-score-bar"
        role="img"
        aria-label={`${label}: ${percent} %`}
      >
        <span style={{ width: `${percent}%` }} />
      </span>
      <span>{formatPercent(clamped, 0)}</span>
    </span>
  );
}

function AdvisorPerformance() {
  const report = useAdvisorReport();
  if (report.isLoading) return <p role="status">Cargando rendimiento…</p>;
  if (report.isError)
    return (
      <p className="form-error" role="alert">
        {report.error.message}
      </p>
    );
  const data = report.data;
  if (!data) return null;
  return (
    <Panel title="Rendimiento de asesores">
      {data.advisors.length === 0 ? (
        <EmptyState>No hay asesores registrados.</EmptyState>
      ) : (
        <div className="ws-table-wrap">
          <table className="ws-table">
            <caption className="ws-muted">
              Actividades completadas en los últimos {data.window_days} días.
            </caption>
            <thead>
              <tr>
                <th scope="col">Asesor</th>
                <th scope="col">Empresas</th>
                <th scope="col">Req. abiertos</th>
                <th scope="col">Pendientes</th>
                <th scope="col">Vencidas</th>
                <th scope="col">Completadas</th>
                <th scope="col">Cumplimiento</th>
                <th scope="col">Aceptación</th>
                <th scope="col">Última actividad</th>
              </tr>
            </thead>
            <tbody>
              {data.advisors.map((advisor) => {
                const workload =
                  advisor.activities_done_30d + advisor.activities_pending;
                return (
                  <tr
                    key={advisor.user_id}
                    className={
                      advisor.activities_overdue > 0 ? "is-overdue" : undefined
                    }
                  >
                    <th scope="row">
                      <span className="profile-advisor">
                        <Avatar email={advisor.email} size="sm" />
                        {advisor.email}
                        {!advisor.is_active && <Pill>Inactivo</Pill>}
                      </span>
                    </th>
                    <td>{advisor.companies}</td>
                    <td>{advisor.open_requirements}</td>
                    <td>{advisor.activities_pending}</td>
                    <td>
                      {advisor.activities_overdue > 0 ? (
                        <Pill tone="danger">{advisor.activities_overdue}</Pill>
                      ) : (
                        0
                      )}
                    </td>
                    <td>{advisor.activities_done_30d}</td>
                    <td>
                      {workload === 0 ? (
                        "—"
                      ) : (
                        <Bar
                          label="Cumplimiento"
                          ratio={advisor.activities_done_30d / workload}
                        />
                      )}
                    </td>
                    <td>
                      {advisor.acceptance_rate === null ? (
                        "—"
                      ) : (
                        <span
                          title={`${advisor.decisions_accepted} aceptadas · ${advisor.decisions_rejected} rechazadas`}
                        >
                          <Bar
                            label="Aceptación"
                            ratio={advisor.acceptance_rate}
                          />
                        </span>
                      )}
                    </td>
                    <td>
                      {advisor.last_activity_at
                        ? formatDue(advisor.last_activity_at)
                        : "Sin actividad"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="ws-muted">
        Cumplimiento = completadas / (completadas + pendientes). Aceptación =
        candidatos aceptados / (aceptados + rechazados).
      </p>
    </Panel>
  );
}

type StatusFilter = Activity["status"] | "all";
const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "pending", label: "Pendientes" },
  { value: "done", label: "Completadas" },
  { value: "cancelled", label: "Canceladas" },
  { value: "all", label: "Todas" },
];

function TeamActivities() {
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [owner, setOwner] = useState("");
  const activities = useActivities(
    status === "all" ? { limit: 500 } : { status, limit: 500 },
  );
  const items = activities.data?.items ?? [];
  const owners = [...new Set(items.map((a) => a.owner_email))].sort();
  const visible = items
    .filter((a) => !owner || a.owner_email === owner)
    .sort((a, b) => a.due_at.localeCompare(b.due_at));
  const byOwner = new Map<string, Activity[]>();
  for (const activity of visible) {
    byOwner.set(activity.owner_email, [
      ...(byOwner.get(activity.owner_email) ?? []),
      activity,
    ]);
  }
  return (
    <Panel title="Actividades del equipo">
      <div className="profile-filters">
        <label>
          Estado
          <Select
            value={status}
            onChange={(value) => setStatus(value as StatusFilter)}
            options={statusOptions}
          />
        </label>
        <label>
          Asesor
          <Select
            value={owner}
            onChange={setOwner}
            options={[
              { value: "", label: "Todos los asesores" },
              ...(owner && !owners.includes(owner)
                ? [owner, ...owners]
                : owners
              ).map((email) => ({ value: email, label: email })),
            ]}
          />
        </label>
      </div>
      {activities.isLoading && <p role="status">Cargando actividades…</p>}
      {activities.isError && (
        <p className="form-error" role="alert">
          {activities.error.message}
        </p>
      )}
      {activities.isSuccess &&
        (visible.length === 0 ? (
          <EmptyState>No hay actividades con estos filtros.</EmptyState>
        ) : (
          [...byOwner.entries()].map(([email, group]) => (
            <section key={email} aria-label={`Actividades de ${email}`}>
              <h3 className="profile-owner">
                <Avatar email={email} size="sm" />
                {email} <Pill>{group.length}</Pill>
              </h3>
              <ActivityList items={group} />
            </section>
          ))
        ))}
    </Panel>
  );
}
