import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { Avatar, EmptyState, Panel } from "../../components/ui";
import { ConfirmDialog, useToast } from "../../components/Feedback";
import { Select } from "../../components/Select";
import { call } from "../inventory/labels";
import {
  companyName,
  useCompaniesOverview,
  type CompanyOverview,
} from "../home/workspaceData";
import { useUsers } from "./AdminUsers";

type Pending = {
  company: CompanyOverview;
  advisorId: string;
  advisorEmail: string;
};

/** Admin: reassign each company to an active advisor (portfolio, requirements and activities move with it). */
export function AdminAssignments() {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const companies = useCompaniesOverview();
  const users = useUsers();
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Pending | null>(null);
  const advisors = (users.data?.items ?? []).filter(
    (user) => user.role === "advisor" && user.is_active,
  );

  const assign = useMutation({
    mutationFn: ({
      companyId,
      advisorId,
    }: {
      companyId: string;
      advisorId: string;
    }) =>
      call(() =>
        api.PUT("/api/v1/companies/{company_id}/assignment", {
          params: { path: { company_id: companyId } },
          body: { assigned_advisor_id: advisorId },
        }),
      ),
  });

  function confirm() {
    if (!pending) return;
    const target = pending;
    assign.mutate(
      { companyId: target.company.id, advisorId: target.advisorId },
      {
        onSuccess: () => {
          setPending(null);
          setChoices((current) => {
            const next = { ...current };
            delete next[target.company.id];
            return next;
          });
          notify(
            `${companyName(target.company)} quedó asignada a ${target.advisorEmail}.`,
          );
          void Promise.all([
            queryClient.invalidateQueries({ queryKey: ["companies-overview"] }),
            queryClient.invalidateQueries({ queryKey: ["activities"] }),
            queryClient.invalidateQueries({ queryKey: ["advisor-report"] }),
          ]);
        },
        onError: (error) => {
          setPending(null);
          notify(error.message, "danger");
        },
      },
    );
  }

  const loading = companies.isLoading || users.isLoading;
  const error = companies.error ?? users.error;
  const items = companies.data?.items ?? [];

  return (
    <Panel title="Asignación de empresas">
      <p className="ws-muted">
        Al reasignar una empresa, el nuevo asesor ve sus requerimientos,
        actividades y contactos, y el anterior deja de verlos.
      </p>
      {loading && <p role="status">Cargando empresas…</p>}
      {error && (
        <p className="form-error" role="alert">
          {error.message}
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <EmptyState>No hay empresas.</EmptyState>
      )}
      {!loading && !error && items.length > 0 && (
        <div className="ws-table-wrap">
          <table className="ws-table">
            <thead>
              <tr>
                <th scope="col">Empresa</th>
                <th scope="col">Asesor actual</th>
                <th scope="col">Nuevo asesor</th>
                <th scope="col">
                  <span className="ws-visually-hidden">Acción</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((company) => {
                const chosen = choices[company.id] ?? "";
                const advisor = advisors.find((user) => user.id === chosen);
                const unchanged =
                  !chosen || chosen === company.assigned_advisor_id;
                return (
                  <tr key={company.id}>
                    <td>
                      <Link to={`/empresas/${company.id}`}>
                        {companyName(company)}
                      </Link>
                      <span className="ws-muted">
                        {company.open_requirements} req. abiertos ·{" "}
                        {company.pending_activities} pendientes
                      </span>
                    </td>
                    <td>
                      {company.assigned_advisor_email ? (
                        <span className="profile-user-cell">
                          <Avatar
                            email={company.assigned_advisor_email}
                            size="sm"
                          />
                          {company.assigned_advisor_email}
                        </span>
                      ) : (
                        <span className="ws-muted">Sin asignar</span>
                      )}
                    </td>
                    <td className="profile-assign-select">
                      <label>
                        <span className="ws-visually-hidden">
                          Nuevo asesor para {companyName(company)}
                        </span>
                        <Select
                          value={chosen}
                          placeholder="Elegir asesor"
                          onChange={(value) =>
                            setChoices((current) => ({
                              ...current,
                              [company.id]: value,
                            }))
                          }
                          options={advisors.map((user) => ({
                            value: user.id,
                            label: user.email,
                          }))}
                        />
                      </label>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="primary-action"
                        disabled={unchanged || assign.isPending}
                        onClick={() =>
                          advisor &&
                          setPending({
                            company,
                            advisorId: advisor.id,
                            advisorEmail: advisor.email,
                          })
                        }
                      >
                        Reasignar
                        <span className="ws-visually-hidden">
                          {" "}
                          {companyName(company)}
                        </span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        open={pending !== null}
        title="¿Reasignar la empresa?"
        description={
          pending && (
            <>
              <strong>{companyName(pending.company)}</strong> pasará a{" "}
              <strong>{pending.advisorEmail}</strong>.
            </>
          )
        }
        confirmLabel="Sí, reasignar"
        busy={assign.isPending}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
    </Panel>
  );
}
