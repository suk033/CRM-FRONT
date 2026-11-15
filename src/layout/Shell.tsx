import {
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { NavLink, useLocation } from "react-router-dom";
import type { components } from "../api/schema";

type Props = {
  user?: components["schemas"]["CurrentUserResponse"];
  onLogout: () => void;
  children: ReactNode;
};
const desktopQuery = "(min-width: 1024px)";
function subscribeViewport(onChange: () => void) {
  const media = window.matchMedia?.(desktopQuery);
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}
function desktopSnapshot() {
  return window.matchMedia?.(desktopQuery).matches ?? true;
}
function NavIcon({ path }: { path: string }) {
  return (
    <svg
      className="shell-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

export function Shell({ user, onLogout, children }: Props) {
  const { pathname } = useLocation();
  const desktop = useSyncExternalStore(
    subscribeViewport,
    desktopSnapshot,
    () => true,
  );
  const [menu, setMenu] = useState({ pathname, open: false });
  // Reset only navigation state on external route changes, without remounting content.
  if (menu.pathname !== pathname) setMenu({ pathname, open: false });
  const open = menu.pathname === pathname && menu.open;
  const menuId = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const closeMenu = () => {
    setMenu({ pathname, open: false });
    if (!desktop) toggle.current?.focus();
  };
  const role = user?.role === "admin" ? "Administrador" : "Asesor";
  const context = pathname.startsWith("/empresas")
    ? "Empresas"
    : pathname.startsWith("/contactos")
      ? "Contactos"
      : "Inicio";
  return (
    <div
      className="app-shell"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open && !desktop) {
          event.preventDefault();
          closeMenu();
        }
      }}
    >
      <header className="shell-header">
        <div className="shell-brand-context">
          <button
            ref={toggle}
            className="shell-menu-toggle secondary-action"
            aria-label="Menú de módulos"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setMenu({ pathname, open: !open })}
          >
            <NavIcon path="M4 6h16M4 12h16M4 18h16" />
          </button>
          <div>
            <strong className="brand-mark">SUPRA CRM</strong>
            <span className="shell-context">{context}</span>
          </div>
        </div>
        <div className="user-summary">
          <div className="user-identity">
            {user ? (
              <>
                <span className="user-email">{user.email}</span>
                <span className="user-status">
                  {role} · {user.is_active ? "Activo" : "Inactivo"}
                </span>
              </>
            ) : (
              <span className="user-status" role="status">
                Cargando usuario…
              </span>
            )}
          </div>
          <button className="secondary-action" onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
      </header>
      <nav
        id={menuId}
        className="shell-nav"
        aria-label="Módulos"
        hidden={!desktop && !open}
      >
        <span className="shell-nav-caption">ESPACIO DE TRABAJO</span>
        <NavLink to="/" end onClick={closeMenu}>
          <NavIcon path="m3 10 9-7 9 7v10h-6v-7H9v7H3Z" />
          Inicio
        </NavLink>
        <NavLink to="/empresas" onClick={closeMenu}>
          <NavIcon path="M4 21V3h12v18M16 9h4v12M8 7h4M8 11h4M8 15h4M2 21h20" />
          Empresas
        </NavLink>
        <NavLink to="/contactos" onClick={closeMenu}>
          <NavIcon path="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M20 21v-2a4 4 0 0 0-3-4M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM17 3a4 4 0 0 1 0 8" />
          Contactos
        </NavLink>
        <button disabled>
          <NavIcon path="M4 3h16v18H4ZM8 16v-4M12 16V8M16 16v-6" />
          <span>Reportes · Próximamente</span>
        </button>
        <p className="shell-nav-footer">Gestión de empresas y contactos</p>
      </nav>
      <main className="shell-main">{children}</main>
    </div>
  );
}
