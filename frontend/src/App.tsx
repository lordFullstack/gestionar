import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';

// Rutas de los módulos que aún no se construyen — mantienen el esqueleto de
// navegación completo (los 9 módulos del backend) listo para que la próxima
// sesión solo tenga que reemplazar el <PlaceholderPage /> por la pantalla real.
const MODULOS_PENDIENTES: { path: string; titulo: string }[] = [
  { path: 'inventario', titulo: 'Inventario' },
  { path: 'pos', titulo: 'Punto de venta' },
  { path: 'clientes', titulo: 'Clientes' },
  { path: 'creditos', titulo: 'Créditos' },
  { path: 'compras', titulo: 'Compras' },
  { path: 'caja', titulo: 'Caja' },
  { path: 'contabilidad', titulo: 'Contabilidad' },
  { path: 'auditoria', titulo: 'Auditoría' },
  { path: 'usuarios', titulo: 'Usuarios' },
];

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            {MODULOS_PENDIENTES.map((m) => (
              <Route key={m.path} path={`/${m.path}`} element={<PlaceholderPage titulo={m.titulo} />} />
            ))}
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
}
