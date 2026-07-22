# ERP Comercial — Frontend

React + TypeScript + Vite + Tailwind + componentes estilo shadcn/ui (escritos
a mano con Radix primitives, sin depender del registry externo de shadcn).

## Setup

```bash
npm install
cp .env.example .env   # ajustar VITE_API_URL si el backend no corre en localhost:3000
npm run dev            # http://localhost:5173
```

Requiere que el backend (`erp-backend-modulos-1-a-9`) esté corriendo y
accesible en la URL de `VITE_API_URL`.

## Estado real

| Pantalla | Estado |
|---|---|
| Login | ✅ Funcional — JWT, refresh automático, restaura sesión con `/auth/me` |
| Dashboard | ✅ Funcional — consume `/dashboard/resumen` |
| Inventario, POS, Clientes, Créditos, Compras, Caja, Contabilidad, Auditoría, Usuarios | ⬜ Placeholder — la ruta y el link del sidebar ya existen, falta la pantalla real |

## Arquitectura

- **`src/lib/api.ts`** — instancia de axios. Adjunta el `Bearer` token a cada
  request. Si una respuesta da `401`, intenta refrescar el access token UNA
  vez con el refresh token guardado y reintenta la petición original; si el
  refresh también falla, limpia la sesión y redirige a `/login`.
- **`src/lib/auth-context.tsx`** — `AuthProvider`/`useAuth()`. Al montar,
  si hay un refresh token guardado, valida la sesión contra `GET /auth/me`
  (trae rol/permisos frescos, no lo cacheado del login). Expone
  `tienePermiso(modulo, accion)` con el mismo atajo que el backend
  (`Administrador` siempre pasa).
- **`src/lib/storage.ts`** — único punto que toca `localStorage` (access
  token, refresh token, usuario). Nada más en el proyecto debe llamar a
  `localStorage` directamente.
- **`src/components/ui/`** — componentes base estilo shadcn (Button, Card,
  Input, Badge, Avatar, DropdownMenu, Separator, Skeleton), escritos a mano
  sobre Radix + `class-variance-authority`. Se pueden seguir agregando con
  el mismo patrón (ver cualquiera de los archivos existentes como plantilla).
- **`src/components/layout/`** — `Sidebar` (nav de los 9 módulos, filtra
  Auditoría/Usuarios por permiso), `Topbar` (menú de usuario, logout),
  `AppLayout` (shell con `<Outlet />`).
- **`src/App.tsx`** — todas las rutas de los 9 módulos ya están registradas;
  las que aún no tienen pantalla real muestran `<PlaceholderPage />`. Para
  construir un módulo nuevo: reemplazar esa entrada en `MODULOS_PENDIENTES`
  por una ruta con la pantalla real.

## Identidad visual

- **Paleta**: primario azul-marino (`--primary`), acento ámbar (`--accent`,
  evoca caja/efectivo), fondo neutro frío. Tokens en `src/index.css`.
- **Tipografía**: Inter para UI. **Todas las cifras monetarias usan la clase
  `.figure`** (JetBrains Mono, números tabulares) — es el detalle de
  identidad del proyecto, como una cinta de caja registradora. Úsala en
  cualquier pantalla nueva que muestre montos, cantidades o totales.
- Helpers de formato en `src/lib/utils.ts`: `formatoMoneda()`,
  `formatoFecha()`, `formatoFechaHora()`. La moneda usa símbolo genérico
  `$` (no se asume un país/moneda específico — cambiar en un solo lugar
  si el negocio usa otra).

## Cambios que requirió en el backend

Se agregaron dos cosas pequeñas al backend para que el frontend pudiera
manejar sesión correctamente (ver `src/auth/` en el backend):
- `GET /api/auth/me` — nuevo endpoint, devuelve el usuario actual (id,
  nombre, email, rol, permisos) a partir del JWT. Antes no existía forma
  de restaurar la sesión tras un refresh de página sin volver a pedir
  credenciales.
- `POST /api/auth/login` ahora incluye `permisos` en `usuario` (antes solo
  mandaba `rol`) — ya se cargaban en la consulta, solo faltaba incluirlos
  en la respuesta.

## Próximos pasos sugeridos

1. Construir POS (el módulo más usado) — reemplaza el placeholder en
   `/pos`. Requiere: catálogo de productos con búsqueda, carrito, selección
   de método de pago, impresión/visualización de recibo.
2. Inventario — listado de productos con las alertas que ya expone
   `ProductosService` (stock bajo, agotados, próximos a vencer).
3. El resto de módulos, en el orden que tenga más sentido para el negocio.
