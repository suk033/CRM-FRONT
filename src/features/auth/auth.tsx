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
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
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
            <p>Gestión inmobiliaria corporativa</p>
          </div>
        </div>
        <div className="login-brand-message">
          <p className="login-brand-title">
            Cada búsqueda inmobiliaria, un activo para la siguiente.
          </p>
          <p>
            Requerimientos corporativos, locales candidatos y el seguimiento de
            tu equipo en un solo lugar.
          </p>
          <ul className="login-highlights">
            <li>
              <LoginIcon path="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" />
              Locales ordenados por qué tan bien encajan con cada cliente
            </li>
            <li>
              <LoginIcon path="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
              Agenda y pendientes de cada asesor
            </li>
            <li>
              <LoginIcon path="M4 19V5M4 19h16M8 15v-4M12 15V8M16 15v-6" />
              Rendimiento del equipo y recomendaciones explicables
            </li>
          </ul>
        </div>
        <p className="login-brand-footer">
          Gestión inmobiliaria corporativa · Acceso por roles
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
            const email = String(form.get("email") ?? "").trim();
            const password = String(form.get("password") ?? "");
            const missing = {
              email: email ? "" : "Ingresa tu correo electrónico.",
              password: password ? "" : "Ingresa tu contraseña.",
            };
            setFieldErrors(missing);
            if (missing.email || missing.password) return;
            login.mutate({ email, password });
          }}
          aria-labelledby="login-title"
          aria-busy={login.isPending}
          noValidate
        >
          <p className="eyebrow">ACCESO A TU ESPACIO</p>
          <h1 id="login-title">Iniciar sesión</h1>
          <p className="login-description">
            Ingresa con tu correo corporativo para continuar.
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
            aria-invalid={Boolean(fieldErrors.email) || undefined}
          />
          {fieldErrors.email && (
            <span className="ws-field-error">{fieldErrors.email}</span>
          )}
          <label className="form-field" htmlFor="login-password">
            Contraseña
          </label>
          <div className="login-password">
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              disabled={login.isPending}
              aria-invalid={Boolean(fieldErrors.password) || undefined}
            />
            <button
              type="button"
              className="login-password-toggle"
              aria-label={
                showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
              }
              aria-pressed={showPassword}
              aria-controls="login-password"
              disabled={login.isPending}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              <LoginIcon
                path={
                  showPassword
                    ? "M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10.4 10.4 0 0 1 12 5c6 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s4 7 10 7a9.7 9.7 0 0 0 5.4-1.6"
                    : "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                }
              />
            </button>
          </div>
          {fieldErrors.password && (
            <span className="ws-field-error">{fieldErrors.password}</span>
          )}
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

function LoginIcon({ path }: { path: string }) {
  return (
    <svg
      className="login-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}
