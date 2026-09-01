# Frontend de SUPRA CRM

La Fase 2 incorpora autenticación JWT almacenada únicamente en memoria: inicio de sesión en español, shell protegido, visualización del usuario actual, solicitudes Bearer y limpieza de sesión ante logout o respuestas 401. Los flujos de empresas y contactos quedan intencionalmente pendientes. `Prototipo/` contiene referencias de diseño y no forma parte de la aplicación ejecutable.

## Inicio

1. Copiá `env.example` como `.env.local`.
2. Configurá `VITE_API_BASE_URL` con el origen del backend; esta variable no debe contener secretos.
3. Ejecutá `pnpm install --frozen-lockfile` y `pnpm dev`.

## Calidad

Ejecutá `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` y `pnpm openapi:check`.

La instantánea de OpenAPI se encuentra en `src/api/openapi.json` y su esquema TypeScript generado en `src/api/schema.ts`. Después de reemplazar la instantánea, ejecutá `pnpm openapi:generate` y luego `pnpm openapi:check` para comprobar que no exista deriva del contrato.

## Contenedor

Construí la imagen con `docker build -t supra-crm-front .` y ejecutala con `docker run --rm -p 8080:80 supra-crm-front`. Nginx sirve la compilación de Vite y utiliza `index.html` como fallback para las rutas de la SPA.
