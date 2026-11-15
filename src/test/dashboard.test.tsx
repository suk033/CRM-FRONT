import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Dashboard } from "../features/home/Dashboard";

const user = {
  id: "1",
  email: "ana@supra.test",
  role: "admin" as const,
  is_active: true,
  created_at: "2025-01-01T00:00:00Z",
};

function renderDashboard(currentUser?: typeof user) {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<Dashboard user={currentUser} />} />
        <Route path="/empresas" element={<h1>Destino empresas</h1>} />
        <Route
          path="/empresas/nueva"
          element={<h1>Destino nueva empresa</h1>}
        />
        <Route path="/contactos" element={<h1>Destino contactos</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Inicio", () => {
  it("presenta capacidades y un flujo real, sin métricas ni acciones ficticias", () => {
    const { container } = renderDashboard(user);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /^Inicio$/,
    );
    for (const name of [
      "Empresas",
      "Contactos",
      "Consulta por ID",
      "Tu sesión",
      "Acciones rápidas",
      "Cómo trabajar con SUPRA",
    ]) {
      expect(
        screen.getByRole("heading", { name, level: 2 }),
      ).toBeInTheDocument();
    }
    expect(
      screen.getByText("Rol: Administrador. Acceso: Activo."),
    ).toBeInTheDocument();
    expect(screen.getByText(/abre la ficha actualizada/i)).toBeInTheDocument();
    expect(screen.getByText(/agrega contactos/i)).toBeInTheDocument();
    expect(container).not.toHaveTextContent(
      /Andrea|prioridades|visitas|pipeline|oportunidades|propuestas|\b18\b|\b36\b/,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it.each([
    ["Nueva empresa", "/empresas/nueva", "Destino nueva empresa"],
    ["Ir a Empresas", "/empresas", "Destino empresas"],
    ["Contactos por empresa", "/contactos", "Destino contactos"],
  ])("navega desde %s a %s", (name, target, heading) => {
    renderDashboard();
    const link = screen.getByRole("link", { name });
    expect(link).toHaveAttribute("href", target);
    fireEvent.click(link);
    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
  });

  it("no inventa rol ni estado mientras carga el usuario", () => {
    renderDashboard();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando tu sesión…");
    expect(
      screen.queryByText(/Asesor|Administrador|Inactivo|Activo/),
    ).not.toBeInTheDocument();
  });

  it("refleja el rol y estado recibidos, incluso una sesión inactiva", () => {
    render(
      <MemoryRouter>
        <Dashboard user={{ ...user, role: "advisor", is_active: false }} />
      </MemoryRouter>,
    );
    expect(
      screen.getByText("Rol: Asesor. Acceso: Inactivo."),
    ).toBeInTheDocument();
  });
});
