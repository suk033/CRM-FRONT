import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import type { components } from "../../api/schema";
import {
  call,
  propertyTypeLabels,
  requirementStatusLabels,
  splitList,
  type PropertyType,
} from "../inventory/labels";

type RequirementCreate = components["schemas"]["RequirementCreate"];

function RequirementCreateForm() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const companies = useQuery({
    queryKey: ["companies-options"],
    retry: false,
    queryFn: () =>
      call(() =>
        api.GET("/api/v1/companies", { params: { query: { page_size: 50 } } }),
      ),
  });
  const create = useMutation({
    mutationFn: (body: RequirementCreate) =>
      call(() => api.POST("/api/v1/requirements", { body })),
    onSuccess: (requirement) => {
      void client.invalidateQueries({ queryKey: ["requirements"] });
      navigate(`/requerimientos/${requirement.id}`);
    },
    onError: (error) => setFormError(error.message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (create.isPending) return;
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const body: RequirementCreate = {
      company_id: text("company_id"),
      title: text("title"),
      property_type: text("property_type") as PropertyType,
      city: text("city"),
      districts: splitList(form.get("districts")),
      min_area_m2: Number(text("min_area_m2")),
      max_area_m2: Number(text("max_area_m2")),
      max_monthly_budget: Number(text("max_monthly_budget")),
      required_features: splitList(form.get("required_features")),
    };
    if (!body.company_id || !body.title || !body.city) {
      setFormError("Empresa, título y ciudad son obligatorios.");
      return;
    }
    const numbers = [
      body.min_area_m2,
      body.max_area_m2,
      body.max_monthly_budget,
    ] as number[];
    if (numbers.some((value) => !Number.isFinite(value) || value <= 0)) {
      setFormError(
        "Área mínima, área máxima y presupuesto deben ser positivos.",
      );
      return;
    }
    if (numbers[0] > numbers[1]) {
      setFormError("El área mínima no puede superar el área máxima.");
      return;
    }
    create.mutate(body);
  }

  const field = (id: string, label: string, name: string, type = "text") => (
    <div className="field-group">
      <label className="form-field" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        min={type === "number" ? 0 : undefined}
        disabled={create.isPending}
      />
    </div>
  );

  return (
    <form
      className="filter-form"
      onSubmit={submit}
      noValidate
      aria-busy={create.isPending}
    >
      {formError && (
        <p className="form-error form-span" role="alert">
          {formError}
        </p>
      )}
      <div className="field-group">
        <label className="form-field" htmlFor="requirement-company">
          Empresa
        </label>
        <select
          id="requirement-company"
          name="company_id"
          defaultValue=""
          disabled={create.isPending || companies.isLoading}
        >
          <option value="">
            {companies.isLoading
              ? "Cargando empresas…"
              : "Selecciona una empresa"}
          </option>
          {companies.data?.items.map((company) => (
            <option key={company.id} value={company.id}>
              {company.trade_name || company.legal_name}
            </option>
          ))}
        </select>
      </div>
      {field("requirement-title", "Título", "title")}
      <div className="field-group">
        <label className="form-field" htmlFor="requirement-type">
          Tipo de inmueble
        </label>
        <select
          id="requirement-type"
          name="property_type"
          defaultValue="retail"
          disabled={create.isPending}
        >
          {Object.entries(propertyTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {field("requirement-city", "Ciudad", "city")}
      {field(
        "requirement-districts",
        "Distritos (separados por coma)",
        "districts",
      )}
      {field(
        "requirement-min-area",
        "Área mínima (m²)",
        "min_area_m2",
        "number",
      )}
      {field(
        "requirement-max-area",
        "Área máxima (m²)",
        "max_area_m2",
        "number",
      )}
      {field(
        "requirement-budget",
        "Presupuesto mensual máximo",
        "max_monthly_budget",
        "number",
      )}
      {field(
        "requirement-features",
        "Características requeridas (separadas por coma)",
        "required_features",
      )}
      {companies.isError && (
        <p className="form-error form-span" role="alert">
          {companies.error.message}
        </p>
      )}
      <button
        className="primary-action"
        type="submit"
        disabled={create.isPending}
      >
        {create.isPending ? "Creando…" : "Crear requerimiento"}
      </button>
    </form>
  );
}

export function RequirementsPage() {
  const requirements = useQuery({
    queryKey: ["requirements"],
    retry: false,
    queryFn: () =>
      call(() =>
        api.GET("/api/v1/requirements", {
          params: { query: { page_size: 50 } },
        }),
      ),
  });
  return (
    <div className="module-page">
      <section
        className="workspace-card feature-card module-card"
        aria-labelledby="requirements-title"
      >
        <p className="eyebrow">REQUERIMIENTOS</p>
        <h1 id="requirements-title">Requerimientos</h1>
        <p>
          Lo que cada empresa necesita: tipo de inmueble, zona, área y
          presupuesto. Abre uno para buscar candidatos.
        </p>
        {requirements.isLoading && (
          <p role="status">Cargando requerimientos…</p>
        )}
        {requirements.isError && (
          <p className="form-error" role="alert">
            {requirements.error.message}
          </p>
        )}
        {requirements.data?.items.length === 0 && (
          <p className="empty-state">Todavía no hay requerimientos.</p>
        )}
        {requirements.data && requirements.data.items.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Requerimiento</th>
                  <th scope="col">Ciudad</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {requirements.data.items.map((requirement) => (
                  <tr key={requirement.id}>
                    <td>{requirement.code}</td>
                    <td>
                      <Link to={`/requerimientos/${requirement.id}`}>
                        {requirement.title}
                      </Link>
                      <small>
                        {propertyTypeLabels[requirement.property_type]}
                      </small>
                    </td>
                    <td>{requirement.city}</td>
                    <td>
                      <span className="badge">
                        {requirementStatusLabels[requirement.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section
        className="workspace-card feature-card module-card"
        aria-labelledby="new-requirement-title"
      >
        <h2 id="new-requirement-title">Nuevo requerimiento</h2>
        <RequirementCreateForm />
      </section>
    </div>
  );
}
