import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import type { components } from "../../api/schema";
import { EmptyState, Pill, type Tone } from "../../components/ui";
import {
  call,
  formatArea,
  formatMoney,
  propertyTypeLabels,
  requirementStatusLabels,
  splitList,
  type PropertyType,
  type RequirementStatus,
} from "../inventory/labels";

type RequirementCreate = components["schemas"]["RequirementCreate"];
export type Requirement = components["schemas"]["RequirementResponse"];

export const openRequirementStatuses: RequirementStatus[] = [
  "open",
  "searching",
  "proposal",
];

export const requirementStatusTones: Record<RequirementStatus, Tone> = {
  open: "info",
  searching: "warning",
  proposal: "info",
  won: "success",
  lost: "neutral",
};

export function useCompanyRequirements(companyId: string) {
  return useQuery({
    queryKey: ["requirements", { company_id: companyId }],
    enabled: Boolean(companyId),
    retry: false,
    queryFn: () =>
      call(() =>
        api.GET("/api/v1/requirements", {
          params: { query: { company_id: companyId, page_size: 100 } },
        }),
      ),
  });
}

/** Compact requirement table; every row opens the requirement workspace. */
export function RequirementTable({
  items,
  empty = "Esta empresa todavía no tiene requerimientos.",
}: {
  items: Requirement[];
  empty?: string;
}) {
  if (items.length === 0) return <EmptyState>{empty}</EmptyState>;
  return (
    <div className="ws-table-wrap">
      <table className="ws-table">
        <thead>
          <tr>
            <th scope="col">Requerimiento</th>
            <th scope="col">Ubicación</th>
            <th scope="col">Área</th>
            <th scope="col">Presupuesto</th>
            <th scope="col">Estado</th>
          </tr>
        </thead>
        <tbody>
          {items.map((requirement) => (
            <tr key={requirement.id}>
              <td>
                <Link to={`/requerimientos/${requirement.id}`}>
                  {requirement.title}
                </Link>
                <span className="ws-muted">
                  {requirement.code} ·{" "}
                  {propertyTypeLabels[requirement.property_type]}
                </span>
              </td>
              <td>
                {requirement.city}
                {requirement.districts.length > 0 && (
                  <span className="ws-muted">
                    {requirement.districts.join(", ")}
                  </span>
                )}
              </td>
              <td>
                {formatArea(requirement.min_area_m2)} –{" "}
                {formatArea(requirement.max_area_m2)}
              </td>
              <td>{formatMoney(requirement.max_monthly_budget)}</td>
              <td>
                <Pill tone={requirementStatusTones[requirement.status]}>
                  {requirementStatusLabels[requirement.status]}
                </Pill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Creates a requirement for a fixed company and opens it to search candidates. */
export function RequirementCreateForm({ companyId }: { companyId: string }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: (body: RequirementCreate) =>
      call(() => api.POST("/api/v1/requirements", { body })),
    onSuccess: (requirement) => {
      void client.invalidateQueries({ queryKey: ["requirements"] });
      void client.invalidateQueries({ queryKey: ["companies-overview"] });
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
      company_id: companyId,
      title: text("title"),
      property_type: text("property_type") as PropertyType,
      city: text("city"),
      districts: splitList(form.get("districts")),
      min_area_m2: Number(text("min_area_m2")),
      max_area_m2: Number(text("max_area_m2")),
      max_monthly_budget: Number(text("max_monthly_budget")),
      required_features: splitList(form.get("required_features")),
    };
    if (!body.title || !body.city) {
      setFormError("Título y ciudad son obligatorios.");
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
      aria-label="Nuevo requerimiento"
      aria-busy={create.isPending}
    >
      {formError && (
        <p className="form-error form-span" role="alert">
          {formError}
        </p>
      )}
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
