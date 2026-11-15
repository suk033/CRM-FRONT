import { useId, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import type { components } from "../../api/schema";
import { call } from "../inventory/labels";
import { EmptyState, Pill } from "../../components/ui";
import { ConfirmDialog, useToast } from "../../components/Feedback";
import { Select } from "../../components/Select";

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
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
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

/** ClickUp-style task rows: checkbox (with confirmation) to complete, kind icon, company link, due date and status. */
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
  const { notify } = useToast();
  const [pending, setPending] = useState<Activity | null>(null);
  if (items.length === 0) return <EmptyState>{empty}</EmptyState>;
  const reopening = pending?.status === "done";

  function confirm() {
    if (!pending) return;
    const target = pending;
    update.mutate(
      { id: target.id, body: { status: reopening ? "pending" : "done" } },
      {
        onSuccess: () => {
          setPending(null);
          notify(
            reopening
              ? `"${target.title}" volvió a pendientes.`
              : `"${target.title}" se registró como completada.`,
          );
        },
        onError: (error) => {
          setPending(null);
          notify(error.message, "danger");
        },
      },
    );
  }

  return (
    <>
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
                onChange={() => setPending(activity)}
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
      <ConfirmDialog
        open={pending !== null}
        title={
          reopening ? "¿Reabrir la actividad?" : "¿Marcar como completada?"
        }
        description={
          pending && (
            <>
              <strong>{pending.title}</strong> · {pending.company_name}
              <br />
              {reopening
                ? "Volverá a la lista de pendientes."
                : "Se registrará la fecha y hora de cierre."}
            </>
          )
        }
        confirmLabel={reopening ? "Reabrir" : "Sí, completar"}
        busy={update.isPending}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
    </>
  );
}

type CompanyOption = { id: string; name: string };
type RequirementOption = { id: string; code: string; title: string };
type FieldErrors = Partial<Record<"company_id" | "title" | "due_at", string>>;

function localInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const kindOptions = Object.entries(activityKindLabels).map(
  ([value, label]) => ({
    value,
    label,
  }),
);

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
  const { notify } = useToast();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formKey, setFormKey] = useState(0);
  const [defaultDue] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(10, 0, 0, 0);
    return localInputValue(date);
  });
  const ids = {
    company: useId(),
    kind: useId(),
    requirement: useId(),
    errors: useId(),
  };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const company = companyId ?? String(data.get("company_id") ?? "");
    const title = String(data.get("title") ?? "").trim();
    const dueText = String(data.get("due_at") ?? "");
    const due = new Date(dueText);
    const found: FieldErrors = {};
    if (!company) found.company_id = "Selecciona una empresa.";
    if (!title) found.title = "Escribe un título para la actividad.";
    if (!dueText || Number.isNaN(due.getTime()))
      found.due_at = "Indica la fecha y hora.";
    setErrors(found);
    if (Object.keys(found).length) return;
    const requirement = String(data.get("requirement_id") ?? "");
    create.mutate(
      {
        company_id: company,
        requirement_id: requirement || null,
        kind: String(data.get("kind")) as ActivityKind,
        title,
        notes: String(data.get("notes") ?? "").trim() || null,
        due_at: due.toISOString(),
      },
      {
        onSuccess: (activity) => {
          setFormKey((key) => key + 1);
          notify(`Actividad agendada para ${formatDue(activity.due_at)}.`);
          onCreated?.();
        },
      },
    );
  }

  return (
    <form
      key={formKey}
      className="ws-activity-form"
      onSubmit={submit}
      aria-label="Nueva actividad"
      noValidate
    >
      {!companyId && (
        <div className="ws-field">
          <label htmlFor={ids.company}>Empresa</label>
          <Select
            id={ids.company}
            name="company_id"
            placeholder="Selecciona una empresa"
            options={companies.map((company) => ({
              value: company.id,
              label: company.name,
            }))}
            invalid={Boolean(errors.company_id)}
            onChange={() =>
              setErrors((current) => ({ ...current, company_id: undefined }))
            }
          />
          {errors.company_id && (
            <span className="ws-field-error">{errors.company_id}</span>
          )}
        </div>
      )}
      <div className="ws-field">
        <label htmlFor={ids.kind}>Tipo</label>
        <Select
          id={ids.kind}
          name="kind"
          defaultValue="meeting"
          options={kindOptions}
        />
      </div>
      <label className="ws-span-2">
        Título
        <input
          name="title"
          maxLength={200}
          placeholder="Ej. Reunión de presentación de locales"
          aria-invalid={Boolean(errors.title) || undefined}
        />
        {errors.title && <span className="ws-field-error">{errors.title}</span>}
      </label>
      <label>
        Fecha y hora
        <input
          name="due_at"
          type="datetime-local"
          defaultValue={defaultDue}
          aria-invalid={Boolean(errors.due_at) || undefined}
        />
        {errors.due_at && (
          <span className="ws-field-error">{errors.due_at}</span>
        )}
      </label>
      {requirements.length > 0 && (
        <div className="ws-field">
          <label htmlFor={ids.requirement}>Requerimiento</label>
          <Select
            id={ids.requirement}
            name="requirement_id"
            defaultValue=""
            options={[
              { value: "", label: "Sin requerimiento" },
              ...requirements.map((requirement) => ({
                value: requirement.id,
                label: `${requirement.code} · ${requirement.title}`,
              })),
            ]}
          />
        </div>
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
        {Object.keys(errors).length > 0 && (
          <p className="form-error" role="alert" id={ids.errors}>
            Revisa los campos marcados.
          </p>
        )}
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
