import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { OrdenesCompraService } from './ordenes-compra.service';
import { RecepcionesService } from './recepciones.service';
import { CrearOrdenCompraDto, ActualizarOrdenCompraDto, AnularOrdenCompraDto } from './dto/ordenes-compra.dto';
import { CrearRecepcionDto } from './dto/recepciones.dto';
import { PermisosGuard } from '../shared/guards/permisos.guard';
import { RequierePermiso } from '../shared/decorators/requiere-permiso.decorator';
import { UsuarioActual } from '../shared/decorators/public.decorator';

@Controller('compras/ordenes')
@UseGuards(PermisosGuard)
export class OrdenesCompraController {
  constructor(
    private readonly ordenesCompraService: OrdenesCompraService,
    private readonly recepcionesService: RecepcionesService,
  ) {}

  @Get()
  listar(@Query('estado') estado?: string, @Query('proveedorId') proveedorId?: string) {
    return this.ordenesCompraService.listar({ estado, proveedorId });
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.ordenesCompraService.obtener(id);
  }

  @Get(':id/recepciones')
  listarRecepciones(@Param('id') id: string) {
    return this.recepcionesService.listarPorOrden(id);
  }

  @Post()
  @RequierePermiso('compras', 'crear')
  crear(@Body() dto: CrearOrdenCompraDto, @UsuarioActual() actor: any) {
    return this.ordenesCompraService.crear(dto, actor.id);
  }

  @Patch(':id')
  @RequierePermiso('compras', 'editar')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarOrdenCompraDto) {
    return this.ordenesCompraService.actualizar(id, dto);
  }

  @Post(':id/enviar')
  @RequierePermiso('compras', 'editar')
  enviar(@Param('id') id: string) {
    return this.ordenesCompraService.enviar(id);
  }

  @Post(':id/aprobar')
  @RequierePermiso('compras', 'aprobar')
  aprobar(@Param('id') id: string, @UsuarioActual() actor: any) {
    return this.ordenesCompraService.aprobar(id, actor.id);
  }

  @Post(':id/anular')
  @RequierePermiso('compras', 'eliminar')
  anular(@Param('id') id: string, @Body() dto: AnularOrdenCompraDto, @UsuarioActual() actor: any) {
    return this.ordenesCompraService.anular(id, actor.id, dto?.motivo);
  }

  @Post(':id/recepciones')
  @RequierePermiso('compras', 'crear')
  recibir(@Param('id') id: string, @Body() dto: CrearRecepcionDto, @UsuarioActual() actor: any) {
    return this.recepcionesService.recibir(id, dto, actor.id);
  }
}
