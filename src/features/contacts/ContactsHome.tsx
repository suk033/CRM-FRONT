import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export function ContactsHome() {
  const navigate = useNavigate();
  const [error, setError] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  return (
    <section
      className="workspace-card feature-card"
      aria-labelledby="contacts-home-title"
    >
      <p className="eyebrow">CONTACTOS</p>
      <h1 id="contacts-home-title">Contactos por empresa</h1>
      <p>
        Los contactos pertenecen a una empresa. No existe un listado global de
        contactos; abre una ficha para consultarlos o agregar uno.
      </p>
      <p>
        Si aún no tienes una empresa, créala en Empresas y conserva su ID para
        volver a consultar sus contactos.
      </p>
      <form
        className="lookup-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const id = String(
            new FormData(event.currentTarget).get("company_id") ?? "",
          ).trim();
          if (!id) {
            setError(true);
            errorRef.current?.focus();
            return;
          }
          setError(false);
          navigate(`/empresas/${encodeURIComponent(id)}#contactos`);
        }}
      >
        <label className="form-field" htmlFor="contacts-company-id">
          ID de empresa
        </label>
        <input
          id="contacts-company-id"
          name="company_id"
          required
          aria-describedby="contacts-lookup-help"
        />
        <p id="contacts-lookup-help">
          Necesitas el ID de una empresa existente. No hay una empresa
          seleccionada en esta pantalla.
        </p>
        {error && (
          <p className="form-error" role="alert" tabIndex={-1} ref={errorRef}>
            Ingresa un ID de empresa para abrir sus contactos.
          </p>
        )}
        <button className="primary-action" type="submit">
          Abrir contactos
        </button>
      </form>
      <Link to="/empresas" className="secondary-action action-link">
        Crear o consultar empresa
      </Link>
    </section>
  );
}
