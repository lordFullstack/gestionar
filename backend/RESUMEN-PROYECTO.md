# ERP Comercial (single store) — Resumen para continuar en otro chat

**Stack:** NestJS + TypeScript + Prisma + PostgreSQL (Supabase). Arquitectura
modular por eventos, cada módulo desacoplado, exportando su service para
que el siguiente lo reutilice (no hay lógica duplicada).

**Fecha de este corte:** 20 de julio de 2026.

## Infraestructura ya funcionando

- Base de datos: proyecto Supabase **`erp-comercial`** (`huknbjogifkblytwmqlx`),
  región `us-east-1`.
- Conexión vía **connection pooler** (no la directa — la directa es IPv6 y
  falla en muchas conexiones domésticas):
  - `DATABASE_URL` → pooler puerto **6543** (`?pgbouncer=true`) para runtime.
  - `DIRECT_URL` → pooler puerto **5432** (session mode) para migraciones.
  - Host: `aws-0-us-east-1.pooler.supabase.com`, usuario `postgres.huknbjogifkblytwmqlx`.
- ⚠️ Nota de seguridad: la contraseña de esa base de datos se compartió en
  el chat anterior — **conviene resetearla** desde el dashboard de Supabase
  (Settings → Database → Reset password) antes de seguir usando el proyecto
  en un contexto compartido.
- **RIFATECH quedó pausado** en Supabase para liberar espacio en el free
  tier (2 proyectos activos máx.). Reactivarlo cuando se retome ese
  proyecto (Settings → General → Restore, o similar).
- Usuario admin del seed: `admin@almacen.local` / `CambiarEsta123!`
  (cambiar en el primer login real).
- Login vía Thunder Client (extensión gratis de VS Code) — el usuario no
  tiene Postman. Token JWT dura 1 hora.

## Módulos — estado real

| # | Módulo | Estado |
|---|---|---|
| 1 | Auth + Usuarios/Roles | ✅ Completo. Bitácora de auditoría solo aquí escribe hoy (login, CRUD usuarios). |
| 2 | Inventario | ✅ Completo. `ProductosService` ya expone `productosStockBajo()`, `productosAgotados()`, `productosProximosAVencer()` — pensados para ser reusados (y ya se reusan en Dashboard). |
| 3 | POS + Caja | ✅ Completo. |
| 4 | Clientes | ✅ Completo. |
| 5 | Créditos | ✅ Completo. |
| 6 | Compras | ✅ Completo. |
| 7 | **Contabilidad** | ✅ Completo — plan de cuentas + asientos manuales (partida doble validada) + reportes (libro diario, balance de comprobación, estado de resultados). **La generación automática de asientos YA está conectada** a POS (venta/anulación/devolución), Compras (factura/pago/anulación de factura), Caja (diferencias en cierre) y Créditos (abonos) — cada llamada envuelta en try/catch para no bloquear la operación de negocio si falla. Detalle completo en `src/contabilidad/README.md`. |
| 8 | **Dashboard + Informes** | ✅ Completo (fases 1 y 2) — `/dashboard/resumen`, `/informes/ventas`, `/informes/inventario`, `/informes/cartera`, `/informes/compras`, `/informes/caja`. Sin tablas propias, solo compone datos de los otros módulos. |
| 9 | **Auditoría** | ✅ Completo (Parte 1 + Parte 2). Parte 1: endpoints de CONSULTA (`/auditoria`, `/auditoria/resumen`, `/auditoria/usuario/:id`, `/auditoria/entidad/:modulo/:id`). Parte 2: Inventario, POS, Caja, Clientes, Créditos, Compras y Contabilidad ahora escriben en la bitácora vía `BitacoraService` centralizado (`src/shared/bitacora.service.ts`). Auth/Usuarios se dejaron con su escritura directa original (código ya probado, no se tocó). Documentado en `src/auditoria/README.md`. |
| 10 | Frontend (React) | 🟡 Iniciado — Vite+TS+Tailwind+componentes estilo shadcn. Login y Dashboard funcionales (JWT, refresh automático, `/auth/me`). Sidebar con los 9 módulos ya enrutados; 8 aún son placeholders. Ver `erp-frontend/README.md`. Requirió 2 cambios chicos en el backend: `GET /auth/me` (nuevo) y `permisos` agregado a la respuesta de login. |

| 11 | Zip final organizado para despliegue | ⬜ Pendiente (este zip es un snapshot de desarrollo, no el empaquetado final de producción). |

## Decisiones de diseño clave (heredadas + nuevas)

- `sucursalId` fijo en 1 en todas las tablas — listo para multi-sucursal sin
  rediseño.
- Interés de créditos es flat simplificado (documentado dónde cambiarlo).
- La orquestación POS→Inventario→Caja cruza módulos sin transacción única
  de BD (limitación conocida, documentada, con plan de mitigación futura).
- **Contabilidad**: nunca se borran asientos (trazabilidad) — anular crea
  la contrapartida exacta y marca el original como `anulado`. Partida doble
  validada con tolerancia de 1 centavo por redondeos.
- **Auditoría**: acceso restringido — solo roles Administrador y Gerente
  tienen permiso `auditoria.exportar` por defecto (los logs de actividad
  son sensibles, no es un módulo de consulta general).

## Errores ya resueltos en este proyecto (por si se repiten)

1. Faltaban `tsconfig.json`/`nest-cli.json` en la raíz — **ya incluidos en
   este zip**.
2. Al `schema.prisma` le faltaba la relación explícita `producto` en
   `VentaItem` (y su contraparte `ventaItems` en `Producto`) — ya corregido.
3. Conexión directa a Supabase (`db.xxx.supabase.co:5432`) falla por IPv6 en
   muchas redes — usar el connection pooler (ver arriba).
4. **Cuidado al registrar módulos nuevos en `src/app.module.ts`**: en dos
   ocasiones distintas el import o la entrada en el arreglo `imports`
   quedó comentada por error (`// ContabilidadModule...`) en vez de
   agregada de verdad — causaba `404 Not Found` silencioso sin error de
   compilación. Siempre confirmar visualmente el archivo completo después
   de editarlo.
5. Puerto 3000 ocupado por una instancia vieja de `start:dev` — cerrar
   todas las terminales de Node antes de reiniciar.

## Próximos pasos sugeridos (en orden de impacto)

1. Seguir el Frontend — construir POS (el módulo más usado), luego
   Inventario, y el resto de módulos. Ver "Próximos pasos sugeridos" en
   `erp-frontend/README.md`.
2. Zip final organizado para despliegue (módulo 11) — al cerrar todo lo
   anterior.
