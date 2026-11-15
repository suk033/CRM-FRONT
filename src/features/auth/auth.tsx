import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import {
  api,
  getAccessToken,
  onAuthCleared,
  setAccessToken,
} from "../../api/client";
import { CompaniesOverviewPage } from "../companies/CompaniesOverviewPage";
import { CompanyWorkspacePage } from "../companies/CompanyWorkspacePage";
import { NewCompanyPage } from "../companies/NewCompanyPage";
import { Shell } from "../../layout/Shell";
import logo from "../../assets/supra-logo.svg";
import { HomePage } from "../home/HomePage";
import { PropertiesPage } from "../inventory/PropertiesPage";
import { PropertyDetailPage } from "../inventory/PropertyDetailPage";
import { ProfilePage } from "../profile/ProfilePage";
import { RequirementDetailPage } from "../requirements/RequirementDetailPage";

type Credentials = { email: string; password: string };
const userKey = ["current-user"];

export function AuthenticatedApp() {
  const client = useQueryClient();
  const [token, setToken] = useState(getAccessToken());
  useEffect(
    () =>
      onAuthCleared(() => {
        setToken(null);
        client.removeQueries({ queryKey: userKey });
        client.removeQueries({ queryKey: ["company"] });
        client.getMutationCache().clear();
      }),
    [client],
  );
  const user = useQuery({
    queryKey: userKey,
    enabled: Boolean(token),
    queryFn: async () => {
      const { data, response } = await api.GET("/api/v1/users/me");
      if (!response.ok || !data) throw new Error("current user unavailable");
      return data;
    },
  });
  const logout = () => {
    setAccessToken(null);
  };
  if (!token) return <Navigate to="/login" replace />;
  if (user.isError) return <Navigate to="/login" replace />;
  return (
    <Shell user={user.data} onLogout={logout}>
      <Routes>
        <Route path="/" element={<HomePage user={user.data} />} />
        <Route path="/empresas" element={<CompaniesOverviewPage />} />
        <Route path="/empresas/nueva" element={<NewCompanyPage />} />
        <Route path="/empresas/:companyId" element={<CompanyWorkspacePage />} />
        <Route path="/inmuebles" element={<PropertiesPage />} />
        <Route path="/inmuebles/:propertyId" element={<PropertyDetailPage />} />
        <Route
          path="/requerimientos/:requirementId"
          element={<RequirementDetailPage />}
        />
        <Route path="/perfil" element={<ProfilePage user={user.data} />} />
        {/* Former top-level modules now live inside Empresas and Perfil. */}
        <Route
          path="/requerimientos"
          element={<Navigate to="/empresas" replace />}
        />
        <Route
          path="/contactos"
          element={<Navigate to="/empresas" replace />}
        />
        <Route
          path="/aprendizaje"
          element={<Navigate to="/perfil?seccion=modelo" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

export function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState(false);
  const login = useMutation({
    mutationFn: async (credentials: Credentials) => {
      const { data, response } = await api.POST("/api/v1/auth/login", {
        body: credentials,
      });
      if (!response.ok || !data) throw new Error("login unavailable");
      return data.access_token;
    },
    onSuccess: (token) => {
      setAccessToken(token);
      navigate("/", { replace: true });
    },
    onError: () => setError(true),
  });
  return (
    <main className="login-page">
      <section className="login-brand" aria-label="SUPRA CRM">
        <div className="login-wordmark">
          <span className="login-monogram" aria-hidden="true">
            <img src={logo} alt="" />
          </span>
          <div>
            <strong>SUPRA CRM</strong>
            <p>Gestión de relaciones empresariales</p>
          </div>
        </div>
        <div className="login-brand-message">
          <p className="login-brand-title">
            Empresas y contactos, en un solo lugar.
          </p>
          <p>
            Crea empresas, consulta sus fichas y organiza sus contactos desde tu
            espacio de trabajo.
          </p>
        </div>
        <p className="login-brand-footer">
          Espacio empresarial · Acceso por roles
        </p>
      </section>
      <div className="login-form-panel">
        <form
          className="login-card"
          onSubmit={(event) => {
            event.preventDefault();
            if (login.isPending) return;
            setError(false);
            const form = new FormData(event.currentTarget);
            login.mutate({
              email: String(form.get("email")),
              password: String(form.get("password")),
            });
          }}
          aria-labelledby="login-title"
          aria-busy={login.isPending}
        >
          <p className="eyebrow">ACCESO A TU ESPACIO</p>
          <h1 id="login-title">Iniciar sesión</h1>
          <p className="login-description">
            Accede a tu espacio de trabajo para gestionar la relación con tus
            empresas y contactos.
          </p>
          <label className="form-field" htmlFor="login-email">
            Correo electrónico
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={login.isPending}
          />
          <label className="form-field" htmlFor="login-password">
            Contraseña
          </label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={login.isPending}
            aria-describedby="login-password-help"
          />
          <p id="login-password-help" className="login-help">
            Puedes pegar tu contraseña o usar tu gestor.
          </p>
          {error && (
            <p className="form-error" role="alert">
              No fue posible iniciar sesión. Verifica tus datos e inténtalo de
              nuevo.
            </p>
          )}
          <button
            className="primary-action"
            type="submit"
            disabled={login.isPending}
          >
            {login.isPending ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
        <p
          className="login-status"
          role={login.isPending ? "status" : undefined}
          aria-live="polite"
          aria-atomic="true"
        >
          {login.isPending ? "Verificando tus credenciales…" : ""}
        </p>
      </div>
    </main>
  );
}
