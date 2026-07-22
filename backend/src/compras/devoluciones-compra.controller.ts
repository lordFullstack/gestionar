import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { DevolucionesCompraService } from './devoluciones-compra.service';
import { CrearDevolucionCompraDto } from './dto/devoluciones-compra.dto';
import { PermisosGuard } from '../shared/guards/permisos.guard';
import { RequierePermiso } from '../shared/decorators/requiere-permiso.decorator';
import { UsuarioActual } from '../shared/decorators/public.decorator';

@Controller('compras/devoluciones')
@UseGuards(PermisosGuard)
export class DevolucionesCompraController {
  constructor(private readonly devolucionesCompraService: DevolucionesCompraService) {}

  @Get()
  listar(@Query('proveedorId') proveedorId?: string) {
    return this.devolucionesCompraService.listar({ proveedorId });
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.devolucionesCompraService.obtener(id);
  }

  @Post()
  @RequierePermiso('compras', 'eliminar')
  crear(@Body() dto: CrearDevolucionCompraDto, @UsuarioActual() actor: any) {
    return this.devolucionesCompraService.crear(dto, actor.id);
  }
}
