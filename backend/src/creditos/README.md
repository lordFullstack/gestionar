# Módulo 5: Créditos

Se integra con **Clientes** (límite de crédito, clasificación automática a
`moroso`/`regular`) y **Caja** (cada abono cobrado genera un movimiento de
caja, igual que una venta). No modifica ninguna tabla de los módulos
anteriores.

## Migración

```bash
npx prisma migrate dev --name creditos
```

## Flujo completo

1. **Solicitud**: `POST /api/creditos` — valida que no exceda el límite de crédito del cliente (si tiene uno configurado).
2. **Aprobación**: `POST /api/creditos/:id/aprobar` — genera automáticamente el calendario de cuotas (capital + interés distribuidos, con ajuste de redondeo en la última cuota).
3. **Cobranza**: `POST /api/creditos/:id/abonar` — aplica el pago a la cuota más antigua pendiente (o a una específica si se indica `cuotaId`); si el monto alcanza para más de una cuota, se distribuye automáticamente.
4. **Mora**: `POST /api/creditos/marcar-mora` — pensado para ejecutarse diariamente (cron externo); marca cuotas vencidas y clasifica al cliente como `moroso` si supera 15 días de mora.
5. **Refinanciación**: `POST /api/creditos/:id/refinanciar` — toma el saldo pendiente del crédito original, lo convierte en un nuevo crédito con condiciones nuevas, y marca el original como `refinanciado`.

## Endpoints (`/api/creditos`)

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/` | — | Lista, filtros `?estado=&clienteId=` |
| GET | `/:id` | — | Detalle con cuotas y abonos |
| GET | `/cliente/:clienteId` | — | Historial de créditos de un cliente |
| GET | `/alertas/vencidos` | — | Cuotas en estado `vencida` |
| GET | `/alertas/proximos-vencer?dias=7` | — | Cuotas por vencer en el rango |
| GET | `/cobranza` | `creditos.exportar` | Cuotas vencidas + datos de contacto del cliente |
| POST | `/` | `creditos.crear` | Solicitar crédito |
| POST | `/:id/aprobar` | `creditos.aprobar` | Aprobar y generar cuotas |
| POST | `/:id/rechazar` | `creditos.aprobar` | Rechazar con motivo |
| POST | `/:id/abonar` | `creditos.crear` | Registrar abono (requiere caja abierta) |
| POST | `/:id/refinanciar` | `creditos.aprobar` | Refinanciar saldo pendiente |
| POST | `/marcar-mora` | `creditos.editar` | Job de mora (llamar desde cron) |

## Cálculo de cuotas (simplificado para v1)

- Interés total = `montoSolicitado × (tasaInteres / 100)` — tasa expresada como % **total del plazo**, no anual ni mensual, para mantenerlo simple y transparente para el cliente.
- Capital e interés se reparten en partes iguales entre las cuotas, con ajuste de centavos en la última cuota para que la suma cuadre exacto contra `montoTotal`.
- Fechas de vencimiento: se calculan según `frecuenciaPago` (semanal = +7 días, quincenal = +15 días, mensual = +1 mes calendario).

> Si más adelante se necesita amortización francesa (cuota fija con interés
> sobre saldo decreciente) u otro método, `generarCalendarioCuotas()` es el
> único punto que hay que tocar — el resto del módulo no depende del método
> de cálculo.

## Programar el job de mora

Este backend no incluye un scheduler interno todavía. La forma más simple en
un solo servidor es un cron del sistema operativo:

```bash
# crontab -e
0 6 * * * curl -X POST http://localhost:3000/api/creditos/marcar-mora -H "Authorization: Bearer <token-de-servicio>"
```

## Checklist de estabilidad antes del Módulo 6 (Compras)

- [ ] Solicitar un crédito que excede el límite del cliente devuelve 400.
- [ ] Aprobar un crédito genera exactamente `numeroCuotas` cuotas, y la suma de sus `montoTotal` es igual al `montoTotal` del crédito.
- [ ] Abonar una cuota parcialmente la deja en estado `parcial`, no `pagada`.
- [ ] Un abono que cubre más de una cuota se distribuye correctamente entre ellas en orden.
- [ ] `marcar-mora` marca `vencida` solo las cuotas con fecha pasada y no pagadas, y asigna `diasMora` correctamente.
- [ ] Un cliente con una cuota de más de 15 días de mora queda clasificado `moroso` automáticamente.
- [ ] Al pagar por completo la última cuota vencida de un cliente, vuelve a clasificarse `regular` si no tiene otra mora activa.
- [ ] Refinanciar transfiere exactamente el saldo pendiente al nuevo crédito y dos créditos quedan enlazados en `refinanciaciones`.
- [ ] Abonar sin caja abierta devuelve error claro (no un 500 genérico).

## Limitación conocida

El interés se calcula de forma simple (flat sobre el plazo total), no como
interés compuesto ni amortización francesa. Es una decisión deliberada para
v1: es fácil de explicar a un cliente en el mostrador y fácil de auditar. Si
el negocio requiere otro método más adelante, está aislado en un solo método
del servicio.
