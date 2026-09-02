import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { api } from "../../api/client";

const companiesKey = ["companies"];
const optional = (value: string) => value.trim() || undefined;

function ErrorMessage({ status }: { status?: number }) {
  const message =
    status === 409
      ? "El identificador fiscal ya pertenece a otra empresa."
      : status === 422
        ? "Revisá los datos obligatorios e intentá nuevamente."
        : "No fue posible completar la operación. Intentá nuevamente.";
  return (
    <p className="form-error" role="alert">
      {message}
    </p>
  );
}

export function CompaniesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const page = Number(searchParams.get("page") ?? "1");
  const companies = useQuery({
    queryKey: [...companiesKey, query, page],
    queryFn: async () => {
      const { data, response } = await api.GET("/api/v1/companies", {
        params: { query: { q: optional(query), page, page_size: 12 } },
      });
      if (!response.ok || !data) throw new Error("companies unavailable");
      return data;
    },
  });

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value =
      new FormData(event.currentTarget).get("q")?.toString().trim() ?? "";
    setSearchParams(value ? { q: value } : {});
  };

  return (
    <main className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">CRM</p>
          <h1>Empresas</h1>
        </div>
        <Link className="button" to="/empresas/nueva">
          Nueva empresa
        </Link>
      </div>
      <form className="search-form" onSubmit={submitSearch} role="search">
        <label>
          Buscar empresa
          <input
            defaultValue={query}
            name="q"
            placeholder="Nombre legal o comercial"
          />
        </label>
        <button type="submit">Buscar</button>
      </form>
      {companies.isPending && <p>Cargando empresas…</p>}
      {companies.isError && <ErrorMessage />}
      {companies.data && (
        <>
          <p className="result-count">
            {companies.data.total} empresas encontradas
          </p>
          <ul className="company-list">
            {companies.data.items.map((company) => (
              <li key={company.id}>
                <Link to={`/empresas/${company.id}`}>
                  <strong>{company.legal_name}</strong>
                  <span>
                    {company.trade_name ??
                      company.tax_id ??
                      "Sin datos adicionales"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {companies.data.items.length === 0 && (
            <p>No hay empresas para mostrar.</p>
          )}
          <div className="pagination" aria-label="Paginación">
            <button
              disabled={page <= 1}
              onClick={() =>
                setSearchParams(
                  query
                    ? { q: query, page: String(page - 1) }
                    : { page: String(page - 1) },
                )
              }
            >
              Anterior
            </button>
            <span>Página {companies.data.page}</span>
            <button
              disabled={page * companies.data.page_size >= companies.data.total}
              onClick={() =>
                setSearchParams(
                  query
                    ? { q: query, page: String(page + 1) }
                    : { page: String(page + 1) },
                )
              }
            >
              Siguiente
            </button>
          </div>
        </>
      )}
    </main>
  );
}

export function CompanyCreatePage() {
  const navigate = useNavigate();
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [taxId, setTaxId] = useState("");
  const create = useMutation({
    mutationFn: async () => {
      const { data, response } = await api.POST("/api/v1/companies", {
        body: {
          legal_name: legalName,
          trade_name: optional(tradeName),
          tax_id: optional(taxId),
        },
      });
      if (!response.ok || !data) throw new Error(String(response.status));
      return data;
    },
    onSuccess: (company) => navigate(`/empresas/${company.id}`),
  });
  const status = Number(create.error?.message);

  return (
    <main className="workspace-page form-page">
      <Link className="back-link" to="/empresas">
        Volver a empresas
      </Link>
      <p className="eyebrow">NUEVO REGISTRO</p>
      <h1>Nueva empresa</h1>
      <form
        className="record-form"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <label>
          Nombre legal
          <input
            value={legalName}
            onChange={(event) => setLegalName(event.target.value)}
            required
            maxLength={200}
          />
        </label>
        <label>
          Nombre comercial
          <input
            value={tradeName}
            onChange={(event) => setTradeName(event.target.value)}
            maxLength={200}
          />
        </label>
        <label>
          Identificador fiscal
          <input
            value={taxId}
            onChange={(event) => setTaxId(event.target.value)}
            maxLength={50}
          />
        </label>
        {create.isError && <ErrorMessage status={status} />}
        <button type="submit" disabled={create.isPending}>
          {create.isPending ? "Guardando…" : "Crear empresa"}
        </button>
      </form>
    </main>
  );
}

export function CompanyDetailPage() {
  const { companyId } = useParams();
  const client = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState("");
  const company = useQuery({
    queryKey: [...companiesKey, companyId],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, response } = await api.GET(
        "/api/v1/companies/{company_id}",
        { params: { path: { company_id: companyId! } } },
      );
      if (!response.ok || !data) throw new Error(String(response.status));
      return data;
    },
  });
  const createContact = useMutation({
    mutationFn: async () => {
      const { data, response } = await api.POST(
        "/api/v1/companies/{company_id}/contacts",
        {
          params: { path: { company_id: companyId! } },
          body: {
            first_name: firstName,
            last_name: lastName,
            email: optional(email),
            phone: optional(phone),
            position: optional(position),
          },
        },
      );
      if (!response.ok || !data) throw new Error(String(response.status));
      return data;
    },
    onSuccess: () => {
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setPosition("");
      client.invalidateQueries({ queryKey: [...companiesKey, companyId] });
    },
  });

  if (company.isPending)
    return <main className="workspace-page">Cargando empresa…</main>;
  if (company.isError || !company.data)
    return (
      <main className="workspace-page">
        <ErrorMessage status={Number(company.error?.message)} />
      </main>
    );
  return (
    <main className="workspace-page">
      <Link className="back-link" to="/empresas">
        Volver a empresas
      </Link>
      <div className="company-summary">
        <p className="eyebrow">EMPRESA</p>
        <h1>{company.data.legal_name}</h1>
        <p>
          {company.data.trade_name ?? "Sin nombre comercial"} ·{" "}
          {company.data.tax_id ?? "Sin identificador fiscal"}
        </p>
      </div>
      <section className="contacts-section" aria-labelledby="contacts-title">
        <div className="section-heading">
          <h2 id="contacts-title">Contactos</h2>
          <span>{company.data.contacts.length}</span>
        </div>
        <ul className="contact-list">
          {company.data.contacts.map((contact) => (
            <li key={contact.id}>
              <strong>
                {contact.first_name} {contact.last_name}
              </strong>
              <span>{contact.position ?? "Sin cargo"}</span>
              <small>{contact.email ?? contact.phone}</small>
            </li>
          ))}
        </ul>
        {company.data.contacts.length === 0 && (
          <p>Esta empresa aún no tiene contactos.</p>
        )}
        <form
          className="record-form contact-form"
          onSubmit={(event) => {
            event.preventDefault();
            createContact.mutate();
          }}
        >
          <h2>Agregar contacto</h2>
          <div className="form-grid">
            <label>
              Nombre
              <input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
                maxLength={100}
              />
            </label>
            <label>
              Apellido
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
                maxLength={100}
              />
            </label>
            <label>
              Correo electrónico
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={320}
              />
            </label>
            <label>
              Teléfono
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                maxLength={100}
              />
            </label>
            <label>
              Cargo
              <input
                value={position}
                onChange={(event) => setPosition(event.target.value)}
                maxLength={200}
              />
            </label>
          </div>
          <p className="field-hint">
            Ingresá al menos un correo electrónico o teléfono.
          </p>
          {createContact.isError && (
            <ErrorMessage status={Number(createContact.error?.message)} />
          )}
          <button type="submit" disabled={createContact.isPending}>
            {createContact.isPending ? "Guardando…" : "Agregar contacto"}
          </button>
        </form>
      </section>
    </main>
  );
}
