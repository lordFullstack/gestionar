import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { VentasService } from './ventas.service';
import { CrearVentaDto, AbonarVentaDto, CrearDevolucionDto } from './dto/pos.dto';
import { PermisosGuard } from '../shared/guards/permisos.guard';
import { RequierePermiso } from '../shared/decorators/requiere-permiso.decorator';
import { UsuarioActual } from '../shared/decorators/public.decorator';

@Controller('pos/ventas')
@UseGuards(PermisosGuard)
export class VentasController {
  constructor(private readonly ventasService: VentasService) {}

  @Get()
  @RequierePermiso('pos', 'exportar')
  listar(@Query('estado') estado?: string, @Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.ventasService.listar({
      estado,
      desde: desde ? new Date(desde) : undefined,
      hasta: hasta ? new Date(hasta) : undefined,
    });
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.ventasService.obtener(id);
  }

  @Get(':id/reimprimir')
  @RequierePermiso('pos', 'imprimir')
  reimprimir(@Param('id') id: string) {
    return this.ventasService.reimprimir(id);
  }

  @Post()
  @RequierePermiso('pos', 'crear')
  crear(@Body() dto: CrearVentaDto, @UsuarioActual() actor: any) {
    return this.ventasService.crear(dto, actor.id);
  }

  @Post(':id/abonar')
  @RequierePermiso('pos', 'crear')
  abonar(@Param('id') id: string, @Body() dto: AbonarVentaDto, @UsuarioActual() actor: any) {
    return this.ventasService.abonar(id, dto, actor.id);
  }

  @Post(':id/convertir')
  @RequierePermiso('pos', 'crear')
  convertir(
    @Param('id') id: string,
    @Body() body: { ubicacionId: string; pagos: { metodo: string; monto: number; referencia?: string }[] },
    @UsuarioActual() actor: any,
  ) {
    return this.ventasService.convertirCotizacion(id, body.ubicacionId, body.pagos, actor.id);
  }

  @Post(':id/anular')
  @RequierePermiso('pos', 'eliminar')
  anular(@Param('id') id: string, @Body() body: { motivo?: string }, @UsuarioActual() actor: any) {
    return this.ventasService.anular(id, actor.id, body?.motivo);
  }

  @Post('devoluciones')
  @RequierePermiso('pos', 'eliminar')
  crearDevolucion(@Body() dto: CrearDevolucionDto & { ubicacionId: string }, @UsuarioActual() actor: any) {
    return this.ventasService.crearDevolucion(dto, actor.id, dto.ubicacionId);
  }
}
