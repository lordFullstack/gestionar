import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { PermisosGuard } from '../shared/guards/permisos.guard';
import { RequierePermiso } from '../shared/decorators/requiere-permiso.decorator';
import { UsuarioActual } from '../shared/decorators/public.decorator';

@Controller()
@UseGuards(PermisosGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('dashboard/resumen')
  resumen(@UsuarioActual() actor: any) {
    return this.dashboardService.resumen(actor.id);
  }

  @Get('informes/ventas')
  @RequierePermiso('informes', 'exportar')
  informeVentas(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.dashboardService.informeVentas({ desde, hasta });
  }

  @Get('informes/inventario')
  @RequierePermiso('informes', 'exportar')
  informeInventario() {
    return this.dashboardService.informeInventario();
  }

  @Get('informes/cartera')
  @RequierePermiso('informes', 'exportar')
  informeCartera() {
    return this.dashboardService.informeCartera();
  }

  @Get('informes/compras')
  @RequierePermiso('informes', 'exportar')
  informeCompras(@Query('proveedorId') proveedorId?: string) {
    return this.dashboardService.informeCompras({ proveedorId });
  }

  @Get('informes/caja')
  @RequierePermiso('informes', 'exportar')
  informeCaja(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.dashboardService.informeCaja({ desde, hasta });
  }
}
