import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import {
  api,
  getAccessToken,
  onAuthCleared,
  setAccessToken,
} from "../../api/client";
import { Shell } from "../../layout/Shell";

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
    client.removeQueries({ queryKey: userKey });
  };
  if (!token) return <Navigate to="/login" replace />;
  if (user.isPending)
    return <main className="loading-page">Cargando sesión…</main>;
  if (user.isError || !user.data) return <Navigate to="/login" replace />;
  return (
    <Shell user={user.data} onLogout={logout}>
      <Outlet />
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
      <form
        className="login-card"
        onSubmit={(event) => {
          event.preventDefault();
          setError(false);
          const form = new FormData(event.currentTarget);
          login.mutate({
            email: String(form.get("email")),
            password: String(form.get("password")),
          });
        }}
        aria-labelledby="login-title"
      >
        <p className="eyebrow">SUPRA CRM</p>
        <h1 id="login-title">Iniciar sesión</h1>
        <label>
          Correo electrónico
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Contraseña
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <p role="alert">
            No fue posible iniciar sesión. Verifica tus datos e inténtalo de
            nuevo.
          </p>
        )}
        <button type="submit" disabled={login.isPending}>
          {login.isPending ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </main>
  );
}
