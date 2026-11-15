import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { components } from "../../api/schema";
import { call } from "../inventory/labels";

type Candidate = components["schemas"]["CandidateResponse"];
type VisitRouteRequest = components["schemas"]["VisitRouteRequest"];
type RouteSolution = components["schemas"]["RouteSolution"];

const maxStops = 8;
const limaCenter = { latitude: -12.0464, longitude: -77.0428 };

function SolutionCard({
  title,
  solution,
  codes,
}: {
  title: string;
  solution: RouteSolution;
  codes: Map<string, string>;
}) {
  return (
    <article className="route-card">
      <h3>{title}</h3>
      <ol>
        <li>Punto de partida</li>
        {solution.property_ids.map((id, index) => (
          <li key={id}>
            {codes.get(id) ?? id}{" "}
            <small>(+{(solution.legs_km[index] ?? 0).toFixed(2)} km)</small>
          </li>
        ))}
      </ol>
      <dl className="detail-list">
        <div>
          <dt>Distancia total</dt>
          <dd>{solution.distance_km.toFixed(2)} km</dd>
        </div>
        <div>
          <dt>Nodos expandidos</dt>
          <dd>{solution.nodes_expanded}</dd>
        </div>
      </dl>
    </article>
  );
}

export function RouteSection({ candidates }: { candidates: Candidate[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const route = useMutation({
    mutationFn: (body: VisitRouteRequest) =>
      call(() => api.POST("/api/v1/routes/visits", { body })),
  });

  function toggle(propertyId: string) {
    setSelected((current) =>
      current.includes(propertyId)
        ? current.filter((id) => id !== propertyId)
        : current.length < maxStops
          ? [...current, propertyId]
          : current,
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const latitude = Number(form.get("latitude"));
    const longitude = Number(form.get("longitude"));
    if (selected.length === 0) {
      setFormError("Selecciona al menos un inmueble para visitar.");
      return;
    }
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      setFormError("Revisa la latitud y la longitud del punto de partida.");
      return;
    }
    route.mutate({ start: { latitude, longitude }, property_ids: selected });
  }

  const result = route.data;
  const codes = new Map(
    (result?.stops ?? candidates.map((candidate) => candidate.property)).map(
      (property) => [property.id, property.code],
    ),
  );
  return (
    <section
      className="workspace-card feature-card module-card"
      aria-labelledby="route-title"
      aria-busy={route.isPending}
    >
      <h2 id="route-title">Ruta de visitas (BFS vs A*)</h2>
      <p>
        Ordena las visitas desde un punto de partida. BFS recorre el espacio de
        estados sin heurística; A* usa la distancia en línea recta para expandir
        menos nodos.
      </p>
      {candidates.length === 0 ? (
        <p className="empty-state">
          Busca candidatos para poder elegir inmuebles a visitar.
        </p>
      ) : (
        <form className="lookup-form" onSubmit={submit} noValidate>
          <fieldset className="choice-list">
            <legend className="form-field">
              Inmuebles a visitar (máx. {maxStops}) · {selected.length}{" "}
              seleccionados
            </legend>
            {candidates.map(({ property }) => (
              <label key={property.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(property.id)}
                  disabled={
                    !selected.includes(property.id) &&
                    selected.length >= maxStops
                  }
                  onChange={() => toggle(property.id)}
                />
                {property.code} · {property.title}
              </label>
            ))}
          </fieldset>
          <div className="filter-form">
            <div className="field-group">
              <label className="form-field" htmlFor="route-latitude">
                Latitud de partida
              </label>
              <input
                id="route-latitude"
                name="latitude"
                type="number"
                step="any"
                defaultValue={limaCenter.latitude}
              />
            </div>
            <div className="field-group">
              <label className="form-field" htmlFor="route-longitude">
                Longitud de partida
              </label>
              <input
                id="route-longitude"
                name="longitude"
                type="number"
                step="any"
                defaultValue={limaCenter.longitude}
              />
            </div>
            <button
              className="primary-action"
              type="submit"
              disabled={route.isPending}
            >
              {route.isPending ? "Calculando…" : "Calcular ruta"}
            </button>
          </div>
        </form>
      )}
      {(formError || route.isError) && (
        <p className="form-error" role="alert">
          {formError ?? route.error?.message}
        </p>
      )}
      {result && (
        <div className="result-panel" role="status">
          <div className="route-grid">
            <SolutionCard title="BFS" solution={result.bfs} codes={codes} />
            <SolutionCard title="A*" solution={result.astar} codes={codes} />
          </div>
          <p>
            {result.same_optimum
              ? "Ambos algoritmos encontraron la misma distancia óptima."
              : "Los algoritmos encontraron rutas de distinta distancia."}{" "}
            A* expandió{" "}
            <strong>
              {result.node_reduction_pct.toFixed(1)} % menos nodos
            </strong>{" "}
            que BFS.
          </p>
        </div>
      )}
    </section>
  );
}
