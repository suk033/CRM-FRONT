import { useId, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { components } from "../../api/schema";
import { Avatar, EmptyState, Panel, Pill } from "../../components/ui";
import { ConfirmDialog, useToast } from "../../components/Feedback";
import { Select } from "../../components/Select";
import { call, RequestError } from "../inventory/labels";

type User = components["schemas"]["UserResponse"];
type Role = User["role"];
type PendingChange = {
  user: User;
  body: components["schemas"]["UserUpdate"];
  title: string;
  detail: string;
};

export const usersKey = ["admin-users"];
const roleLabels: Record<Role, string> = {
  admin: "Administrador",
  advisor: "Asesor",
};
const dateFormat = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Backend detail strings translated for the admin. */
const knownErrors: Record<string, string> = {
  "you cannot remove your own admin access":
    "No puedes quitarte tu propio acceso de administrador.",
  "at least one active admin is required":
    "Debe quedar al menos un administrador activo.",
  "email already exists": "Ya existe un usuario con ese correo.",
};

async function request<T>(
  run: () => Promise<{ data?: T; error?: unknown; response: Response }>,
) {
  let result: { data?: T; error?: unknown; response: Response };
  try {
    result = await run();
  } catch {
    throw new RequestError(
      "Hay un problema de conexión con el servidor. Inténtalo de nuevo.",
    );
  }
  if (!result.response.ok || result.data === undefined) {
    const detail =
      typeof result.error === "object" &&
      result.error !== null &&
      "detail" in result.error
        ? (result.error as { detail: unknown }).detail
        : undefined;
    const message =
      typeof detail === "string"
        ? (knownErrors[detail] ?? `Revisa los datos enviados. ${detail}`)
        : "No fue posible completar la solicitud.";
    throw new RequestError(message);
  }
  return result.data;
}

export function useUsers() {
  return useQuery({
    queryKey: usersKey,
    retry: false,
    queryFn: () => call(() => api.GET("/api/v1/users")),
  });
}

/** Admin: create users and activate/deactivate or change their role, with confirmation. */
export function AdminUsers({ currentUserId }: { currentUserId: string }) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const users = useUsers();
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [formKey, setFormKey] = useState(0);
  const roleId = useId();

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: usersKey }),
      queryClient.invalidateQueries({ queryKey: ["advisor-report"] }),
    ]);

  const create = useMutation({
    mutationFn: (body: components["schemas"]["UserCreate"]) =>
      request(() => api.POST("/api/v1/users", { body })),
    onSuccess: (user) => {
      setFormKey((key) => key + 1);
      notify(
        `Usuario ${user.email} creado como ${roleLabels[user.role].toLowerCase()}.`,
      );
      return refresh();
    },
  });

  const update = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: components["schemas"]["UserUpdate"];
    }) =>
      request(() =>
        api.PATCH("/api/v1/users/{user_id}", {
          params: { path: { user_id: id } },
          body,
        }),
      ),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const found: typeof errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      found.email = "Ingresa un correo válido.";
    if (password.length < 12)
      found.password = "La contraseña debe tener al menos 12 caracteres.";
    setErrors(found);
    if (Object.keys(found).length) return;
    create.mutate({ email, password, role: String(data.get("role")) as Role });
  }

  function confirmChange() {
    if (!pending) return;
    const change = pending;
    update.mutate(
      { id: change.user.id, body: change.body },
      {
        onSuccess: (user) => {
          setPending(null);
          notify(`${user.email}: cambio registrado correctamente.`);
          void refresh();
        },
        onError: (error) => {
          setPending(null);
          notify(error.message, "danger");
        },
      },
    );
  }

  return (
    <div className="ws-grid ws-grid-main">
      <Panel title="Usuarios">
        {users.isLoading && <p role="status">Cargando usuarios…</p>}
        {users.isError && (
          <p className="form-error" role="alert">
            {users.error.message}
          </p>
        )}
        {users.data && users.data.items.length === 0 && (
          <EmptyState>No hay usuarios.</EmptyState>
        )}
        {users.data && users.data.items.length > 0 && (
          <div className="ws-table-wrap">
            <table className="ws-table">
              <thead>
                <tr>
                  <th scope="col">Usuario</th>
                  <th scope="col">Rol</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Alta</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.data.items.map((user) => {
                  const self = user.id === currentUserId;
                  const nextRole: Role =
                    user.role === "admin" ? "advisor" : "admin";
                  return (
                    <tr key={user.id}>
                      <td>
                        <span className="profile-user-cell">
                          <Avatar email={user.email} size="sm" />
                          <span>
                            {user.email}
                            {self && (
                              <span className="ws-muted">Tu cuenta</span>
                            )}
                          </span>
                        </span>
                      </td>
                      <td>{roleLabels[user.role]}</td>
                      <td>
                        <Pill tone={user.is_active ? "success" : "neutral"}>
                          {user.is_active ? "Activo" : "Inactivo"}
                        </Pill>
                      </td>
                      <td>{dateFormat.format(new Date(user.created_at))}</td>
                      <td>
                        <span className="profile-actions">
                          <button
                            type="button"
                            className="secondary-action"
                            disabled={self}
                            onClick={() =>
                              setPending({
                                user,
                                body: { is_active: !user.is_active },
                                title: user.is_active
                                  ? "¿Desactivar usuario?"
                                  : "¿Activar usuario?",
                                detail: user.is_active
                                  ? "Perderá el acceso de inmediato. Sus empresas siguen asignadas hasta que las reasignes."
                                  : "Podrá volver a iniciar sesión.",
                              })
                            }
                          >
                            {user.is_active ? "Desactivar" : "Activar"}
                            <span className="ws-visually-hidden">
                              {" "}
                              {user.email}
                            </span>
                          </button>
                          <button
                            type="button"
                            className="secondary-action"
                            disabled={self}
                            onClick={() =>
                              setPending({
                                user,
                                body: { role: nextRole },
                                title: `¿Cambiar rol a ${roleLabels[nextRole].toLowerCase()}?`,
                                detail:
                                  nextRole === "admin"
                                    ? "Tendrá acceso a todas las empresas, usuarios y al modelo."
                                    : "Solo verá las empresas de su cartera.",
                              })
                            }
                          >
                            {nextRole === "admin"
                              ? "Hacer administrador"
                              : "Hacer asesor"}
                            <span className="ws-visually-hidden">
                              {" "}
                              {user.email}
                            </span>
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Nuevo usuario">
        <form
          key={formKey}
          className="ws-activity-form"
          onSubmit={submit}
          aria-label="Nuevo usuario"
          noValidate
        >
          <label className="ws-span-2">
            Correo
            <input
              name="email"
              type="email"
              autoComplete="off"
              aria-invalid={Boolean(errors.email) || undefined}
            />
            {errors.email && (
              <span className="ws-field-error">{errors.email}</span>
            )}
          </label>
          <label className="ws-span-2">
            Contraseña inicial
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password) || undefined}
            />
            {errors.password && (
              <span className="ws-field-error">{errors.password}</span>
            )}
          </label>
          <div className="ws-field ws-span-2">
            <label htmlFor={roleId}>Rol</label>
            <Select
              id={roleId}
              name="role"
              defaultValue="advisor"
              options={[
                { value: "advisor", label: "Asesor" },
                { value: "admin", label: "Administrador" },
              ]}
            />
          </div>
          <div className="ws-form-actions ws-span-2">
            <button
              className="primary-action"
              type="submit"
              disabled={create.isPending}
            >
              {create.isPending ? "Creando…" : "Crear usuario"}
            </button>
            {create.isError && (
              <p className="form-error" role="alert">
                {create.error.message}
              </p>
            )}
          </div>
        </form>
      </Panel>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.title ?? ""}
        description={
          pending && (
            <>
              <strong>{pending.user.email}</strong>
              <br />
              {pending.detail}
            </>
          )
        }
        busy={update.isPending}
        onConfirm={confirmChange}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
