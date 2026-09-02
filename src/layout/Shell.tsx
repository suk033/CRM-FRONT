import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import type { components } from "../api/schema";

type Props = {
  user?: components["schemas"]["CurrentUserResponse"];
  onLogout: () => void;
  children: ReactNode;
};
export function Shell({ user, onLogout, children }: Props) {
  const role = user?.role === "admin" ? "Administrador" : "Asesor";
  return (
    <div className="app-shell">
      <header>
        <strong>SUPRA CRM</strong>
        <div>
          <span>{user?.email}</span>
          <span>
            {role} · {user?.is_active ? "Activo" : "Inactivo"}
          </span>
          <button onClick={onLogout}>Cerrar sesión</button>
        </div>
      </header>
      <nav aria-label="Módulos">
        <NavLink to="/" end>
          Inicio
        </NavLink>
        <NavLink to="/empresas">Empresas</NavLink>
        <button disabled>Reportes · Próximamente</button>
      </nav>
      {children}
    </div>
  );
}
