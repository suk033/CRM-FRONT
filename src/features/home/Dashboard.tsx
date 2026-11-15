import { Link } from "react-router-dom";
import type { components } from "../../api/schema";

type Props = { user?: components["schemas"]["CurrentUserResponse"] };
const capabilities = [
  {
    title: "Empresas",
    text: "Registra una empresa y conserva su ID para volver a su ficha.",
    icon: "M4 21V3h12v18M16 9h4v12M8 7h4M8 11h4M8 15h4M9 21v-2h2v2",
  },
  {
    title: "Contactos",
    text: "Agrega personas de contacto desde la ficha de cada empresa.",
    icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  },
  {
    title: "Consulta por ID",
    text: "Abre una ficha para consultar los datos actuales y sus contactos.",
    icon: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  },
];

const realEstateModules = [
  {
    to: "/inmuebles",
    title: "Inmuebles",
    text: "Filtra locales, oficinas y almacenes por zona, estado y stock.",
  },
  {
    to: "/requerimientos",
    title: "Requerimientos",
    text: "Registra lo que necesita una empresa y ordena sus candidatos.",
  },
  {
    to: "/aprendizaje",
    title: "Aprendizaje",
    text: "Revisa la evidencia y las métricas del modelo de recomendación.",
  },
];

function Icon({ path }: { path: string }) {
  return (
    <svg
      className="dashboard-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

export function Dashboard({ user }: Props) {
  return (
    <section className="dashboard" aria-labelledby="dashboard-title">
      <div className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">TU ESPACIO DE TRABAJO</p>
          <h1 id="dashboard-title">Inicio</h1>
          <p className="dashboard-lead">
            Empresas y contactos, con un punto de partida claro. Registra,
            consulta y construye tus relaciones desde aquí.
          </p>
        </div>
        <Link className="dashboard-primary" to="/empresas/nueva">
          <Icon path="M12 5v14M5 12h14" />
          Nueva empresa
        </Link>
      </div>
      <div className="dashboard-capabilities">
        {capabilities.map(({ title, text, icon }) => (
          <section className="dashboard-card" key={title}>
            <span className="dashboard-icon-tile">
              <Icon path={icon} />
            </span>
            <h2>{title}</h2>
            <p>{text}</p>
          </section>
        ))}
        <section className="dashboard-card">
          <span className="dashboard-icon-tile">
            <Icon path="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11M8 12l3 3 5-6" />
          </span>
          <h2>Tu sesión</h2>
          <p role="status">
            {user
              ? `Rol: ${user.role === "admin" ? "Administrador" : "Asesor"}. Acceso: ${user.is_active ? "Activo" : "Inactivo"}.`
              : "Cargando tu sesión…"}
          </p>
          <p className="dashboard-caption">
            Tu rol y estado de acceso en SUPRA.
          </p>
        </section>
      </div>
      <div className="dashboard-panels">
        <section
          className="dashboard-panel"
          aria-labelledby="dashboard-actions"
        >
          <h2 id="dashboard-actions">Acciones rápidas</h2>
          <p>Elige por dónde continuar.</p>
          <Link
            className="dashboard-quick-action"
            to="/empresas"
            aria-label="Ir a Empresas"
          >
            <span>
              <strong>Ir a Empresas</strong>
              <small>Crea una empresa o consulta una ficha por ID.</small>
            </span>
            <Icon path="M5 12h14M13 6l6 6-6 6" />
          </Link>
          <Link
            className="dashboard-quick-action"
            to="/contactos"
            aria-label="Contactos por empresa"
          >
            <span>
              <strong>Contactos por empresa</strong>
              <small>
                Abre la empresa por ID para ver y agregar contactos.
              </small>
            </span>
            <Icon path="M5 12h14M13 6l6 6-6 6" />
          </Link>
        </section>
        <section
          className="dashboard-panel"
          aria-labelledby="dashboard-real-estate"
        >
          <h2 id="dashboard-real-estate">Gestión inmobiliaria</h2>
          <p>Del requerimiento al inmueble recomendado.</p>
          {realEstateModules.map(({ to, title, text }) => (
            <Link
              key={to}
              className="dashboard-quick-action"
              to={to}
              aria-label={`Ir a ${title}`}
            >
              <span>
                <strong>{title}</strong>
                <small>{text}</small>
              </span>
              <Icon path="M5 12h14M13 6l6 6-6 6" />
            </Link>
          ))}
        </section>
        <section
          className="dashboard-panel"
          aria-labelledby="dashboard-workflow"
        >
          <h2 id="dashboard-workflow">Cómo trabajar con SUPRA</h2>
          <p>De la empresa a las personas que la hacen posible.</p>
          <ol className="dashboard-workflow">
            <li>
              <strong>Registra la empresa</strong>
              <p>Completa sus datos en Empresas y guarda el ID recibido.</p>
            </li>
            <li>
              <strong>Abre la ficha actualizada</strong>
              <p>
                Después de crearla, consulta el detalle devuelto por el
                servidor.
              </p>
            </li>
            <li>
              <strong>Agrega contactos</strong>
              <p>
                Desde esa ficha, vincula las personas de contacto a la empresa.
              </p>
            </li>
          </ol>
        </section>
      </div>
    </section>
  );
}
