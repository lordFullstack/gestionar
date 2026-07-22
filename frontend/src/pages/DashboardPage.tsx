import { useEffect, useState } from 'react';
import { ShoppingCart, Wallet, PackageX, Clock, AlertTriangle, Users2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatoMoneda, formatoFechaHora } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardResumen } from '@/lib/types';

export function DashboardPage() {
  const { usuario } = useAuth();
  const [resumen, setResumen] = useState<DashboardResumen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    api
      .get<DashboardResumen>('/dashboard/resumen')
      .then(({ data }) => {
        if (vivo) setResumen(data);
      })
      .catch(() => {
        if (vivo) setError('No se pudo cargar el resumen del día. Intenta de nuevo en un momento.');
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const hayAlertas = resumen ? resumen.alertasInventario.stockBajo + resumen.alertasInventario.agotados > 0 : false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Hola, {usuario?.nombre.split(' ')[0]}</h1>
        <p className="text-sm text-muted-foreground">Esto es lo que está pasando en la tienda hoy.</p>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Ventas de hoy */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Ventas de hoy</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {cargando ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <p className="figure text-2xl font-semibold">{formatoMoneda(resumen?.ventas.totalHoy ?? 0)}</p>
                <p className="text-xs text-muted-foreground">{resumen?.ventas.cantidadHoy ?? 0} venta(s) registrada(s)</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Estado de caja */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Caja</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {cargando ? (
              <Skeleton className="h-8 w-24" />
            ) : resumen?.caja.estado === 'abierta' ? (
              <>
                <Badge variant="success">Abierta</Badge>
                <p className="mt-1.5 text-xs text-muted-foreground">Desde {formatoFechaHora(resumen.caja.abiertaEn)}</p>
              </>
            ) : (
              <Badge variant="secondary">Cerrada</Badge>
            )}
          </CardContent>
        </Card>

        {/* Alertas de inventario */}
        <Card className={cn(hayAlertas && 'border-warning/40')}>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Inventario</CardTitle>
            <PackageX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {cargando ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Stock bajo</span>
                  <span className="figure font-medium">{resumen?.alertasInventario.stockBajo ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Agotados</span>
                  <span className="figure font-medium text-destructive">{resumen?.alertasInventario.agotados ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" /> Por vencer
                  </span>
                  <span className="figure font-medium">{resumen?.alertasInventario.proximosAVencer ?? 0}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cartera */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Cartera</CardTitle>
            <Users2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {cargando ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <p className="figure text-2xl font-semibold">{resumen?.cartera.clientesEnMora ?? 0}</p>
                <p className="text-xs text-muted-foreground">cliente(s) en mora</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
