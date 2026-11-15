# Demo local: empresas y contactos

Guía para demostrar el flujo real de SUPRA CRM: iniciar sesión, crear una empresa, conservar su ID y agregar contactos desde su ficha. La interfaz está en español. No hay listados globales de empresas o contactos ni pantalla de Reportes.

## Preparar el entorno

- Frontend: runtime aislado **Node 22.20.0**, pnpm **11.25.0** y npm incluido **10.9.3**, con dependencias ya disponibles. El SHA256 del ZIP oficial coincidió con el checksum publicado por HTTPS; esto no es una verificación de firma.
- Backend: repositorio hermano `CRM-BACKEND`, entorno `.venv` existente y base local preparada. Usa una cuenta existente autorizada; no cambies usuarios, contraseñas, Argon ni JWT.
- API: `VITE_API_BASE_URL` debe apuntar al backend local, normalmente `http://localhost:8000`. Es configuración pública, no un lugar para secretos. Consulta el [README](../README.md) para la preparación inicial.

### Backend: conexión IPv4 temporal autorizada

En esta sesión, conectar a la DB por `localhost` tardó **10,094 s**, frente a **19 ms** por `127.0.0.1`. Tras aprobación explícita del usuario se aplicó un override de `SUPRA_DATABASE_URL` **solo al proceso** y se reinició el uvicorn propio. No se cambió la DB ni sus credenciales. La edición protegida de `.env` quedó bloqueada y el archivo permaneció intacto: **no lo leas ni edites, ni recuperes credenciales desde él**.

Con Docker Desktop disponible, inicia únicamente el contenedor **existente**:

```powershell
docker start crm-backend-db-1
```

No recrees la base ni elimines volúmenes. Desde `CRM-BACKEND`, en PowerShell, introduce la **URL local autorizada suministrada por el usuario**, con host `127.0.0.1`, puerto `55432` y base `supra_crm`, conservando el usuario y contraseña existentes. No los escribas en el comando, documento ni capturas. El prompt seguro evita dejarlos en el historial de comandos:

```powershell
$secret = Read-Host 'URL de DB local autorizada (IPv4)' -AsSecureString
$ptr = [IntPtr]::Zero
try {
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    $env:SUPRA_DATABASE_URL = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
} finally {
    if ($ptr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
    $secret.Dispose()
}
.\.venv\Scripts\python.exe -B -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

El valor queda en el entorno de esta terminal y lo hereda su backend, no es un almacén seguro permanente. No lo imprimas. Reaplica el override al arrancar cada backend; al terminar, cierra la terminal. **No uses `setx` ni cambios globales**. Si hay un backend activo, coordina el reinicio de ese proceso propio; no detengas procesos ajenos.

### Frontend: Node 22 aislado

En otra terminal PowerShell, desde `CRM-FRONT`:

```powershell
$nodeDir = (Resolve-Path '../.runtime/node-v22.20.0-win-x64').Path
$env:PATH = "$nodeDir;$env:PATH"
& "$nodeDir/node.exe" node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort
```

El prefijo de `PATH` es solo de este proceso y asegura que los comandos hijos también encuentren Node 22; invocar el ejecutable directamente no basta para fijar sus hijos. No modifica instalaciones globales.

Abre **http://localhost:5173**, no `http://127.0.0.1:5173`: el origen debe coincidir con el CORS permitido. Mantén ambos procesos activos y los puertos libres. Esta guía no cubre despliegues.

## Recorrido de la demo

1. En `/login`, ingresa con la cuenta autorizada. Al autenticarte verás Inicio.
2. Abre **Empresas** (`/empresas`). Completa **Razón social**; nombre comercial e identificación fiscal son opcionales. Usa datos de demostración autorizados y una identificación fiscal no repetida, si la incluyes.
3. Pulsa **Crear empresa**. Si el backend acepta el alta, se abre `/empresas/<ID>` y se consulta su detalle.
4. **Copia el ID y guarda la URL como marcador** antes de continuar. No existe un listado desde el cual recuperar la empresa.
5. En **Agregar contacto**, completa nombre y apellidos, y al menos correo electrónico o teléfono; puesto es opcional. Pulsa **Guardar contacto**.
6. Espera **Contacto guardado. Detalle actualizado.** y comprueba que el contacto aparece en la ficha consultada al servidor.
7. Para reabrirla, usa **Abrir detalle por ID** en Empresas. También puedes ir a `/contactos`, ingresar el **ID de empresa** y pulsar **Abrir contactos**: abre la misma ficha en su sección de contactos, no una lista global.

Las altas escriben en el backend real. No repitas envíos solo para avanzar la presentación: puedes crear datos adicionales.

## Sesión y recuperación

| Situación                                     | Qué hacer o esperar                                                                                                                                                                                                  |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Logout o recarga completa                     | El JWT vive solo en memoria; se pierde intencionalmente. Vuelve a iniciar sesión. Una respuesta 401 también limpia la sesión.                                                                                        |
| Recarga de una ficha o marcador sin sesión    | Se redirige a `/login`; después del login se abre Inicio, no se restaura automáticamente la ficha. Vuelve a abrir el marcador o consulta el ID guardado.                                                             |
| Empresa con identificación fiscal repetida    | El alta puede responder 409. Revisa el dato o abre la empresa existente por su ID.                                                                                                                                   |
| Datos rechazados (422)                        | Revisa los valores ingresados antes de volver a enviar; el mensaje del servidor es genérico, no identifica cada campo.                                                                                               |
| ID inexistente (404)                          | Comprueba el ID; no crees otra empresa para simular una consulta exitosa.                                                                                                                                            |
| Fallo al consultar el detalle                 | Usa **Reintentar**. Es una consulta GET, no otra alta.                                                                                                                                                               |
| Contacto guardado, pero actualización fallida | **No vuelvas a enviarlo.** Usa **Actualizar contactos**: reintenta solo el GET del detalle, no el POST del contacto. La lista anterior puede estar desactualizada y el envío permanece bloqueado hasta actualizarla. |
| Error de conexión o CORS                      | Comprueba procesos, puertos, origen `localhost:5173` y URL de API antes de repetir operaciones.                                                                                                                      |

### Solicitudes que respaldan el recorrido

- Autenticación: `POST /api/v1/auth/login` y `GET /api/v1/users/me`.
- Alta de empresa: `POST /api/v1/companies`.
- Ficha con contactos: `GET /api/v1/companies/{company_id}`.
- Alta de contacto: `POST /api/v1/companies/{company_id}/contacts`, seguida de una nueva consulta de la ficha.

No se simulan endpoints de listado ni se presentan datos ficticios como resultados del servidor.

## Estado de publicación y verificación actual

La rama `feat/expo-demo` reúne el login corporativo responsive, el shell y dashboard,
el alta guiada de empresas en dos pasos, los contactos por empresa y la recuperación
por GET después de un alta aceptada. Los endpoints de asignación administrativa del
backend no tienen una interfaz nueva en esta entrega.

La publicación del frontend fue autorizada expresamente con la verificación actual
inconclusa. En el último intento, las pruebas, TypeScript, ESLint y Vite se ejecutaron
una vez sobre una copia aislada de dependencias pnpm que no resultó relocatable:
Vitest no encontró `@vitest/utils`, ESLint no encontró `debug`, Vite no encontró
`picomatch` y TypeScript informó errores de exports/tipos/MSW. No se instalaron ni
repararon dependencias. Estos resultados no prueban una regresión del frontend o
backend, pero **no permiten declarar el frontend actualmente verificado**.

Los resultados y recorridos descritos debajo son evidencia histórica, no resultados
nuevos de esta publicación. El backend de seguridad se publicó por separado en
`feat/security-foundations`, con 107 pruebas aprobadas de forma independiente y la
migración `20260322_0004`; esa verificación no sustituye una ejecución del frontend.
La publicación no incluye archivos de entorno, credenciales, skills, configuración
local ni tareas internas. No implica despliegue, merge o prueba actual en navegador.

## Calidad y límites de la evidencia histórica

Desde `CRM-FRONT`, en otra terminal PowerShell, fija también el `PATH` antes de los comandos de calidad:

```powershell
$nodeDir = (Resolve-Path '../.runtime/node-v22.20.0-win-x64').Path
$env:PATH = "$nodeDir;$env:PATH"
pnpm typecheck
pnpm lint
pnpm test
pnpm build
& "$nodeDir/node.exe" node_modules/prettier/bin/prettier.cjs --check docs/EXPO_DEMO.md
```

La verificación independiente comunicada pasó **42 tests en 5 archivos**, tipos, lint, build y formato acotado **con Node 22.20.0**, no solo con Node 24. Los tests de comportamiento usan MSW: no prueban por sí solos las altas reales. El binario nativo de verificación no estaba disponible y se usó una vía independiente.

Límites conocidos, sin ampliar el alcance de esta demo:

- `pnpm format:check` sobre todo el repositorio informa actualmente diferencias en **94 archivos**, incluidos assets de skills y archivos fuera de esta entrega. La línea base anterior informó 24; no se atribuye cada diferencia actual a un origen verificado ni se reformatea todo el repositorio.
- La deriva del esquema OpenAPI está pendiente; `pnpm openapi:check` no se presenta como aprobado.
- La línea base del backend comunicada es 39 tests aprobados y 1 fallo relacionado con JWT, diferido; no se presenta como una suite totalmente verde.
- Para T2 se comunicaron 4 fallos RED y luego GREEN observados por su implementador. No hay evidencia RED disponible en el handoff de T3; no se infiere.
- Verificación previa: frontend HTTP 200, `/api/v1/health` HTTP 200 y alta de empresa sin autenticación HTTP 401. En Chrome se comprobó login → empresa → contacto → detalle con respuestas de prueba aisladas: vistas de 375, 768 y 1280 px sin desbordamiento, inputs etiquetados y sin errores de consola. Esto demuestra el frontend, no persistencia real.
- Después del override IPv4 autorizado y reinicio del backend propio, se observó **login real seguro en Chrome: HTTP 200, autenticado, 276 ms**. No se modificaron cuentas, contraseñas ni autenticación para conseguirlo.
- Verificación real independiente completada: una empresa y un contacto creados desde React contra el backend local, sin mocks. Alta de empresa HTTP 201 en 27 ms; alta de contacto HTTP 201 en 20 ms; detalle HTTP 200 en 10–15 ms. Reabrir desde Empresas por ID generó un GET nuevo que confirmó el contacto persistido. Vistas reales de 375 y 1280 px sin desbordamiento.
- Empresa de demostración conservada: **SUPRA Demo Verificada 2026-10-13 z8p0s**, ID `a705e474-d9d5-459a-a318-9faf17468e4f`. Después de iniciar sesión, abre `http://localhost:5173/empresas/a705e474-d9d5-459a-a318-9faf17468e4f`.
- Un segundo contexto de página sin sesión fue redirigido a `/login`. No se repitieron en este recorrido real el ciclo completo logout/recarga/relogin ni una nueva prueba HTTP 401; no se infiere esa evidencia.

## Comprobación final en navegador

- [x] Iniciar sesión desde `localhost:5173` con una cuenta autorizada (login real observado tras override IPv4).
- [x] Crear una empresa, comprobar su detalle y conservar su ID.
- [x] Agregar un contacto y confirmar el resultado de la consulta posterior.
- [x] Reabrir por ID desde Empresas y observar un GET nuevo con el contacto persistido.
- [ ] Repetir manualmente la consulta desde la entrada de Contactos.
- [ ] Cerrar sesión o recargar, autenticar de nuevo y reabrir el marcador manualmente.

Marca estos puntos solo después de observarlos contra el backend local; no los sustituyas por los resultados de MSW.
