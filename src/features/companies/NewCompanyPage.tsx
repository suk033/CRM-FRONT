import { Link } from "react-router-dom";
import { CompanyCreateForm } from "./Companies";

export function NewCompanyPage() {
  return (
    <section className="new-company" aria-labelledby="new-company-title">
      <Link className="new-company-back" to="/empresas">
        <span aria-hidden="true">←</span> Volver
      </Link>
      <header className="new-company-header">
        <h1 id="new-company-title">Nueva empresa</h1>
        <p>
          Alta en dos pasos: guarda la empresa y después agrega su contacto.
        </p>
        <ol className="new-company-steps" aria-label="Pasos del alta">
          <li aria-current="step">
            <span aria-hidden="true">1</span> Empresa · En curso
          </li>
          <li>
            <span aria-hidden="true">2</span> Contacto · Pendiente
          </li>
        </ol>
      </header>
      <CompanyCreateForm>
        <section
          className="new-company-contact"
          aria-labelledby="new-company-step-two"
        >
          <h2 id="new-company-step-two">
            2. Contacto <span>Pendiente</span>
          </h2>
          <p>
            Podrás agregar un contacto después de guardar la empresa y confirmar
            su ficha con el servidor.
          </p>
        </section>
        <p className="new-company-info">
          Primero guardaremos la empresa y consultaremos su ficha actualizada.
          El contacto se guardará por separado en el siguiente paso.
        </p>
      </CompanyCreateForm>
    </section>
  );
}
