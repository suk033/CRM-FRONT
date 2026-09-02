# SuPra CRM release roadmap

Esta guía es la referencia de avance compartida entre `CRM-BACKEND` y `CRM-FRONT`. El contrato OpenAPI generado por el backend sigue siendo la fuente de verdad para las integraciones HTTP.

## Estado actual

El proyecto está en etapa `v0.1.0-alpha`: es apto para una demostración interna o académica, pero no para una instalación de cliente en producción.

### Integrado en el backend

- Foundation con FastAPI, PostgreSQL, Alembic, Docker y CI.
- Autenticación JWT Bearer, roles `admin` y `advisor`, y bootstrap interactivo del primer administrador.
- Companies y Contacts: crear empresa, crear contacto y consultar empresa con contactos.

### Integrado en el frontend

- Inicio de sesión con token sólo en memoria.
- Shell protegido con usuario actual, rol y cierre de sesión.
- Cliente HTTP tipado a partir de la instantánea OpenAPI.

### Pull requests pendientes

1. Backend: [`feat/company-list-api`](https://github.com/suk033/CRM-BACKEND/pull/new/feat/company-list-api)
   - Añade `GET /api/v1/companies` con búsqueda, paginación y total.
2. Frontend: [`feat/companies-contacts-ui`](https://github.com/suk033/CRM-FRONT/pull/new/feat/companies-contacts-ui)
   - Añade listado, búsqueda, alta y detalle de empresas, además de alta de contactos.

Orden de integración:

1. Revisar y fusionar el PR backend.
2. Actualizar la instantánea OpenAPI del frontend contra `main` del backend y comprobar que no haya deriva.
3. Revisar y fusionar el PR frontend.
4. Ejecutar una prueba manual: bootstrap admin, login, crear empresa y crear contacto.

## Hitos de release

### v0.1.0-alpha

Objetivo: foundation y primer flujo comercial mínimo.

- Autenticación y roles.
- Companies y Contacts.
- Primera vista funcional del CRM.
- Pruebas, OpenAPI y CI.

### v0.2.0

Objetivo: registrar la necesidad inmobiliaria de cada cliente corporativo.

- Requirements asociados a Company y, si aplica, Contact.
- Tipo de propiedad, operación, zona, presupuesto, superficie, fecha objetivo, estado y observaciones.
- Listado y alta desde el detalle de la empresa.

### v0.3.0

Objetivo: administrar la oferta inmobiliaria disponible.

- Owners.
- Properties.
- Estados comerciales y documentales básicos.

### v0.4.0-beta

Objetivo: completar el flujo operativo manual y explicable.

- Matching por reglas transparentes.
- Propuestas y candidatos.
- Actividades, visitas, negociación y operaciones.
- Audit trail de los vínculos comerciales importantes.

### v1.0.0

Objetivo: primera versión operativa validada para instalación de cliente.

- Flujo CRM completo validado de punta a punta.
- Gestión de usuarios, auditoría, backup/restore y despliegue documentado.
- Seguridad operativa y observabilidad acordadas.
- Pruebas de integración entre frontend, backend y PostgreSQL.

## Machine learning

Machine learning no bloquea los releases operativos. Se habilita después de consolidar el flujo manual y obtener datos reales, validados y balanceados.

Antes de considerar ML deben existir:

- Reglas de matching transparentes como baseline.
- Feedback estructurado sobre candidatos aceptados o rechazados.
- Evidencia de propuestas, visitas, negociación y resultado de operación.
- Evaluación contra el baseline y aprobación humana obligatoria.

## Principios de trabajo

- Un issue y una rama por unidad acotada.
- PR con criterios de aceptación y evidencia de pruebas.
- OpenAPI generado por el backend como contrato único.
- No iniciar Properties, Matching, Proposals o ML antes de completar el hito anterior.
- No mezclar cambios de foundation, Docker o configuración compartida con módulos de dominio sin asignar un único responsable.
