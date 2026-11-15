import { useState } from "react";
import type { FormEvent } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import {
  call,
  formatArea,
  formatMoney,
  propertyStatusLabels,
  propertyTypeLabels,
  type PropertyStatus,
  type PropertyType,
} from "./labels";
import { PropertyImport } from "./PropertyImport";
import { PageHeader, Panel } from "../../components/ui";
import { Select } from "../../components/Select";

const pageSize = 10;

type Filters = {
  q?: string;
  city?: string;
  property_type?: PropertyType;
  status?: PropertyStatus;
  strategic_stock?: boolean;
};

function readFilters(form: FormData): Filters {
  const text = (name: string) =>
    String(form.get(name) ?? "").trim() || undefined;
  const stock = form.get("strategic_stock");
  return {
    q: text("q"),
    city: text("city"),
    property_type: text("property_type") as PropertyType | undefined,
    status: text("status") as PropertyStatus | undefined,
    strategic_stock:
      stock === "yes" ? true : stock === "no" ? false : undefined,
  };
}

/** Agents look for what they can offer, so the list opens on available stock. */
const defaultFilters: Filters = { status: "available" };

export function PropertiesPage() {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [page, setPage] = useState(1);
  const properties = useQuery({
    queryKey: ["properties", filters, page],
    placeholderData: keepPreviousData,
    retry: false,
    queryFn: () =>
      call(() =>
        api.GET("/api/v1/properties", {
          params: { query: { ...filters, page, page_size: pageSize } },
        }),
      ),
  });
  const total = properties.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters(readFilters(new FormData(event.currentTarget)));
    setPage(1);
  }

  return (
    <div className="ws-page">
      <PageHeader
        eyebrow="Inventario"
        title="Inmuebles"
        description="Locales comerciales, oficinas, almacenes y terrenos disponibles para los requerimientos de tus empresas."
      />
      <Panel title="Filtros">
        <form className="ws-filter-bar" onSubmit={submit} role="search">
          <label>
            Buscar
            <input id="property-q" name="q" placeholder="Código o título" />
          </label>
          <label>
            Ciudad
            <input id="property-city" name="city" placeholder="Ej. Lima" />
          </label>
          <div className="ws-field">
            <label htmlFor="property-type">Tipo</label>
            <Select
              id="property-type"
              name="property_type"
              defaultValue=""
              options={[
                { value: "", label: "Todos" },
                ...Object.entries(propertyTypeLabels).map(([value, label]) => ({
                  value,
                  label,
                })),
              ]}
            />
          </div>
          <div className="ws-field">
            <label htmlFor="property-status">Estado</label>
            <Select
              id="property-status"
              name="status"
              defaultValue={defaultFilters.status}
              options={[
                { value: "", label: "Todos" },
                ...Object.entries(propertyStatusLabels).map(
                  ([value, label]) => ({
                    value,
                    label,
                  }),
                ),
              ]}
            />
          </div>
          <div className="ws-field">
            <label htmlFor="property-stock">Stock estratégico</label>
            <Select
              id="property-stock"
              name="strategic_stock"
              defaultValue=""
              options={[
                { value: "", label: "Todos" },
                { value: "yes", label: "Solo estratégicos" },
                { value: "no", label: "No estratégicos" },
              ]}
            />
          </div>
          <button className="primary-action" type="submit">
            Filtrar
          </button>
        </form>
      </Panel>

      <PropertyImport />

      <section
        className="ws-panel"
        aria-labelledby="properties-results"
        aria-busy={properties.isFetching}
      >
        <div className="ws-panel-header">
          <h2 id="properties-results">Resultados</h2>
          {properties.data && properties.data.items.length > 0 && (
            <span className="ws-muted">
              {total} inmueble{total === 1 ? "" : "s"} · página {page} de{" "}
              {pages}
            </span>
          )}
        </div>
        {properties.isLoading && <p role="status">Cargando inmuebles…</p>}
        {properties.isError && (
          <p className="form-error" role="alert">
            {properties.error.message}
          </p>
        )}
        {properties.data && properties.data.items.length === 0 && (
          <p className="ws-empty">
            No hay inmuebles que coincidan con los filtros.
          </p>
        )}
        {properties.data && properties.data.items.length > 0 && (
          <>
            <div className="ws-table-wrap">
              <table className="ws-table">
                <thead>
                  <tr>
                    <th scope="col">Código</th>
                    <th scope="col">Inmueble</th>
                    <th scope="col">Ubicación</th>
                    <th scope="col">Área</th>
                    <th scope="col">Renta mensual</th>
                    <th scope="col">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {properties.data.items.map((property) => (
                    <tr key={property.id}>
                      <td className="ws-code">{property.code}</td>
                      <td>
                        <Link to={`/inmuebles/${property.id}`}>
                          {property.title}
                        </Link>
                        <span className="ws-muted">
                          {propertyTypeLabels[property.property_type]}
                        </span>
                      </td>
                      <td>
                        {property.district}, {property.city}
                      </td>
                      <td>{formatArea(property.area_m2)}</td>
                      <td>
                        {formatMoney(property.monthly_rent, property.currency)}
                      </td>
                      <td>
                        <span className="ws-badges">
                          <span className={`badge badge-${property.status}`}>
                            {propertyStatusLabels[property.status]}
                          </span>
                          {property.is_strategic_stock && (
                            <span className="badge badge-strategic">
                              Stock estratégico
                            </span>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ws-pagination">
              <button
                className="secondary-action"
                disabled={page <= 1 || properties.isFetching}
                onClick={() => setPage((current) => current - 1)}
              >
                Anterior
              </button>
              <button
                className="secondary-action"
                disabled={page >= pages || properties.isFetching}
                onClick={() => setPage((current) => current + 1)}
              >
                Siguiente
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
