import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import "./styles.css";

const queryClient = new QueryClient();

function FoundationLanding() {
  return (
    <main className="foundation-shell">
      <section className="foundation-hero" aria-labelledby="foundation-title">
        <p className="eyebrow">SUPRA CRM</p>
        <h1 id="foundation-title">La base del CRM está lista.</h1>
        <p className="lede">
          Una interfaz segura, accesible y preparada para conectar los próximos
          módulos con la API.
        </p>
      </section>
      <section className="foundation-status" aria-labelledby="readiness-title">
        <h2 id="readiness-title">Preparada para la siguiente fase</h2>
        <ul>
          <li>Aplicación React con TypeScript estricto.</li>
          <li>Enrutamiento y caché de datos listos para integrar.</li>
          <li>Contrato OpenAPI tipado y configuración por entorno.</li>
        </ul>
      </section>
    </main>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <FoundationLanding />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
