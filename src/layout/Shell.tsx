import type { components } from "../api/schema";

type Props = {
  user?: components["schemas"]["CurrentUserResponse"];
  onLogout: () => void;
};
export function Shell({ user, onLogout }: Props) {
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
        <button aria-current="page">Inicio</button>
        {["Empresas", "Contactos", "Reportes"].map((module) => (
          <button key={module} disabled>
            {module} · Próximamente
          </button>
        ))}
      </nav>
      <main>
        <p className="eyebrow">ESPACIO DE TRABAJO</p>
        <h1>Inicio</h1>
        <p>
          Tu acceso está listo. Los módulos del CRM estarán disponibles
          próximamente.
        </p>
      </main>
    </div>
  );
}
