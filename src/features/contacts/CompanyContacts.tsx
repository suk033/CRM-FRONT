import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getAccessToken, onAuthCleared } from "../../api/client";
import type { components } from "../../api/schema";

type ContactCreate = components["schemas"]["ContactCreate"];
type Contact = components["schemas"]["ContactResponse"];
const fields = [
  ["first_name", "Nombre", "given-name"],
  ["last_name", "Apellidos", "family-name"],
  ["email", "Correo electrónico", "email"],
  ["phone", "Teléfono", "tel"],
  ["position", "Puesto", "organization-title"],
] as const;

export function CompanyContacts({
  companyId,
  contacts,
  detailError,
}: {
  companyId: string;
  contacts: Contact[];
  detailError: boolean;
}) {
  const client = useQueryClient();
  const sessionToken = useRef(getAccessToken());
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    sessionToken.current = getAccessToken();
    const unsubscribe = onAuthCleared(() => {
      sessionToken.current = null;
    });
    return () => {
      sessionToken.current = null;
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (error || refreshFailed) errorRef.current?.focus();
  }, [error, refreshFailed]);
  useEffect(() => {
    if (window.location.hash === "#contactos")
      document.getElementById("contactos")?.focus();
  }, []);
  const current = () =>
    Boolean(sessionToken.current) && sessionToken.current === getAccessToken();

  async function refresh() {
    if (!current()) return;
    setRefreshing(true);
    try {
      // Mark only this detail stale; never seed contacts from the POST response.
      await client.invalidateQueries({
        queryKey: ["company", companyId],
        exact: true,
        refetchType: "none",
      });
      if (!current()) return;
      await client.refetchQueries(
        { queryKey: ["company", companyId], exact: true, type: "active" },
        { throwOnError: true },
      );
      if (current()) setRefreshFailed(false);
    } catch {
      if (current()) setRefreshFailed(true);
    } finally {
      if (current()) setRefreshing(false);
    }
  }
  const create = useMutation<void, string, ContactCreate>({
    mutationFn: async (body) => {
      let response: Response;
      try {
        ({ response } = await api.POST(
          "/api/v1/companies/{company_id}/contacts",
          { params: { path: { company_id: companyId } }, body },
        ));
      } catch {
        throw "Hay un problema de conexión con el servidor. Inténtalo de nuevo.";
      }
      if (response.status === 422)
        throw "Revisa los datos del contacto antes de continuar.";
      if (response.status === 404)
        throw "No encontramos esa empresa. Revisa el ID antes de continuar.";
      if (!response.ok)
        throw "No fue posible guardar el contacto. Inténtalo de nuevo.";
    },
    onSuccess: async () => {
      if (!current()) return;
      setAccepted(true);
      formRef.current?.reset();
      await refresh();
    },
    onError: (message) => {
      if (current()) setError(message);
    },
    onSettled: () => {
      busy.current = false;
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      busy.current ||
      create.isPending ||
      refreshing ||
      refreshFailed ||
      detailError ||
      !current()
    )
      return;
    setError(null);
    setAccepted(false);
    const data = new FormData(event.currentTarget);
    const text = (key: string) => String(data.get(key) ?? "").trim();
    const body: ContactCreate = {
      first_name: text("first_name"),
      last_name: text("last_name"),
      email: text("email") || null,
      phone: text("phone") || null,
      position: text("position") || null,
    };
    if (!body.first_name) return setError("El nombre es obligatorio.");
    if (!body.last_name) return setError("Los apellidos son obligatorios.");
    if (!body.email && !body.phone)
      return setError("Ingresa un correo electrónico o teléfono como mínimo.");
    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email))
      return setError("Ingresa un correo electrónico válido.");
    busy.current = true;
    create.mutate(body);
  }
  const stale = refreshFailed || detailError;
  return (
    <section
      id="contactos"
      className="workspace-card feature-card"
      aria-labelledby="contacts-title"
      tabIndex={-1}
    >
      <p className="eyebrow">CONTACTOS</p>
      <h2 id="contacts-title">Contactos asociados</h2>
      {accepted && (
        <p className="form-success" role="status">
          Contacto guardado.{" "}
          {refreshing
            ? "Actualizando contactos…"
            : stale
              ? "Pendiente de actualizar el detalle."
              : "Detalle actualizado."}
        </p>
      )}
      {stale && (
        <>
          <div className="form-error" role="alert" tabIndex={-1} ref={errorRef}>
            {accepted
              ? "Contacto guardado, pero no pudimos actualizar los contactos. No vuelvas a enviarlo; reintenta la actualización."
              : "No pudimos actualizar el detalle. Mostramos la última consulta disponible."}
          </div>
          <button
            className="secondary-action"
            disabled={refreshing || create.isPending}
            onClick={() => {
              if (!refreshing && !create.isPending) void refresh();
            }}
          >
            {refreshing ? "Actualizando…" : "Actualizar contactos"}
          </button>
        </>
      )}
      {stale || refreshing ? (
        <p>La lista puede estar desactualizada hasta completar la consulta.</p>
      ) : (
        contacts.length === 0 && (
          <p className="empty-state">
            Todavía no hay contactos para esta empresa.
          </p>
        )
      )}
      <ul className="contact-list">
        {contacts.map((contact) => (
          <li key={contact.id}>
            <strong>
              {contact.first_name} {contact.last_name}
            </strong>
            <span>{contact.position || "Sin puesto registrado"}</span>
            <span>{contact.email || "Sin correo registrado"}</span>
            <span>{contact.phone || "Sin teléfono registrado"}</span>
          </li>
        ))}
      </ul>
      <h3>Agregar contacto</h3>
      <p id="contact-help">
        Nombre y apellidos obligatorios. Registra al menos correo electrónico o
        teléfono. Puesto opcional.
      </p>
      <form
        className="company-form"
        noValidate
        onSubmit={submit}
        ref={formRef}
        aria-describedby="contact-help"
        aria-busy={create.isPending || refreshing}
      >
        {error && (
          <div
            className="form-error"
            role="alert"
            tabIndex={-1}
            ref={errorRef}
            id="contact-error"
          >
            {error}
          </div>
        )}
        {fields.map(([name, label, autoComplete]) => (
          <div className="contact-field" key={name}>
            <label className="form-field" htmlFor={`contact-${name}`}>
              {label}
              {(name === "first_name" || name === "last_name") && " *"}
            </label>
            <input
              id={`contact-${name}`}
              name={name}
              type={
                name === "email" ? "email" : name === "phone" ? "tel" : "text"
              }
              autoComplete={autoComplete}
              required={name === "first_name" || name === "last_name"}
              disabled={create.isPending || refreshing}
              aria-describedby={
                error ? "contact-help contact-error" : "contact-help"
              }
            />
          </div>
        ))}
        <button
          className="primary-action"
          disabled={create.isPending || refreshing || stale}
          type="submit"
        >
          {create.isPending ? "Guardando…" : "Guardar contacto"}
        </button>
      </form>
    </section>
  );
}
