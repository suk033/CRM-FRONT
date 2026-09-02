import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthenticatedApp, Login } from "./features/auth/auth";
import {
  CompaniesPage,
  CompanyCreatePage,
  CompanyDetailPage,
} from "./features/companies/companies";
import "./styles.css";

const queryClient = new QueryClient();

function Dashboard() {
  return (
    <main className="workspace-page">
      <p className="eyebrow">ESPACIO DE TRABAJO</p>
      <h1>Inicio</h1>
      <p className="lede">
        Gestioná empresas y sus contactos desde el módulo Empresas.
      </p>
    </main>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<AuthenticatedApp />}>
            <Route index element={<Dashboard />} />
            <Route path="empresas" element={<CompaniesPage />} />
            <Route path="empresas/nueva" element={<CompanyCreatePage />} />
            <Route path="empresas/:companyId" element={<CompanyDetailPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
