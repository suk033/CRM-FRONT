import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api, getAccessToken, onAuthCleared } from "../../api/client";
import type { components } from "../../api/schema";
import { CompanyContacts } from "../contacts/CompanyContacts";

type CompanyCreate = components["schemas"]["CompanyCreate"];
type CompanyDetail = components["schemas"]["CompanyDetailResponse"];
type CompanyResponse = components["schemas"]["CompanyResponse"];

type SafeError = {
  message: string;
  status?: number;
};

const companyKey = (companyId: string) => ["company", companyId];

function optionalTrimmed(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function creationMessage(error: SafeError) {
  if (error.status === 409) {
    return "La identificación fiscal ya existe. Revisa el dato o consulta la empresa existente.";
  }
  if (error.status === 422) {
    return "Revisa los datos de la empresa antes de continuar.";
  }
  return error.message;
}

function detailMessage(error: SafeError) {
  if (error.status === 404) return "No encontramos esa empresa.";
  return error.message;
}

function requestError(response: Response): SafeError {
  if (response.status === 409) {
    return {
      status: 409,
      message: creationMessage({ status: 409, message: "" }),
    };
  }
  if (response.status === 422) {
    return {
      status: 422,
      message: creationMessage({ status: 422, message: "" }),
    };
  }
  if (response.status === 404) {
    return {
      status: 404,
      message: detailMessage({ status: 404, message: "" }),
    };
  }
  return {
    status: response.status,
    message: "No fue posible completar la solicitud. Inténtalo de nuevo.",
  };
}

function networkError(): SafeError {
  return {
    message: "Hay un problema de conexión con el servidor. Inténtalo de nuevo.",
  };
}

export function CompanyCreateForm({
  guided = false,
  children,
}: {
  guided?: boolean;
  children?: ReactNode;
}) {
  const navigate = useNavigate();
  const sessionToken = useRef(getAccessToken());
  useEffect(() => {
    sessionToken.current = getAccessToken();
    // Invalidate even if a later login receives the same token value.
    const unsubscribe = onAuthCleared(() => {
      sessionToken.current = null;
    });
    return () => {
      sessionToken.current = null;
      unsubscribe();
    };
  }, []);
  const isCurrentSession = () =>
    Boolean(sessionToken.current) && sessionToken.current === getAccessToken();
  const [formError, setFormError] = useState<string | null>(null);
  const submitting = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);

  const createCompany = useMutation<CompanyResponse, SafeError, CompanyCreate>({
    mutationFn: async (body) => {
      try {
        const { data, response } = await api.POST("/api/v1/companies", {
          body,
        });
        if (!response.ok || !data) throw requestError(response);
        return data;
      } catch (error) {
        if (error instanceof Error) throw networkError();
        throw error;
      }
    },
    onSuccess: (company) => {
      if (isCurrentSession()) {
        navigate(
          guided
            ? `/empresas/${company.id}?guided=contacto#contactos`
            : `/empresas/${company.id}`,
          guided ? { state: { createdCompanyId: company.id } } : undefined,
        );
      }
    },
    onError: (error) => {
      if (isCurrentSession()) setFormError(creationMessage(error));
    },
    onSettled: () => {
      submitting.current = false;
    },
  });

  function submitCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || createCompany.isPending || !isCurrentSession())
      return;
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const legalName = String(form.get("legal_name") ?? "").trim();
    if (!legalName) {
      setFormError("La razón social es obligatoria.");
      return;
    }
    const tradeName = optionalTrimmed(form.get("trade_name"));
    const taxId = optionalTrimmed(form.get("tax_id"));
    if (legalName.length > 200) {
      setFormError("La razón social admite hasta 200 caracteres.");
      return;
    }
    if ((tradeName?.length ?? 0) > 200 || (taxId?.length ?? 0) > 50) {
      setFormError(
        "Revisa la longitud del nombre comercial (200) y la identificación fiscal (50).",
      );
      return;
    }
    submitting.current = true;
    createCompany.mutate({
      legal_name: legalName,
      trade_name: tradeName,
      tax_id: taxId,
    });
  }

  return (
    <form
      className={guided ? "company-form new-company-form" : "company-form"}
      onSubmit={submitCompany}
      noValidate
      aria-busy={createCompany.isPending}
    >
      {guided && <h2 id="new-company-step-one">1. Empresa</h2>}
      {formError && (
        <div ref={errorRef} className="form-error" role="alert" tabIndex={-1}>
          {formError}
        </div>
      )}
      <div
        className={guided ? "new-company-fields" : undefined}
        style={guided ? undefined : { display: "contents" }}
      >
        {(
          [
            [
              "legal_name",
              "company-legal-name",
              "Razón social",
              200,
              "organization",
            ],
            [
              "trade_name",
              "company-trade-name",
              "Nombre comercial",
              200,
              "organization-title",
            ],
            [
              "tax_id",
              "company-tax-id",
              guided ? "Identificación fiscal / RUC" : "Identificación fiscal",
              50,
              undefined,
            ],
          ] as const
        ).map(([name, id, label, maxLength, autoComplete]) => (
          <div
            key={name}
            className={guided ? "new-company-field" : undefined}
            style={guided ? undefined : { display: "contents" }}
          >
            <label className="form-field" htmlFor={id}>
              {label}
              {name === "legal_name" ? (
                <span aria-hidden="true"> *</span>
              ) : guided ? (
                " (opcional)"
              ) : (
                ""
              )}
            </label>
            <input
              id={id}
              name={name}
              autoComplete={autoComplete}
              maxLength={maxLength}
              required={name === "legal_name"}
              disabled={createCompany.isPending}
            />
          </div>
        ))}
      </div>
      {children}
      <div
        className={guided ? "new-company-footer" : undefined}
        style={guided ? undefined : { display: "contents" }}
      >
        {guided && (
          <Link className="secondary-action action-link" to="/empresas">
            Cancelar
          </Link>
        )}
        <button
          className="primary-action"
          type="submit"
          disabled={createCompany.isPending}
        >
          {createCompany.isPending
            ? guided
              ? "Guardando…"
              : "Creando…"
            : guided
              ? "Guardar empresa y continuar"
              : "Crear empresa"}
        </button>
      </div>
    </form>
  );
}

export function CompaniesHome() {
  const navigate = useNavigate();
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupId, setLookupId] = useState("");
  function submitLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLookupError(null);
    const companyId = lookupId.trim();
    if (!companyId) {
      setLookupError("Ingresa un ID de empresa para abrir el detalle.");
      return;
    }
    navigate(`/empresas/${encodeURIComponent(companyId)}`);
  }

  return (
    <div className="companies-page">
      <section
        className="workspace-card feature-card"
        aria-labelledby="companies-title"
      >
        <p className="eyebrow">EMPRESAS</p>
        <h1 id="companies-title">Crear empresa</h1>
        <p>
          Registra una empresa real del backend. Aún no existe listado, por eso
          también puedes abrir un detalle con su ID.
        </p>
        <CompanyCreateForm />
      </section>

      <section
        className="workspace-card feature-card"
        aria-labelledby="lookup-title"
      >
        <p className="eyebrow">SIN LISTADO AÚN</p>
        <h2 id="lookup-title">Abrir detalle por ID</h2>
        <p>
          Usa el ID de una empresa creada para volver a su ficha después de
          iniciar sesión.
        </p>
        <form className="lookup-form" onSubmit={submitLookup} noValidate>
          {lookupError && (
            <p className="form-error" role="alert">
              {lookupError}
            </p>
          )}
          <label className="form-field" htmlFor="company-id-lookup">
            ID de empresa
          </label>
          <input
            id="company-id-lookup"
            value={lookupId}
            onChange={(event) => setLookupId(event.currentTarget.value)}
            placeholder="UUID de empresa"
          />
          <button className="secondary-action" type="submit">
            Ver detalle
          </button>
        </form>
      </section>
    </div>
  );
}

export function CompanyDetailPage() {
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
  const detail = useQuery<CompanyDetail, SafeError>({
    queryKey: companyKey(companyId),
    enabled: Boolean(companyId),
    retry: false,
    queryFn: async () => {
      try {
        const { data, response } = await api.GET(
          "/api/v1/companies/{company_id}",
          {
            params: { path: { company_id: companyId } },
          },
        );
        if (!response.ok || !data) throw requestError(response);
        return data;
      } catch (error) {
        if (error instanceof Error) throw networkError();
        throw error;
      }
    },
  });

  if (detail.isLoading && !retryError) {
    return (
      <section className="workspace-card feature-card" aria-busy="true">
        <p className="eyebrow">EMPRESAS</p>
        <h1>Cargando empresa…</h1>
      </section>
    );
  }

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
  if (!company) {
    return (
      <section className="workspace-card feature-card" aria-busy="true">
        <p className="eyebrow">EMPRESAS</p>
        <h1>Cargando empresa…</h1>
      </section>
    );
  }

  if (guided) {
    return (
      <div className="new-company-page guided-company-page">
        <header className="new-company-header">
          <Link className="new-company-back" to="/empresas">
            Volver a Empresas
          </Link>
          <p className="eyebrow">EMPRESAS</p>
          <h1>Nueva empresa y contacto</h1>
          <p>
            Empresa confirmada por la consulta. Puedes agregar un contacto o ir
            a la ficha.
          </p>
          <ol className="new-company-steps" aria-label="Pasos del registro">
            <li>
              <span aria-hidden="true">1</span> Empresa confirmada
            </li>
            <li aria-current="step">
              <span aria-hidden="true">2</span> Contacto
            </li>
          </ol>
        </header>
        <section
          className="workspace-card feature-card"
          aria-labelledby="guided-company-title"
        >
          <h2 id="guided-company-title">1. Empresa confirmada</h2>
          <dl className="detail-list">
            {[
              ["Razón social", company.legal_name],
              ["Nombre comercial", company.trade_name],
              ["Identificación fiscal / RUC", company.tax_id],
              ["ID", company.id],
              [
                "Alta",
                company.created_at
                  ? new Date(company.created_at).toLocaleString("es-MX")
                  : null,
              ],
            ].map(([label, value]) =>
              value ? (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ) : null,
            )}
          </dl>
        </section>
        <div className="guided-company-contact">
          <h2>2. Contacto</h2>
          <p>
            La empresa ya está registrada. Salir no la elimina; el contacto
            puede quedar pendiente.
          </p>
          <CompanyContacts
            key={companyId}
            companyId={companyId}
            contacts={company.contacts}
            detailError={detail.isError}
          />
        </div>
        <footer className="new-company-footer">
          <Link
            className="secondary-action action-link"
            to={`/empresas/${companyId}`}
          >
            Ir a la ficha
          </Link>
          <Link className="secondary-action action-link" to="/empresas">
            Volver a Empresas
          </Link>
        </footer>
      </div>
    );
  }

  return (
    <div className="companies-page">
      <section
        className="workspace-card feature-card"
        aria-labelledby="company-title"
      >
        <p className="eyebrow">DETALLE DE EMPRESA</p>
        <h1 id="company-title">{company.legal_name}</h1>
        <dl className="detail-list">
          <div>
            <dt>ID</dt>
            <dd>{company.id}</dd>
          </div>
          <div>
            <dt>Nombre comercial</dt>
            <dd>{company.trade_name || "No registrado"}</dd>
          </div>
          <div>
            <dt>Identificación fiscal</dt>
            <dd>{company.tax_id || "No registrada"}</dd>
          </div>
          <div>
            <dt>Alta</dt>
            <dd>{new Date(company.created_at).toLocaleString("es-MX")}</dd>
          </div>
        </dl>
      </section>

      <CompanyContacts
        key={companyId}
        companyId={companyId}
        contacts={company.contacts}
        detailError={detail.isError}
      />
    </div>
  );
}
