# Módulo 9: Auditoría — Parte 1 (consulta)

**Solo lectura.** No crea tablas nuevas — la tabla `Bitacora` ya existía
(creada en el módulo 1, Auth+Usuarios). Este módulo solo agrega los
endpoints para **consultarla**; no cambia cómo ni cuándo se escribe.

# Módulo 9: Auditoría — Parte 1 (consulta) + Parte 2 (escritura)

**Parte 1 — solo lectura.** No crea tablas nuevas — la tabla `Bitacora` ya
existía (creada en el módulo 1, Auth+Usuarios). Este módulo solo agrega los
endpoints para **consultarla**; no cambia cómo ni cuándo se escribe.

**Parte 2 — escritura instrumentada (completa).** Los 7 módulos que
faltaban ahora escriben en la bitácora a través de un servicio centralizado
`BitacoraService` (`src/shared/bitacora.service.ts`), en vez de repetir
`prisma.bitacora.create(...)` en cada uno.

No requiere migración de schema (`Bitacora` ya existía). Sí requiere volver
a correr el seed de permisos (ver abajo) si aún no se hizo en la Parte 1.

## Estado real de quién escribe en la bitácora hoy

| Módulo | ¿Escribe en Bitacora? | Eventos registrados |
|---|---|---|
| Auth (login) | ✅ Sí (directo, sin cambios) | login |
| Usuarios (crear/editar/eliminar/cambiar rol) | ✅ Sí (directo, sin cambios) | crear, editar, eliminar, cambio_password |
| Inventario | ✅ Sí (vía `BitacoraService`) | entrada, salida, ajuste_positivo, ajuste_negativo, transferencia — instrumentado en el punto único `MovimientosService.registrar()`, por lo que cubre automáticamente los movimientos que originan POS, Compras (recepciones/devoluciones) y ajustes manuales, sin duplicar la escritura en cada módulo llamador |
| POS | ✅ Sí (vía `BitacoraService`) | crear (venta/apartado/cotización), anular, crear_devolucion |
| Caja | ✅ Sí (vía `BitacoraService`) | abrir_caja, cerrar_caja |
| Clientes | ✅ Sí (vía `BitacoraService`) | cambiar_clasificacion (incluye los cambios automáticos que dispara Créditos por mora/saldado, con `usuarioId` nulo en ese caso) |
| Créditos | ✅ Sí (vía `BitacoraService`) | aprobar, rechazar, refinanciar |
| Compras | ✅ Sí (vía `BitacoraService`) | aprobar (orden), anular_orden, anular_factura, pagar |
| Contabilidad | ✅ Sí (vía `BitacoraService`) | anular_asiento |

Nota: Auth y Usuarios se dejaron sin tocar a propósito (código ya probado en
producción) — solo se instrumentaron los 7 módulos que faltaban, siguiendo
el mismo criterio de la Parte 1 de no tocar todo de una vez.

## Migración de permisos

Se agregó `'auditoria'` a la lista de módulos del sistema en `prisma/seed.ts`.
Vuelve a correr:

```bash
npm run prisma:seed
```

Esto le da acceso a `auditoria` con permiso `exportar` a **Administrador** y
**Gerente** únicamente (los demás roles no lo tienen — los logs de
actividad son sensibles, no es un módulo de consulta general). Si ya tienes
usuarios con rol Administrador/Gerente creados, no necesitas hacer nada más;
el seed solo actualiza la matriz de permisos por rol, no usuarios.

## Endpoints

Todos requieren permiso `auditoria.exportar` (por defecto: Admin, Gerente).

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/auditoria` | Lista con filtros `?usuarioId=&modulo=&accion=&desde=&hasta=&limite=` (por defecto trae los 100 más recientes) |
| GET | `/api/auditoria/resumen` | Cuenta cuántos registros hay por módulo en el rango |
| GET | `/api/auditoria/usuario/:usuarioId` | Actividad de un usuario específico |
| GET | `/api/auditoria/entidad/:modulo/:entidadId` | Historial de una entidad puntual (ej. quién tocó una venta, un crédito, un asiento o un movimiento de inventario específico) |
| GET | `/api/auditoria/:id` | Detalle de un registro puntual |

## BitacoraService (nuevo, `src/shared/bitacora.service.ts`)

Punto único de escritura para los módulos instrumentados en la Parte 2:

```ts
// Inyectar en el service que necesite dejar rastro:
constructor(private readonly bitacoraService: BitacoraService) {}

await this.bitacoraService.registrar({
  usuarioId, // opcional: undefined para acciones automáticas del sistema (ej. cron de mora)
  accion: 'aprobar',
  modulo: 'creditos',
  entidadId: credito.id,
  detalle: { montoTotal: credito.montoTotal },
});
```

Cada módulo que lo usa lo agrega a sus propios `providers` en el `.module.ts`
(mismo patrón que ya se usa con `PrismaService` en este proyecto — no hay un
`SharedModule` global, cada módulo declara sus propias dependencias).

Auth y Usuarios NO se migraron a este servicio (se dejó su
`prisma.bitacora.create(...)` directo tal cual, para no tocar código ya
probado). Si en algún momento se quiere una consistencia total, es un
cambio de bajo riesgo: reemplazar esas dos llamadas por
`this.bitacoraService.registrar(...)`.

## Cambios de firma que requirió la instrumentación

Estos métodos ahora reciben `usuarioId` (antes no lo necesitaban):

- `ClientesService.clasificar(id, clasificacion, usuarioId?)` — opcional,
  porque Créditos lo llama automáticamente sin actor humano.
- `CreditosService.rechazar(id, motivo, usuarioId)`
- `OrdenesCompraService.anular(id, usuarioId, motivo?)` — **el orden de
  parámetros cambió** (antes era `anular(id, motivo?)`).
- `FacturasCompraService.anular(id, usuarioId)`

Los controllers correspondientes ya se actualizaron para pasar
`actor.id` (vía el decorator `@UsuarioActual()`) en cada caso.

