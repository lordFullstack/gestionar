# Módulo 3: POS + Caja

Se agrega sobre los Módulos 1 y 2 sin modificar código existente. Se sumó
también un modelo mínimo `Cliente` (id, nombre, teléfono) para poder asociar
ventas a clientes desde ya — el Módulo 4 lo expandirá con historial,
direcciones, documentos, etc. sin romper esta tabla base.

## Migración

```bash
npx prisma migrate dev --name pos_caja
```

## Flujo operativo

1. El cajero abre caja: `POST /api/caja/abrir` con `montoInicial`.
2. Registra ventas: `POST /api/pos/ventas`.
3. Al final del turno: `POST /api/caja/cerrar` con el conteo físico — el sistema calcula la diferencia (sobrante/faltante) automáticamente.

## Endpoints — Caja (`/api/caja`)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/abrir` | Abre turno de caja (falla si ya tiene una abierta) |
| GET | `/actual` | Caja abierta del usuario actual, con sus movimientos |
| GET | `/arqueo` | Total acumulado agrupado por método de pago |
| POST | `/movimiento` | Ingreso o egreso manual (ej. pago a proveedor en efectivo) |
| POST | `/cerrar` | Cierra con arqueo: compara declarado vs. calculado por sistema |
| GET | `/historial` | Historial de cajas cerradas, con filtro de fechas |

## Endpoints — POS (`/api/pos/ventas`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Lista ventas, filtro `?estado=&desde=&hasta=` |
| GET | `/:id` | Detalle completo con items, pagos, devoluciones |
| GET | `/:id/reimprimir` | Datos del recibo para reimpresión |
| POST | `/` | Crea venta / cotización / apartado (campo `tipo`) |
| POST | `/:id/abonar` | Agrega un abono a un apartado existente |
| POST | `/:id/convertir` | Convierte una cotización en venta real (descuenta stock) |
| POST | `/:id/anular` | Anula la venta: revierte stock y reembolsa en caja |
| POST | `/devoluciones` | Devuelve items de una venta completada (parcial o total) |

### Tipos de venta (`tipo`)

- **`venta`** (por defecto): descuenta stock al instante, exige que los pagos cubran el total. Soporta pago mixto (ej. mitad efectivo, mitad tarjeta) en un solo array `pagos`.
- **`cotizacion`**: no descuenta stock ni exige pago. Se convierte a venta real después con `/:id/convertir`.
- **`apartado`**: descuenta y **reserva** stock al crearla, acepta un abono inicial parcial. Se completa con `/:id/abonar` hasta cubrir el total.

### Ejemplo: venta con pago mixto

```json
POST /api/pos/ventas
{
  "ubicacionId": "<id-ubicacion>",
  "items": [
    { "productoId": "<id>", "cantidad": 2, "precioUnitario": 1.80, "descuento": 0.20 }
  ],
  "pagos": [
    { "metodo": "efectivo", "monto": 2.00 },
    { "metodo": "tarjeta", "monto": 1.40, "referencia": "AUTH-8841" }
  ]
}
```

## Decisiones de diseño relevantes

- **Compensación automática de stock**: si al descontar stock de un ítem falla (por ejemplo, otro cajero vendió lo último un segundo antes), el sistema revierte automáticamente los ítems ya descontados de esa misma venta y la marca `anulada`, en vez de dejar stock fantasma.
- **`Venta.ubicacionId` se guarda en la venta**: así, al anular, el sistema sabe exactamente a qué ubicación devolver el stock sin pedirlo de nuevo.
- **Devoluciones parciales**: cada `VentaItem` lleva `cantidadDevuelta`, así que se puede devolver 1 de 3 unidades vendidas sin perder el rastro de cuánto queda disponible para devolver.
- **Todo pago que pasa por caja genera un `MovimientoCaja`**: el arqueo de cierre siempre cuadra automáticamente contra estos movimientos, no contra las ventas directamente — así ingresos/egresos manuales también entran en el cálculo.

## Checklist de estabilidad antes del Módulo 4 (Clientes)

- [ ] No se puede abrir una segunda caja si ya hay una abierta para ese usuario.
- [ ] Una venta tipo `venta` sin pagos suficientes devuelve 400 y no descuenta stock.
- [ ] Una venta exitosa descuenta stock, crea pagos y genera movimientos de caja coherentes.
- [ ] Vender más cantidad de la disponible revierte automáticamente y responde 400.
- [ ] Anular una venta completada devuelve el stock a la ubicación original y genera egreso en caja.
- [ ] Una devolución parcial dos veces sobre el mismo ítem respeta el límite de `cantidadDevuelta`.
- [ ] Cerrar caja calcula correctamente sobrante/faltante contra el conteo físico declarado.
- [ ] Una cotización no descuenta stock hasta que se convierte en venta.
- [ ] Un apartado permite completarse con abonos sucesivos hasta llegar al total.

## Limitación conocida (documentada, no oculta)

Los pasos de "crear venta → descontar stock → registrar pago → mover caja" no
están dentro de una única transacción de base de datos (cruzan tres servicios
de tres módulos distintos). Se compensa con reversiones explícitas en caso de
error, pero en un evento extremo (ej. caída del servidor a mitad del
proceso) podría quedar un estado intermedio. Para v1 en un solo local esto es
aceptable; si se requiere garantía transaccional estricta, la evolución
natural es mover esta orquestación a un patrón de Saga o Outbox en una fase
posterior.
