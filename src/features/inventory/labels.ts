import type { components } from "../../api/schema";

type Property = components["schemas"]["PropertyResponse"];
export type PropertyType = Property["property_type"];
export type PropertyStatus = Property["status"];
export type RequirementStatus =
  components["schemas"]["RequirementResponse"]["status"];

export const propertyTypeLabels: Record<PropertyType, string> = {
  retail: "Local comercial",
  office: "Oficina",
  warehouse: "Almacén",
  land: "Terreno",
};

export const propertyStatusLabels: Record<PropertyStatus, string> = {
  available: "Disponible",
  reserved: "Reservado",
  rented: "Alquilado",
};

export const requirementStatusLabels: Record<RequirementStatus, string> = {
  open: "Abierto",
  searching: "En búsqueda",
  proposal: "Propuesta",
  won: "Ganado",
  lost: "Perdido",
};

export const featureLabels: Record<string, string> = {
  price_fit: "Precio",
  area_fit: "Área",
  district_match: "Distrito",
  type_match: "Tipo",
  feature_coverage: "Características",
  availability: "Disponibilidad",
  strategic_stock: "Stock estratégico",
};

export function featureLabel(name: string) {
  return featureLabels[name] ?? name;
}

export function formatMoney(amount: number, currency = "PEN") {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatArea(area: number) {
  return `${new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 }).format(area)} m²`;
}

export function formatPercent(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)} %`;
}

export function splitList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const fallbackMessage =
  "No fue posible completar la solicitud. Inténtalo de nuevo.";

/** Builds a safe Spanish message, keeping the backend detail when it is text. */
export function requestMessage(error: unknown, response?: Response) {
  if (!response) {
    return "Hay un problema de conexión con el servidor. Inténtalo de nuevo.";
  }
  const detail =
    typeof error === "object" && error !== null && "detail" in error
      ? error.detail
      : undefined;
  const prefix =
    response.status === 403
      ? "No tienes permiso para esta acción."
      : response.status === 404
        ? "No encontramos el recurso solicitado."
        : response.status === 409
          ? "La operación no se puede completar todavía."
          : response.status === 422
            ? "Revisa los datos enviados."
            : fallbackMessage;
  return typeof detail === "string" && detail ? `${prefix} ${detail}` : prefix;
}

/** Error carrying a user-facing message, thrown by query and mutation functions. */
export class RequestError extends Error {}

export async function call<T>(
  run: () => Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  let result: { data?: T; error?: unknown; response: Response };
  try {
    result = await run();
  } catch {
    throw new RequestError(requestMessage(undefined));
  }
  if (!result.response.ok || result.data === undefined) {
    throw new RequestError(requestMessage(result.error, result.response));
  }
  return result.data;
}
