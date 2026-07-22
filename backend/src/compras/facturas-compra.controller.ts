import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { FacturasCompraService } from './facturas-compra.service';
import { CrearFacturaCompraDto, CrearPagoCompraDto } from './dto/facturas-compra.dto';
import { PermisosGuard } from '../shared/guards/permisos.guard';
import { RequierePermiso } from '../shared/decorators/requiere-permiso.decorator';
import { UsuarioActual } from '../shared/decorators/public.decorator';

@Controller('compras/facturas')
@UseGuards(PermisosGuard)
export class FacturasCompraController {
  constructor(private readonly facturasCompraService: FacturasCompraService) {}

  @Get()
  @RequierePermiso('compras', 'exportar')
  listar(@Query('estado') estado?: string, @Query('proveedorId') proveedorId?: string) {
    return this.facturasCompraService.listar({ estado, proveedorId });
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.facturasCompraService.obtener(id);
  }

  @Get(':id/pagos')
  listarPagos(@Param('id') id: string) {
    return this.facturasCompraService.listarPagos(id);
  }

  @Post()
  @RequierePermiso('compras', 'crear')
  crear(@Body() dto: CrearFacturaCompraDto, @UsuarioActual() actor: any) {
    return this.facturasCompraService.crear(dto, actor.id);
  }

  @Post(':id/anular')
  @RequierePermiso('compras', 'eliminar')
  anular(@Param('id') id: string, @UsuarioActual() actor: any) {
    return this.facturasCompraService.anular(id, actor.id);
  }

  @Post(':id/pagos')
  @RequierePermiso('compras', 'crear')
  pagar(@Param('id') id: string, @Body() dto: CrearPagoCompraDto, @UsuarioActual() actor: any) {
    return this.facturasCompraService.pagar(id, dto, actor.id);
  }
}
