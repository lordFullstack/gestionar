# Módulo 8: Dashboard + Informes (completo)

Módulo de **solo lectura**: no tiene tablas propias, compone datos que ya
existen en Inventario, Caja, Créditos, POS y Compras. Toda la lógica de
negocio (qué es "stock bajo", qué crédito está "vencido") sigue viviendo en
esos módulos — aquí solo se agrega y formatea.

No requiere migración de Prisma (no hay modelos nuevos).

## Endpoints

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/api/dashboard/resumen` | — (solo autenticado) | Ventas de hoy, estado de caja del usuario, alertas de inventario, clientes en mora |
| GET | `/api/informes/ventas` | `informes.exportar` | Totales del período + top 10 productos más vendidos, filtros `?desde=&hasta=` |
| GET | `/api/informes/inventario` | `informes.exportar` | Valorización total del inventario + listas de stock bajo/agotado/por vencer |
| GET | `/api/informes/cartera` | `informes.exportar` | Cuotas vencidas y próximas a vencer, con cliente y saldo pendiente |
| GET | `/api/informes/compras` | `informes.exportar` | Cuentas por pagar (pendiente/parcial/vencida), agrupadas por proveedor, filtro `?proveedorId=` |
| GET | `/api/informes/caja` | `informes.exportar` | Histórico de cierres de caja y diferencia acumulada, filtros `?desde=&hasta=` |

## De dónde sale cada informe (reutilización, sin duplicar lógica)

| Informe | Fuente |
|---|---|
| Cartera | `CreditosService.listaCobranza()` + `alertaProximosAVencer()` |
| Compras | `FacturasCompraService.listar()` filtrando por estado |
| Caja | `CajaService.historial()` (usa el campo `diferencia` ya calculado por Caja al cerrar) |
| Ventas/Inventario | `VentasService.listar()` / `ProductosService.productosStockBajo()` etc. |

## Notas de implementación

- El saldo pendiente de una cuota se calcula como `montoTotal - montoPagado`
  (el modelo `Cuota` no guarda un campo de saldo separado).
- La diferencia de caja usa el campo `diferencia` que `Caja` ya calcula al
  cerrar el turno — no se recalcula aquí.
