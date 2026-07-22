# Módulo 6: Compras

Se integra con **Inventario** (reutiliza `MovimientosService` para toda
entrada/salida de stock — no duplica lógica de kardex) y **Caja** (los pagos
en efectivo a proveedores se reflejan como egreso, igual que un pago de
crédito). No modifica ninguna tabla de los módulos anteriores.

## Migración

```bash
npx prisma migrate dev --name compras
```

## Flujo completo

1. **Orden de compra** (`borrador` → `enviada` → `aprobada`): se arma con
   líneas de producto/cantidad/costo. Solo se puede editar en `borrador`.
2. **Aprobación**: `POST /:id/aprobar` — habilita la orden para recibir
   mercadería. Requiere permiso `compras.aprobar` (por defecto:
   Administrador, Gerente, Supervisor, Contabilidad).
3. **Recepción**: `POST /:id/recepciones` — registra la llegada física
   (total o parcial) de una o más líneas. Cada línea genera un movimiento de
   `entrada` en el kardex vía `MovimientosService`, actualiza
   `cantidadRecibida` por ítem y recalcula el estado de la orden
   (`recibida_parcial` / `recibida_total`). Si una línea falla a mitad de
   camino, se revierte automáticamente lo ya aplicado (mismo patrón de
   compensación que usa POS).
4. **Factura del proveedor**: `POST /compras/facturas` — puede asociarse a
   una orden o registrarse suelta (compras menores sin orden formal). Trae
   su propio número de factura (único por proveedor) y saldo pendiente.
5. **Pago**: `POST /compras/facturas/:id/pagos` — abona contra el saldo;
   actualiza el estado (`parcial` / `pagada`) y, si es en efectivo con caja
   abierta, genera el egreso correspondiente en caja.
6. **Devolución a proveedor**: `POST /compras/devoluciones` — saca stock
   físicamente (movimiento de `salida`) y, si se asocia a una factura, actúa
   como nota de crédito reduciendo su saldo pendiente.

## Endpoints

### `/api/compras/ordenes`

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/` | — | Lista, filtros `?estado=&proveedorId=` |
| GET | `/:id` | — | Detalle con ítems, recepciones y facturas |
| GET | `/:id/recepciones` | — | Historial de recepciones de la orden |
| POST | `/` | `compras.crear` | Crear orden (estado `borrador`) |
| PATCH | `/:id` | `compras.editar` | Editar (solo si está en `borrador`) |
| POST | `/:id/enviar` | `compras.editar` | Marca como `enviada` al proveedor |
| POST | `/:id/aprobar` | `compras.aprobar` | Habilita para recibir mercadería |
| POST | `/:id/anular` | `compras.eliminar` | Anula (solo si aún no tiene recepciones) |
| POST | `/:id/recepciones` | `compras.crear` | Registrar recepción de mercadería |

### `/api/compras/facturas`

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/` | `compras.exportar` | Lista, filtros `?estado=&proveedorId=` (marca vencidas al vuelo) |
| GET | `/:id` | — | Detalle con pagos y devoluciones |
| GET | `/:id/pagos` | — | Historial de pagos de la factura |
| POST | `/` | `compras.crear` | Registrar factura del proveedor |
| POST | `/:id/anular` | `compras.eliminar` | Anular (solo si no tiene pagos) |
| POST | `/:id/pagos` | `compras.crear` | Registrar pago/abono |

### `/api/compras/devoluciones`

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/` | — | Lista, filtro `?proveedorId=` |
| GET | `/:id` | — | Detalle con ítems |
| POST | `/` | `compras.eliminar` | Crear devolución a proveedor |

> `compras.eliminar` se usa para devoluciones (igual que en POS con las
> devoluciones de venta): es una acción que revierte algo ya registrado, no
> una simple edición.

## Checklist de estabilidad antes del Módulo 7 (Contabilidad)

- [ ] Crear una orden con 2+ líneas calcula `subtotal`/`total` correctamente.
- [ ] Editar una orden `aprobada` devuelve 400 (solo editable en `borrador`).
- [ ] Recibir más cantidad de la pendiente en una línea devuelve 400 sin tocar la base de datos.
- [ ] Recibir parcialmente dos veces la misma orden termina en `recibida_total` solo cuando la suma cubre lo solicitado.
- [ ] Cada recepción genera un `MovimientoInventario` de tipo `entrada` visible en el kardex del producto.
- [ ] Si una recepción con varias líneas falla a mitad de camino, el stock queda exactamente igual que antes (sin residuos).
- [ ] Registrar una factura con `numeroFactura` repetido para el mismo proveedor devuelve 400.
- [ ] Un pago que excede el saldo pendiente devuelve 400.
- [ ] Pagar el saldo completo deja la factura en `pagada`; un abono parcial la deja en `parcial`.
- [ ] Un pago en efectivo con caja abierta genera un `MovimientoCaja` negativo; sin caja abierta, el pago igual se registra.
- [ ] Una devolución descuenta stock real y, si está ligada a una factura, reduce su `saldoPendiente`.
- [ ] Anular una orden con recepciones ya registradas devuelve 400 (debe usarse una devolución en su lugar).

## Limitación conocida

Igual que en POS→Inventario→Caja, la orquestación
Recepción→Inventario y Devolución→Inventario cruza módulos sin una única
transacción de base de datos: cada movimiento de `MovimientosService` es
atómico en sí mismo, y el módulo de Compras compensa manualmente (crea el
movimiento inverso) si una línea falla a mitad de una operación con varias
líneas. Documentado como deuda técnica a resolver junto con el resto de la
orquestación cross-módulo cuando se aborde la mejora transversal.
