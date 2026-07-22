import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  CreditCard,
  Truck,
  Wallet,
  BookOpen,
  ShieldCheck,
  UserCog,
  Store,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  // Si se define, el link solo se muestra si el usuario tiene ese permiso
  // (mismo criterio que el backend en RequierePermiso).
  requierePermiso?: { modulo: string; accion: 'crear' | 'editar' | 'eliminar' | 'aprobar' | 'imprimir' | 'exportar' };
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/inventario', label: 'Inventario', icon: Package },
  { to: '/pos', label: 'Punto de venta', icon: ShoppingCart },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/creditos', label: 'Créditos', icon: CreditCard },
  { to: '/compras', label: 'Compras', icon: Truck },
  { to: '/caja', label: 'Caja', icon: Wallet },
  { to: '/contabilidad', label: 'Contabilidad', icon: BookOpen },
  { to: '/auditoria', label: 'Auditoría', icon: ShieldCheck, requierePermiso: { modulo: 'auditoria', accion: 'exportar' } },
  { to: '/usuarios', label: 'Usuarios', icon: UserCog, requierePermiso: { modulo: 'usuarios', accion: 'crear' } },
];

export function Sidebar() {
  const { tienePermiso } = useAuth();

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-border bg-primary text-primary-foreground">
      <div className="flex h-16 items-center gap-2 px-5">
        <Store className="h-6 w-6 text-accent" />
        <span className="text-base font-semibold tracking-tight">ERP Comercial</span>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {NAV_ITEMS.filter((item) => !item.requierePermiso || tienePermiso(item.requierePermiso.modulo, item.requierePermiso.accion)).map(
          (item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-primary-foreground/70 transition-colors hover:bg-white/10 hover:text-primary-foreground',
                  isActive && 'bg-white/10 text-primary-foreground',
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          ),
        )}
      </nav>

      <div className="border-t border-white/10 px-5 py-3 text-xs text-primary-foreground/50">Sucursal única · v1.0</div>
    </aside>
  );
}
