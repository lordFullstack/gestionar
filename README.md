# ERP Comercial (single store)

Monorepo: backend (NestJS + Prisma + PostgreSQL/Supabase) + frontend
(React + Vite + Tailwind).

```
.
├── backend/     → API NestJS. Ver backend/README.md y backend/RESUMEN-PROYECTO.md
├── frontend/    → SPA React. Ver frontend/README.md
├── .github/
│   └── workflows/
│       ├── backend-ci.yml       # typecheck + build en cada push/PR a backend/
│       ├── backend-deploy.yml   # deploy a Railway al mergear a main
│       ├── frontend-ci.yml      # typecheck + build en cada push/PR a frontend/
│       └── frontend-deploy.yml  # build + deploy a GitHub Pages al mergear a main
└── DEPLOYMENT.md  → checklist de configuración inicial (una sola vez)
```

## Desarrollo local

```bash
# Backend
cd backend
npm install
cp .env.example .env   # completar con las credenciales del pooler de Supabase
npm run start:dev      # http://localhost:3000/api

# Frontend (en otra terminal)
cd frontend
npm install
cp .env.example .env   # VITE_API_URL=http://localhost:3000/api
npm run dev            # http://localhost:5173
```

## CI/CD

Cada carpeta tiene su propio workflow de CI (build + typecheck en cada push
y pull request) y su propio workflow de deploy.

- **Frontend** → GitHub Pages, activo. Cualquier push a `main` que toque
  `frontend/` lo despliega automáticamente (vía `actions/deploy-pages`).
- **Backend** → por ahora **solo CI** (build/typecheck en cada push). El
  workflow de deploy a Railway ya existe (`backend-deploy.yml`) pero su
  disparador automático está comentado a propósito — sin un host real
  conectado, fallaría en cada push. Se prueba en local mientras tanto.

Antes de activar el deploy del backend, seguir la checklist completa en
[`DEPLOYMENT.md`](./DEPLOYMENT.md) — hay pasos manuales de una sola vez
(secrets, variables, configuración de Railway y de Pages) que los
workflows no pueden hacer solos.

## Estado del proyecto

Ver `backend/RESUMEN-PROYECTO.md` para el detalle módulo por módulo. En
resumen: los 9 módulos del backend están completos; el frontend tiene
Login y Dashboard funcionando, el resto de pantallas quedan pendientes.
