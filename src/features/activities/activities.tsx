import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import type { components } from "../../api/schema";
import { call } from "../inventory/labels";
import { EmptyState, Pill } from "../../components/ui";

export type Activity = components["schemas"]["ActivityResponse"];
export type ActivityKind = Activity["kind"];
type ActivityQuery = {
  status?: Activity["status"];
  company_id?: string;
  due_before?: string;
  due_after?: string;
  limit?: number;
};

export const activityKindLabels: Record<ActivityKind, string> = {
  meeting: "Reunión",
  call: "Llamada",
  visit: "Visita",
  task: "Tarea",
  email: "Correo",
};
const kindIcons: Record<ActivityKind, string> = {
  meeting:
    "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 0M23 21v-2a4 4 0 0 0-3-3.9",
  call: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z",
  visit:
    "M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  task: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  email: "M4 4h16v16H4ZM22 6l-10 7L2 6",
};

const dateTime = new Intl.DateTimeFormat("es-PE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
export function formatDue(value: string) {
  return dateTime.format(new Date(value));
}

export function useActivities(query: ActivityQuery, enabled = true) {
  return useQuery({
    queryKey: ["activities", query],
    enabled,
    retry: false,
    queryFn: () =>
      call(() => api.GET("/api/v1/activities", { params: { query } })),
  });
}

function useInvalidateWorkspace() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["activities"] }),
      queryClient.invalidateQueries({ queryKey: ["companies-overview"] }),
      queryClient.invalidateQueries({ queryKey: ["advisor-report"] }),
    ]);
}

export function useUpdateActivity() {
  const invalidate = useInvalidateWorkspace();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: components["schemas"]["ActivityUpdate"];
    }) =>
      call(() =>
        api.PATCH("/api/v1/activities/{activity_id}", {
          params: { path: { activity_id: id } },
          body,
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useCreateActivity() {
  const invalidate = useInvalidateWorkspace();
  return useMutation({
    mutationFn: (body: components["schemas"]["ActivityCreate"]) =>
      call(() => api.POST("/api/v1/activities", { body })),
    onSuccess: invalidate,
  });
}

function KindIcon({ kind }: { kind: ActivityKind }) {
  return (
    <span className={`ws-kind ws-kind-${kind}`} aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={kindIcons[kind]} />
      </svg>
    </span>
  );
}

/** ClickUp-style task rows: checkbox to complete, kind icon, company link, due date and status. */
export function ActivityList({
  items,
  showCompany = true,
  empty = "No hay actividades.",
}: {
  items: Activity[];
  showCompany?: boolean;
  empty?: string;
}) {
  const update = useUpdateActivity();
  if (items.length === 0) return <EmptyState>{empty}</EmptyState>;
  return (
    <>
      {update.isError && (
        <p className="form-error" role="alert">
          {update.error.message}
        </p>
      )}
      <ul className="ws-task-list">
        {items.map((activity) => {
          const done = activity.status === "done";
          return (
            <li
              key={activity.id}
              className={`ws-task${done ? " is-done" : ""}${activity.overdue ? " is-overdue" : ""}`}
            >
              <input
                type="checkbox"
                className="ws-task-check"
                checked={done}
                disabled={update.isPending || activity.status === "cancelled"}
                aria-label={`${done ? "Reabrir" : "Completar"}: ${activity.title}`}
                onChange={() =>
                  update.mutate({
                    id: activity.id,
                    body: { status: done ? "pending" : "done" },
                  })
                }
              />
              <KindIcon kind={activity.kind} />
              <div className="ws-task-body">
                <span className="ws-task-title">{activity.title}</span>
                <span className="ws-task-meta">
                  {activityKindLabels[activity.kind]}
                  {showCompany && (
                    <>
                      {" · "}
                      <Link to={`/empresas/${activity.company_id}`}>
                        {activity.company_name}
                      </Link>
                    </>
                  )}
                  {activity.requirement_code &&
                    ` · ${activity.requirement_code}`}
                </span>
              </div>
              <div className="ws-task-side">
                <time dateTime={activity.due_at}>
                  {formatDue(activity.due_at)}
                </time>
                {activity.overdue ? (
                  <Pill tone="danger">Vencida</Pill>
                ) : done ? (
                  <Pill tone="success">Hecha</Pill>
                ) : activity.status === "cancelled" ? (
                  <Pill>Cancelada</Pill>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

type CompanyOption = { id: string; name: string };
type RequirementOption = { id: string; code: string; title: string };

function localInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Quick-create form. Pass `companyId` to fix the company (company workspace), or `companies` to choose one. */
export function ActivityForm({
  companyId,
  companies = [],
  requirements = [],
  onCreated,
}: {
  companyId?: string;
  companies?: CompanyOption[];
  requirements?: RequirementOption[];
  onCreated?: () => void;
}) {
  const create = useCreateActivity();
  const [defaultDue] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(10, 0, 0, 0);
    return localInputValue(date);
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const due = new Date(String(data.get("due_at")));
    const requirement = String(data.get("requirement_id") ?? "");
    create.mutate(
      {
        company_id: companyId ?? String(data.get("company_id")),
        requirement_id: requirement || null,
        kind: String(data.get("kind")) as ActivityKind,
        title: String(data.get("title")).trim(),
        notes: String(data.get("notes") ?? "").trim() || null,
        due_at: due.toISOString(),
      },
      {
        onSuccess: () => {
          form.reset();
          onCreated?.();
        },
      },
    );
  }
  return (
    <form
      className="ws-activity-form"
      onSubmit={submit}
      aria-label="Nueva actividad"
    >
      {!companyId && (
        <label>
          Empresa
          <select name="company_id" required defaultValue="">
            <option value="" disabled>
              Selecciona una empresa
            </option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Tipo
        <select name="kind" defaultValue="meeting">
          {Object.entries(activityKindLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="ws-span-2">
        Título
        <input
          name="title"
          required
          maxLength={200}
          placeholder="Ej. Reunión de presentación de locales"
        />
      </label>
      <label>
        Fecha y hora
        <input
          name="due_at"
          type="datetime-local"
          required
          defaultValue={defaultDue}
        />
      </label>
      {requirements.length > 0 && (
        <label>
          Requerimiento
          <select name="requirement_id" defaultValue="">
            <option value="">Sin requerimiento</option>
            {requirements.map((requirement) => (
              <option key={requirement.id} value={requirement.id}>
                {requirement.code} · {requirement.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="ws-span-2">
        Notas
        <textarea name="notes" rows={2} maxLength={2000} />
      </label>
      <div className="ws-form-actions ws-span-2">
        <button
          className="primary-action"
          type="submit"
          disabled={create.isPending}
        >
          {create.isPending ? "Guardando…" : "Agendar actividad"}
        </button>
        {create.isError && (
          <p className="form-error" role="alert">
            {create.error.message}
          </p>
        )}
        {create.isSuccess && <p role="status">Actividad agendada.</p>}
      </div>
    </form>
  );
}
