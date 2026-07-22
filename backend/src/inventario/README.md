# Módulo 2: Inventario

Se agrega sobre el Módulo 1 sin modificar ninguna tabla ni archivo existente
(solo se sumaron modelos nuevos al `schema.prisma` y un módulo nuevo en
`app.module.ts`).

## Migración

```bash
npx prisma migrate dev --name inventario
```

## Endpoints nuevos

**Catálogos** (`/api/inventario/...`)
| Método | Ruta | Permiso |
|---|---|---|
| GET/POST/PATCH | `categorias` | lectura libre; crear/editar según permiso `inventario` |
| GET/POST/PATCH | `marcas` | ídem |
| GET/POST/PATCH | `proveedores` | ídem |
| GET/POST/PATCH | `ubicaciones` | ídem |

**Productos** (`/api/inventario/productos`)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Lista con filtros `?categoriaId=&busqueda=` |
| GET | `/alertas/stock-bajo` | Productos con stock ≤ stockMinimo |
| GET | `/alertas/agotados` | Productos con stock 0 |
| GET | `/alertas/por-vencer?dias=30` | Lotes que vencen dentro del rango |
| GET | `/buscar/codigo-barras/:codigo` | Usado por el POS al escanear |
| GET | `/:id` | Detalle con stock por ubicación y lotes |
| POST | `/` | Crear (permiso `inventario.crear`) |
| PATCH | `/:id` | Editar (permiso `inventario.editar`) |
| DELETE | `/:id` | Desactivar, no borra (permiso `inventario.eliminar`) |

**Movimientos / Kardex** (`/api/inventario/movimientos`)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/` | Registra entrada, salida, ajuste o transferencia (permiso `inventario.editar`) |
| GET | `/kardex/:productoId` | Historial completo de movimientos de un producto |

## Cómo funciona el control de stock

- **`stock_ubicacion`** es una tabla caché: cantidad actual por producto y
  ubicación, para que el POS y el Dashboard lean rápido sin sumar el kardex
  completo cada vez.
- **`movimientos_inventario`** es la fuente de verdad inmutable (kardex real).
  Cada movimiento y su efecto en el stock se ejecutan dentro de una **misma
  transacción de Prisma** (`$transaction`) — si falla el registro del
  movimiento, no se actualiza el stock, y viceversa. Nunca quedan
  desincronizados.
- **Salidas y transferencias verifican stock disponible antes de descontar**;
  si no alcanza, se rechaza con 400 y un mensaje claro (disponible vs.
  solicitado), evitando stock negativo.

## Prueba manual rápida

```bash
# Crear ubicación
curl -X POST http://localhost:3000/api/inventario/ubicaciones \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"nombre":"Bodega principal"}'

# Crear producto
curl -X POST http://localhost:3000/api/inventario/productos \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"sku":"ABC-001","codigoBarras":"7501234567890","nombre":"Arroz 1kg","precioCosto":1.20,"precioVenta":1.80,"stockMinimo":10}'

# Registrar entrada de 100 unidades
curl -X POST http://localhost:3000/api/inventario/movimientos \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"productoId":"<id-producto>","tipo":"entrada","cantidad":100,"ubicacionDestinoId":"<id-ubicacion>","costoUnitario":1.20,"referenciaTipo":"compra"}'

# Intentar sacar más de lo disponible (debe fallar con 400)
curl -X POST http://localhost:3000/api/inventario/movimientos \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"productoId":"<id-producto>","tipo":"salida","cantidad":9999,"ubicacionOrigenId":"<id-ubicacion>"}'
```

## Checklist de estabilidad antes del Módulo 3 (POS)

- [ ] Crear producto con SKU duplicado devuelve 409.
- [ ] Registrar entrada aumenta correctamente `stock_ubicacion`.
- [ ] Registrar salida mayor al stock disponible devuelve 400 y NO descuenta nada.
- [ ] Transferencia mueve cantidad de una ubicación a otra de forma atómica.
- [ ] `/alertas/stock-bajo` y `/alertas/agotados` reflejan cambios en tiempo real tras movimientos.
- [ ] Búsqueda por código de barras encuentra el producto correcto (clave para el POS).
- [ ] El kardex de un producto muestra todos sus movimientos en orden cronológico inverso.
- [ ] Un usuario con rol "Consulta" puede ver productos pero no crear/editar/registrar movimientos.

## Decisión de diseño clave

El Módulo 2 se diseñó pensando en que el **Módulo 3 (POS)** consumirá
`ProductosService` y `MovimientosService` directamente (ya están exportados
en `InventarioModule`) para descontar stock automáticamente al confirmar una
venta — sin duplicar lógica de negocio.
