# Módulo 7: Contabilidad

No vende ni cobra nada directamente: **registra** en partida doble lo que ya
pasó en POS, Compras, Caja y Créditos, más asientos manuales (ajustes,
gastos administrativos, etc.). No modifica ninguna tabla de los módulos
anteriores.

## Migración

```bash
npx prisma migrate dev --name contabilidad
npx prisma generate
npm run prisma:seed   # crea el plan de cuentas base (ver abajo)
```

## Concepto

- **`CuentaContable`**: plan de cuentas simplificado (jerárquico por
  `cuentaPadreId`). Se siembra un set base en el seed (ver
  `seedPlanDeCuentas()` en `prisma/seed.ts`).
- **`AsientoContable`** + **`AsientoDetalle`**: cabecera y líneas de cada
  movimiento contable. Se valida que `Σdébitos == Σcréditos` antes de
  guardar (tolerancia de 1 centavo por redondeos); si no cuadra, no se
  guarda nada.
- Los asientos **nunca se borran** (trazabilidad). Anular un asiento crea su
  contrapartida exacta (débitos/créditos invertidos) y marca el original
  como `anulado`.

## Cómo lo usan los otros módulos (ya conectado)

`ContabilidadService.registrarAsiento()` está conectado en POS, Caja, Compras
y Créditos, que lo llaman **después** de su propia transacción, resolviendo
cuentas por código (no por UUID, para no acoplar módulos). Cada llamada está
envuelta en `try/catch`: si la generación del asiento falla (ej. la cuenta
no existe, la BD no responde), la operación de negocio YA exitosa (la venta,
el pago, el cierre de caja) **no se revierte** — solo se registra el error
en consola para revisión manual. Esto es intencional: el asiento contable es
un reflejo de algo que ya ocurrió, no debe poder bloquear la operación real.

```ts
// Ejemplo real, dentro de ventas.service.ts, al completar una venta:
await this.contabilidadService.registrarAsiento({
  concepto: `Venta #${venta.numero}`,
  origen: 'venta',
  origenId: venta.id,
  usuarioId,
  detalles: [
    { cuentaCodigo: '1105', debito: cobrado },        // Caja general
    { cuentaCodigo: '1305', debito: pendiente },       // CxC (apartados)
    { cuentaCodigo: '4135', credito: subtotalNeto },   // Ventas
    { cuentaCodigo: '4135', credito: impuesto, descripcion: 'IVA' },
    { cuentaCodigo: '6135', debito: costoTotal },      // Costo de venta
    { cuentaCodigo: '1435', credito: costoTotal },     // Inventario
  ],
});
```

Tabla de qué asiento genera cada evento, y dónde vive el código:

| Módulo / evento | Asiento generado | Archivo |
|---|---|---|
| POS: venta o apartado confirmado (no cotización) | Débito `1105` Caja (y/o `1305` CxC si es apartado con saldo), Crédito `4135` Ventas + IVA, Débito `6135` Costo de venta / Crédito `1435` Inventario | `ventas.service.ts` → `generarAsientoVenta()` |
| POS: anulación de venta | Reversa el asiento de la venta con `anularAsiento()` (contrapartida automática) | `ventas.service.ts` → `reversarAsientoVenta()` |
| POS: devolución parcial | Débito `4135` Ventas / Crédito `1105` Caja (por el monto devuelto) + Débito `1435` Inventario / Crédito `6135` Costo de venta (por el costo de lo devuelto) | `ventas.service.ts` → `generarAsientoDevolucion()` |
| Compras: factura de proveedor registrada | Débito `1435` Inventario, Crédito `2205` CxP proveedores (por el total, IVA capitalizado al costo) | `facturas-compra.service.ts` → `generarAsientoFactura()` |
| Compras: anulación de factura (solo si no tiene pagos) | Reversa el asiento de la factura con `anularAsiento()` | `facturas-compra.service.ts` → `reversarAsientoFactura()` |
| Compras: pago a proveedor | Débito `2205` CxP, Crédito `1105` Caja (efectivo) o `1110` Bancos (otros métodos) | `facturas-compra.service.ts` → `generarAsientoPago()` |
| Caja: cierre con diferencia | Sobrante: Débito `1105` Caja / Crédito `5195`. Faltante: Débito `5195` / Crédito `1105`. Caja cuadrada no genera asiento. | `caja.service.ts` → `generarAsientoDiferencia()` |
| Créditos: abono de cliente | Débito `1105` Caja, Crédito `1305` CxC (porción de capital) + Crédito `4210` Ingresos financieros (porción de interés, prorrateada por cuota) | `creditos.service.ts` → `generarAsientoAbono()` |

**Qué NO quedó conectado** (fuera del alcance original, se puede agregar
después con el mismo patrón):
- Devoluciones a proveedor (`devoluciones-compra.service.ts`).
- Aprobación/anulación de órdenes de compra (no son un hecho contable en sí
  mismas — el hecho contable es la factura, no la orden).
- Refinanciación de créditos (el CxC se traslada al nuevo crédito, pero no
  se generó un asiento específico para ese traspaso).

## Endpoints

### Plan de cuentas — `/api/contabilidad/cuentas`

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/` | — | Lista, filtro `?soloActivas=true` |
| GET | `/:id` | — | Detalle |
| POST | `/` | `contabilidad.crear` | Crear cuenta (código único) |
| PATCH | `/:id` | `contabilidad.editar` | Editar nombre / activar-desactivar |

### Asientos — `/api/contabilidad/asientos`

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/` | — | Lista, filtros `?origen=&desde=&hasta=` |
| GET | `/:id` | — | Detalle con líneas |
| POST | `/` | `contabilidad.crear` | Asiento manual (valida partida doble) |
| POST | `/:id/anular` | `contabilidad.eliminar` | Anula generando la contrapartida |

### Reportes

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/api/contabilidad/libro-diario` | `contabilidad.exportar` | Todos los asientos, orden cronológico, filtros `?desde=&hasta=` |
| GET | `/api/contabilidad/balance-comprobacion` | `contabilidad.exportar` | Sumas y saldos por cuenta (solo asientos activos) |
| GET | `/api/contabilidad/estado-resultados` | `contabilidad.exportar` | Ingresos − costos − gastos del período, con utilidad bruta y neta |

## Pendiente / próximos pasos

- Períodos contables / cierre mensual (bloquear edición de fechas pasadas).
- Ampliar el plan de cuentas según necesidad real del negocio (el seed trae
  solo lo mínimo para que los asientos automáticos de arriba funcionen).
- Considerar una cuenta de IVA descontable/por pagar separada en vez de
  capitalizar el impuesto directamente a Inventario/Ventas (simplificación
  actual, documentada arriba en cada evento).
- Ver la sección "Qué NO quedó conectado" arriba para los eventos que se
  dejaron fuera de esta primera conexión.
