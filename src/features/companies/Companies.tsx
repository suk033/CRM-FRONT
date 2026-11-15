import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api, getAccessToken, onAuthCleared } from "../../api/client";
import type { components } from "../../api/schema";
import { CompanyContacts } from "../contacts/CompanyContacts";
import {
  creationMessage,
  networkError,
  requestError,
  type CompanyDetail,
  type SafeError,
} from "./companyApi";

type CompanyCreate = components["schemas"]["CompanyCreate"];
type CompanyResponse = components["schemas"]["CompanyResponse"];

function optionalTrimmed(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

/** Step 1 of the guided company creation; success opens the guided contact step. */
export function CompanyCreateForm({ children }: { children?: ReactNode }) {
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
        navigate(`/empresas/${company.id}?guided=contacto#contactos`, {
          state: { createdCompanyId: company.id },
        });
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
      className="company-form new-company-form"
      onSubmit={submitCompany}
      noValidate
      aria-busy={createCompany.isPending}
    >
      <h2 id="new-company-step-one">1. Empresa</h2>
      {formError && (
        <div ref={errorRef} className="form-error" role="alert" tabIndex={-1}>
          {formError}
        </div>
      )}
      <div className="new-company-fields">
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
              "Identificación fiscal / RUC",
              50,
              undefined,
            ],
          ] as const
        ).map(([name, id, label, maxLength, autoComplete]) => (
          <div key={name} className="new-company-field">
            <label className="form-field" htmlFor={id}>
              {label}
              {name === "legal_name" ? (
                <span aria-hidden="true"> *</span>
              ) : (
                " (opcional)"
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
      <div className="new-company-footer">
        <Link className="secondary-action action-link" to="/empresas">
          Cancelar
        </Link>
        <button
          className="primary-action"
          type="submit"
          disabled={createCompany.isPending}
        >
          {createCompany.isPending
            ? "Guardando…"
            : "Guardar empresa y continuar"}
        </button>
      </div>
    </form>
  );
}

/** Step 2 of the guided creation: the company is confirmed only by its GET detail. */
export function GuidedCompanyView({
  company,
  companyId,
  detailError,
}: {
  company: CompanyDetail;
  companyId: string;
  detailError: boolean;
}) {
  return (
    <div className="new-company-page guided-company-page">
      <header className="new-company-header">
        <Link className="new-company-back" to="/empresas">
          Volver a Empresas
        </Link>
        <p className="eyebrow">EMPRESAS</p>
        <h1>Nueva empresa y contacto</h1>
        <p>
          Empresa confirmada por la consulta. Puedes agregar un contacto o ir a
          la ficha.
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
          La empresa ya está registrada. Salir no la elimina; el contacto puede
          quedar pendiente.
        </p>
        <CompanyContacts
          key={companyId}
          companyId={companyId}
          contacts={company.contacts}
          detailError={detailError}
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
