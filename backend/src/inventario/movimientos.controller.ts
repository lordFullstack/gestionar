import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { MovimientosService } from './movimientos.service';
import { RegistrarMovimientoDto } from './dto/producto.dto';
import { RequierePermiso } from '../shared/decorators/requiere-permiso.decorator';
import { PermisosGuard } from '../shared/guards/permisos.guard';
import { UsuarioActual } from '../shared/decorators/public.decorator';

@Controller('inventario/movimientos')
@UseGuards(PermisosGuard)
export class MovimientosController {
  constructor(private readonly movimientosService: MovimientosService) {}

  @Post()
  @RequierePermiso('inventario', 'editar')
  registrar(@Body() dto: RegistrarMovimientoDto, @UsuarioActual() actor: any) {
    return this.movimientosService.registrar(dto, actor.id);
  }

  @Get('kardex/:productoId')
  kardex(@Param('productoId') productoId: string) {
    return this.movimientosService.kardex(productoId);
  }
}
