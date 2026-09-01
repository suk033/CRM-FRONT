# SuPra CRM — Handoff React + TypeScript

## Arquitectura preservada
Login → Dashboard → Empresas/Contactos → Requerimiento → Matching → Proposal → Actividad/Visita → Negociación → Cierre/Rechazo.

Entidades separadas:
- Company
- Contact
- Requirement
- Property
- Proposal
- ProposalCandidate
- Activity
- Visit
- Operation

La relación Requirement–Property debe materializarse mediante ProposalCandidate dentro de una Proposal.

## Tokens
- Primary navy: `#17324D`
- Accent teal: `#1F6B61`
- Background: `#F6F7F4`
- Surface: `#FFFFFF`
- Text: `#172126`
- Muted: `#66737A`
- Border: `#D9E0DC`
- Success: `#2F7D57`
- Warning: `#A66B12`
- Error: `#B64848`
- Info: `#2D6FA3`
- Radius: 8 / 12 / 16 px
- Spacing: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 px
- Font: Inter; fallback system sans
- Min target interactivo: 44 px

## Componentes sugeridos
- `AppShell`
- `Sidebar`
- `Header`
- `Breadcrumbs`
- `PageHeader`
- `Button`
- `IconButton`
- `StatusBadge`
- `SearchInput`
- `FiltersBar`
- `DataTable`
- `MobileCardList`
- `Pagination`
- `SummaryCard`
- `FormSection`
- `Field`
- `InlineValidation`
- `Alert`
- `Toast`
- `ConfirmModal`
- `Timeline`
- `CalendarWeek`
- `KanbanPipeline`
- `PropertyMatchCard`
- `PropertyCompareGrid`
- `StateView`

## Variantes
`Button`: primary | secondary | destructive | ghost; states default | hover | focus | disabled | loading.

`StatusBadge`: success | warning | danger | info | neutral, siempre con texto y opcionalmente ícono.

`StateView`: loading | empty | error | validation | success | forbidden.

## Tipado recomendado
Usar unions/enum tipados para estados, no strings libres.

```ts
type RequirementStatus =
  | "draft"
  | "active"
  | "matching"
  | "proposal"
  | "visit"
  | "negotiation"
  | "closed"
  | "rejected";

type PropertyAvailability =
  | "available"
  | "pending_verification"
  | "unavailable";

type OperationStage =
  | "requirement"
  | "proposal"
  | "visit"
  | "negotiation"
  | "closed";
```

## Responsive
Breakpoints de referencia:
- 1440 px: desktop principal
- 1024 px: desktop compacto
- 768 px: tablet
- 390 px: móvil

Reglas:
- Sidebar se vuelve drawer por debajo de tablet.
- Tablas complejas cambian a cards resumidas en 768/390.
- Pipeline mantiene scroll horizontal.
- Acciones críticas nunca se ocultan.
- Formularios pasan de 3 columnas → 2 → 1.
- Matching pasa de panel sticky + cards a una sola columna.

## Accesibilidad
- Contraste objetivo WCAG AA.
- `:focus-visible` persistente.
- Labels no dependen de placeholder.
- Mensajes de error junto al campo.
- `aria-live` para toasts.
- `role="dialog"` + `aria-modal` en modales/drawers.
- Escape cierra modal/drawers.
- No bloquear pegado en contraseña.
- Respetar `prefers-reduced-motion`.
- Targets mínimos de 44 px.

## Reglas de negocio UX
- Mostrar responsable, fecha, estado y próxima acción en vistas operativas.
- Matching es explicable: coincidencias, diferencias y datos faltantes.
- El puntaje no decide por el asesor.
- Confirmación humana antes de enviar propuesta o cerrar operación.
- Rechazo requiere motivo.
- No incluir ERP, facturación, multi-tenancy ni automatizaciones autónomas.
