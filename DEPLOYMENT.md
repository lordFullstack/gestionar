# Despliegue — configuración inicial (una sola vez)

**Estado actual: solo el frontend se despliega (GitHub Pages). El backend
por ahora se queda con CI (build/typecheck en cada push) pero sin host real
conectado** — `backend-deploy.yml` existe y está listo, pero su disparador
automático está comentado a propósito para que no falle en cada push sin
credenciales configuradas. El backend se prueba en local (`npm run
start:dev`) contra el mismo Supabase de siempre. Cuando decidas un host
(Railway u otro), la sección 1 de abajo explica cómo activarlo.

## 1. Backend → Railway (pendiente, opcional por ahora)

1. Crear cuenta en [railway.app](https://railway.app) y un proyecto nuevo.
2. **New Service → Deploy from GitHub repo** → seleccionar este repositorio.
3. En la configuración del servicio:
   - **Root Directory**: `backend`
   - **Build Command**: (dejar el default, Railway detecta Nest/Node solo,
     o especificar `npm run build`)
   - **Start Command**: `npx prisma migrate deploy && node dist/main.js`
     — esto aplica las migraciones pendientes de Prisma automáticamente en
     cada arranque, sin que el workflow de GitHub necesite tocar la BD.
4. En **Variables** del servicio, agregar (ver `.env.example` del backend):
   - `DATABASE_URL` (pooler puerto 6543, `?pgbouncer=true`)
   - `DIRECT_URL` (pooler puerto 5432)
   - `JWT_SECRET`, `JWT_REFRESH_SECRET` (o como se llamen en tu `.env` real)
   - Cualquier otra variable que el backend necesite en producción
5. **Importante**: en el paso "New Service" **desmarca** el auto-deploy de
   Railway sobre pushes a `main` (Settings → un toggle tipo "Automatic
   Deploys" o similar, depende de la versión de la UI) — el deploy real lo
   dispara el workflow `backend-deploy.yml` de este repo, no Railway
   directamente. Si dejas ambos activos no pasa nada grave (Railway
   simplemente redeploya dos veces), pero es redundante.
6. Generar un token: **Project Settings → Tokens → Create Token** (token de
   proyecto, no de cuenta personal).
7. En GitHub: **Settings del repo → Secrets and variables → Actions →
   New repository secret** → nombre `RAILWAY_TOKEN`, valor el token del
   paso anterior.
8. En `.github/workflows/backend-deploy.yml`, **descomentar el bloque
   `push:`** del trigger — mientras esté comentado, el workflow solo corre
   a mano (`workflow_dispatch`), nunca automáticamente.
9. Correr el seed inicial una vez (desde tu máquina, apuntando al
   `DATABASE_URL` de producción): `npm run prisma:seed` — o hacerlo desde
   la consola de Railway si prefieres no exponer las credenciales de
   producción en tu máquina local.

## 2. Frontend → GitHub Pages

1. En GitHub: **Settings del repo → Pages → Build and deployment → Source**
   → seleccionar **GitHub Actions** (no "Deploy from a branch").
2. **Settings del repo → Secrets and variables → Actions → pestaña
   Variables → New repository variable**:
   - Nombre: `VITE_API_URL`
   - Valor: la URL pública del backend, con `/api` al final. **Mientras el
     backend no tenga host real** (ver sección 1), el frontend desplegado
     en Pages no podrá llamar a la API — solo servirá para ver la UI
     estática (login, layout). Para probar el flujo completo end-to-end,
     usar el frontend en local (`npm run dev`) apuntando a
     `http://localhost:3000/api` con el backend también corriendo en
     local.
3. Nada más que configurar: el workflow calcula solo la subruta
   (`BASE_PATH`) a partir del nombre del repo.

## 3. Primer push

Con lo anterior configurado, cualquier push a `main` que toque `frontend/`
dispara `frontend-deploy.yml` automáticamente. `backend-deploy.yml` por
ahora **solo corre a mano** (pestaña **Actions** → seleccionarlo → botón
"Run workflow") y fallará hasta que completes la sección 1 — eso es
intencional, no un error.

## 4. Notas sobre el mismo Supabase de siempre

Nada de esto cambia la base de datos: sigue siendo el mismo proyecto
Supabase (`erp-comercial`, `huknbjogifkblytwmqlx`) de siempre, vía el
connection pooler. Antes de conectar producción a él:

- **Resetear la contraseña de la BD** si aún no se hizo (Settings →
  Database → Reset password) — se compartió en texto plano en una sesión
  anterior de este proyecto.
- Confirmar que el proyecto Supabase no esté pausado (recordar que
  **RIFATECH** se pausó para liberar espacio del free tier — no debería
  afectar a `erp-comercial`, pero vale la pena confirmar en el dashboard
  antes del primer deploy real).
