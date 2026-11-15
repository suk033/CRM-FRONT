# Frontend de SUPRA CRM

La Fase 2 incorpora autenticación JWT almacenada únicamente en memoria: inicio de sesión en español, shell protegido, visualización del usuario actual, solicitudes Bearer y limpieza de sesión ante logout o respuestas 401. Los flujos de empresas y contactos quedan intencionalmente pendientes. `Prototipo/` contiene referencias de diseño y no forma parte de la aplicación ejecutable.

## Módulos inmobiliarios (Fase 3)

- `/` (Inicio): pendientes del asesor agrupados en vencidas, hoy y próximas (completar con un clic), KPIs, alta rápida de actividades, empresas que requieren atención y actividades completadas. El administrador ve el trabajo del equipo.
- `/empresas`: cartera con filtro Activas (por defecto), Inactivas y Todas, búsqueda por nombre o RUC, asesor, requerimientos abiertos, actividades pendientes y vencidas, próxima y última actividad. `/empresas/nueva` crea una empresa.
- `/empresas/:id`: espacio de la empresa con pestañas Resumen, Requerimientos (listado y alta), Actividades (agenda y seguimiento) y Contactos (`?tab=`).
- `/requerimientos/:id`: ranking de candidatos por reglas (y probabilidad del modelo cuando existe), desglose por criterio, decisiones (preseleccionar, aceptar, rechazar con motivo), propuesta optimizada con Hill Climbing y ruta de visitas BFS vs A*.
- `/inmuebles`: inventario (Disponible por defecto) con filtros e importación desde la plantilla CSV; si una fila es inválida no se importa nada y se muestran los errores por fila. `/inmuebles/:id` muestra el inmueble y las empresas cuyos requerimientos abiertos hacen match, ordenadas por el modelo o por reglas, con brechas y decisión previa.
- `/perfil`: cuenta del usuario. El asesor ve su resumen; el administrador además ve el rendimiento de los asesores y las actividades del equipo, gestiona usuarios (crear, activar/desactivar, cambiar rol, con confirmación), reasigna empresas a asesores y entrena el modelo (`?seccion=rendimiento|equipo|usuarios|asignacion|modelo`). Las rutas anteriores `/requerimientos`, `/contactos` y `/aprendizaje` redirigen a Empresas o Perfil.
- Interfaz: desplegables, selector de archivo, confirmaciones y avisos propios (sin los controles ni mensajes nativos del navegador), validación en la página y modo claro/noche (botón en la barra superior; la elección se recuerda en el navegador).

## Inicio

1. Copiá `env.example` como `.env.local`.
2. Configurá `VITE_API_BASE_URL` con el origen del backend; esta variable no debe contener secretos.
3. Activá el pnpm fijado por el proyecto con `corepack enable`.
4. Ejecutá `pnpm install --frozen-lockfile` y `pnpm dev`.

## Calidad

Ejecutá `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` y `pnpm openapi:check`.

La instantánea de OpenAPI se encuentra en `src/api/openapi.json` y su esquema TypeScript generado en `src/api/schema.ts`. Después de reemplazar la instantánea, ejecutá `pnpm openapi:generate` y luego `pnpm openapi:check` para comprobar que no exista deriva del contrato.

## Contenedor

Construí la imagen con `docker build -t supra-crm-front .` y ejecutala con `docker run --rm -p 8080:80 supra-crm-front`. Nginx sirve la compilación de Vite y utiliza `index.html` como fallback para las rutas de la SPA.
