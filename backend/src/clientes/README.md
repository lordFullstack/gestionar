# Módulo 4: Clientes

Expande el modelo `Cliente` (que ya existía como stub desde el Módulo 3) sin
romper la relación existente con `Venta`. Se agregan 4 tablas nuevas:
direcciones, contactos, referencias y documentos — todas con `onDelete:
Cascade`, así que al desactivar/borrar un cliente no quedan huérfanos.

## Migración

```bash
npx prisma migrate dev --name clientes_completo
```

## Endpoints (`/api/clientes`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Lista, filtros `?busqueda=&clasificacion=` |
| GET | `/:id` | Detalle con direcciones, contactos, referencias, documentos |
| GET | `/:id/historial-compras` | Todas las ventas del cliente + total comprado |
| POST | `/` | Crear cliente |
| PATCH | `/:id` | Editar datos generales |
| PATCH | `/:id/clasificacion` | Cambiar a `regular`, `vip` o `moroso` |
| DELETE | `/:id` | Desactivar (no borra, preserva historial de ventas) |
| POST/DELETE | `/:id/direcciones[/:direccionId]` | Gestión de direcciones |
| POST/DELETE | `/:id/contactos[/:contactoId]` | Gestión de contactos |
| POST/DELETE | `/:id/referencias[/:referenciaId]` | Gestión de referencias (personales/comerciales) |
| POST/DELETE | `/:id/documentos[/:documentoId]` | Gestión de documentos (guarda URL, no el archivo en sí) |

## Nota sobre documentos

Este módulo guarda solo la **referencia** al archivo (`urlArchivo`), no el
binario. La subida física de archivos (a S3, disco local, etc.) es una
decisión de infraestructura que se resuelve en la capa de frontend/API
gateway — el backend de este módulo solo necesita saber dónde vive el
archivo.

## Lo que queda pendiente para el Módulo 5 (Créditos)

El campo `limiteCredito` ya existe en `Cliente` desde ahora, y la
clasificación `moroso` ya está disponible para que el módulo de Créditos la
actualice automáticamente cuando detecte mora. El historial de créditos del
cliente se agregará como una sección más de `/:id` una vez exista el modelo
`Credito` — no requiere ningún cambio en este módulo, solo un nuevo include.

## Checklist de estabilidad antes del Módulo 5

- [ ] Crear cliente con documento duplicado devuelve 409.
- [ ] `/:id/historial-compras` solo cuenta como "comprado" las ventas en estado `completada` (no cotizaciones ni anuladas).
- [ ] Marcar una dirección como `esPrincipal` desmarca automáticamente las demás del mismo cliente.
- [ ] Intentar eliminar una dirección/contacto/referencia/documento que pertenece a OTRO cliente devuelve 400.
- [ ] Desactivar un cliente no borra sus ventas históricas ni sus subrecursos.
- [ ] Un usuario con rol "Consulta" puede ver clientes pero no crear/editar.
