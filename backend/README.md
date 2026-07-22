# Módulo 1: Auth + Usuarios/Roles

## Instalación

```bash
npm install
cp .env.example .env   # editar DATABASE_URL y JWT_SECRET
npx prisma migrate dev --name init
npm run prisma:seed
npm run start:dev
```

Esto crea los 8 roles del sistema (Administrador, Gerente, Supervisor, Cajero,
Vendedor, Bodega, Contabilidad, Cobranza, Consulta) con su matriz de permisos
por defecto, y un usuario administrador:

```
email:    admin@almacen.local
password: CambiarEsta123!
```

**Cambiar esta contraseña de inmediato en un entorno real.**

## Endpoints disponibles

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/auth/login` | Público | Devuelve accessToken (15 min) + refreshToken (7 días) |
| POST | `/api/auth/refresh` | Público | Renueva el accessToken |
| POST | `/api/auth/logout` | Público | Revoca el refresh token |
| GET | `/api/usuarios` | JWT + permiso `usuarios.crear` | Lista usuarios |
| GET | `/api/usuarios/roles` | JWT + permiso `usuarios.crear` | Lista roles y su matriz de permisos |
| GET | `/api/usuarios/:id` | JWT + permiso `usuarios.crear` | Detalle de usuario |
| POST | `/api/usuarios` | JWT + permiso `usuarios.crear` | Crea usuario |
| PATCH | `/api/usuarios/:id` | JWT + permiso `usuarios.editar` | Edita nombre/rol/activo |
| PATCH | `/api/usuarios/:id/password` | JWT (cualquiera, solo su propia cuenta) | Cambia su contraseña |
| DELETE | `/api/usuarios/:id` | JWT + permiso `usuarios.eliminar` | Desactiva (no borra) |

## Prueba manual rápida

```bash
# 1. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@almacen.local","password":"CambiarEsta123!"}'

# 2. Usar el accessToken devuelto
curl http://localhost:3000/api/usuarios \
  -H "Authorization: Bearer <accessToken>"
```

## Checklist de estabilidad antes de pasar al Módulo 2 (Inventario)

- [ ] Login con credenciales correctas e incorrectas.
- [ ] Access token expira a los 15 min y `/refresh` funciona.
- [ ] Logout revoca el refresh token (usarlo de nuevo debe fallar).
- [ ] Un usuario con rol "Consulta" recibe 403 al intentar crear un usuario.
- [ ] Un usuario con rol "Administrador" pasa cualquier permiso.
- [ ] Cambiar password con la contraseña actual incorrecta devuelve 400.
- [ ] Desactivar un usuario le impide loguearse de nuevo.
- [ ] Toda acción relevante queda en la tabla `bitacora`.

## Decisiones de diseño relevantes

- **Desactivar, no borrar** usuarios: preserva integridad referencial cuando
  el resto de módulos (ventas, créditos) referencien a ese usuario.
- **Refresh token en base de datos** (no solo JWT): permite revocar sesiones
  individualmente (ej. si se pierde una terminal/dispositivo).
- **Permisos por módulo, no por endpoint**: la matriz vive en `roles` y se
  reutiliza para todos los módulos futuros sin tocar este código.
- **class-validator con `whitelist: true`**: cualquier campo no declarado en
  el DTO se descarta automáticamente — reduce superficie de ataque.
