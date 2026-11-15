import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { components } from "../../api/schema";
import { call } from "../inventory/labels";

export type CompanyDetail = components["schemas"]["CompanyDetailResponse"];
export type CompanyOverviewItem = components["schemas"]["CompanyOverviewItem"];
export type CompanyStatus = CompanyOverviewItem["status"];

export type SafeError = {
  message: string;
  status?: number;
};

/** Company detail cache key; logout removes every `["company", …]` entry. */
export const companyKey = (companyId: string) => ["company", companyId];
/** Must start with "companies-overview": activity mutations invalidate that prefix. */
export const companiesOverviewKey = ["companies-overview", "all"];

export const companyStatusLabels: Record<CompanyStatus, string> = {
  active: "Activa",
  inactive: "Inactiva",
};

export function creationMessage(error: SafeError) {
  if (error.status === 409) {
    return "La identificación fiscal ya existe. Revisa el dato o consulta la empresa existente.";
  }
  if (error.status === 422) {
    return "Revisa los datos de la empresa antes de continuar.";
  }
  return error.message;
}

export function detailMessage(error: SafeError) {
  if (error.status === 404) return "No encontramos esa empresa.";
  return error.message;
}

export function requestError(response: Response): SafeError {
  if (response.status === 409 || response.status === 422) {
    return {
      status: response.status,
      message: creationMessage({ status: response.status, message: "" }),
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

export function networkError(): SafeError {
  return {
    message: "Hay un problema de conexión con el servidor. Inténtalo de nuevo.",
  };
}

export function useCompanyDetail(companyId: string) {
  return useQuery<CompanyDetail, SafeError>({
    queryKey: companyKey(companyId),
    enabled: Boolean(companyId),
    retry: false,
    queryFn: async () => {
      try {
        const { data, response } = await api.GET(
          "/api/v1/companies/{company_id}",
          { params: { path: { company_id: companyId } } },
        );
        if (!response.ok || !data) throw requestError(response);
        return data;
      } catch (error) {
        if (error instanceof Error) throw networkError();
        throw error;
      }
    },
  });
}

/** Whole portfolio; the overview filters client-side so every chip count stays exact. */
export function useCompaniesOverview(enabled = true) {
  return useQuery({
    queryKey: companiesOverviewKey,
    enabled,
    retry: false,
    queryFn: () => call(() => api.GET("/api/v1/companies/overview")),
  });
}

export function companyName(company: {
  legal_name: string;
  trade_name: string | null;
}) {
  return company.trade_name || company.legal_name;
}
