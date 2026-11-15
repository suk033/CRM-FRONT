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
    <div className="module-page">
      <section
        className="workspace-card feature-card module-card"
        aria-labelledby="properties-title"
      >
        <p className="eyebrow">INVENTARIO</p>
        <h1 id="properties-title">Inmuebles</h1>
        <p>
          Locales comerciales, oficinas, almacenes y terrenos disponibles para
          los requerimientos de tus empresas.
        </p>
        <form className="filter-form" onSubmit={submit} role="search">
          <div className="field-group">
            <label className="form-field" htmlFor="property-q">
              Buscar
            </label>
            <input id="property-q" name="q" placeholder="Código o título" />
          </div>
          <div className="field-group">
            <label className="form-field" htmlFor="property-city">
              Ciudad
            </label>
            <input id="property-city" name="city" />
          </div>
          <div className="field-group">
            <label className="form-field" htmlFor="property-type">
              Tipo
            </label>
            <select id="property-type" name="property_type" defaultValue="">
              <option value="">Todos</option>
              {Object.entries(propertyTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label className="form-field" htmlFor="property-status">
              Estado
            </label>
            <select
              id="property-status"
              name="status"
              defaultValue={defaultFilters.status}
            >
              <option value="">Todos</option>
              {Object.entries(propertyStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label className="form-field" htmlFor="property-stock">
              Stock estratégico
            </label>
            <select id="property-stock" name="strategic_stock" defaultValue="">
              <option value="">Todos</option>
              <option value="yes">Solo estratégicos</option>
              <option value="no">No estratégicos</option>
            </select>
          </div>
          <button className="primary-action" type="submit">
            Filtrar
          </button>
        </form>
      </section>

      <PropertyImport />

      <section
        className="workspace-card feature-card module-card"
        aria-labelledby="properties-results"
        aria-busy={properties.isFetching}
      >
        <h2 id="properties-results">Resultados</h2>
        {properties.isLoading && <p role="status">Cargando inmuebles…</p>}
        {properties.isError && (
          <p className="form-error" role="alert">
            {properties.error.message}
          </p>
        )}
        {properties.data && properties.data.items.length === 0 && (
          <p className="empty-state">
            No hay inmuebles que coincidan con los filtros.
          </p>
        )}
        {properties.data && properties.data.items.length > 0 && (
          <>
            <p>
              {total} inmueble{total === 1 ? "" : "s"} · página {page} de{" "}
              {pages}
            </p>
            <div className="table-scroll">
              <table className="data-table">
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
                      <td>{property.code}</td>
                      <td>
                        <Link to={`/inmuebles/${property.id}`}>
                          <strong>{property.title}</strong>
                        </Link>
                        <small>
                          {propertyTypeLabels[property.property_type]}
                        </small>
                      </td>
                      <td>
                        {property.district}, {property.city}
                      </td>
                      <td>{formatArea(property.area_m2)}</td>
                      <td>
                        {formatMoney(property.monthly_rent, property.currency)}
                      </td>
                      <td>
                        <span className={`badge badge-${property.status}`}>
                          {propertyStatusLabels[property.status]}
                        </span>
                        {property.is_strategic_stock && (
                          <span className="badge badge-strategic">
                            Stock estratégico
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="button-row">
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
