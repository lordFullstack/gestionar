import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CreditosService } from './creditos.service';
import { SolicitarCreditoDto, RechazarCreditoDto, AbonarCreditoDto, RefinanciarCreditoDto } from './dto/credito.dto';
import { RequierePermiso } from '../shared/decorators/requiere-permiso.decorator';
import { PermisosGuard } from '../shared/guards/permisos.guard';
import { UsuarioActual } from '../shared/decorators/public.decorator';

@Controller('creditos')
@UseGuards(PermisosGuard)
export class CreditosController {
  constructor(private readonly creditosService: CreditosService) {}

  @Get()
  listar(@Query('estado') estado?: string, @Query('clienteId') clienteId?: string) {
    return this.creditosService.listar({ estado, clienteId });
  }

  @Get('alertas/vencidos')
  alertaVencidos() {
    return this.creditosService.alertaCreditosVencidos();
  }

  @Get('alertas/proximos-vencer')
  alertaProximos(@Query('dias') dias?: string) {
    return this.creditosService.alertaProximosAVencer(dias ? Number(dias) : 7);
  }

  @Get('cobranza')
  @RequierePermiso('creditos', 'exportar')
  cobranza() {
    return this.creditosService.listaCobranza();
  }

  @Get('cliente/:clienteId')
  historialCliente(@Param('clienteId') clienteId: string) {
    return this.creditosService.historialCliente(clienteId);
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.creditosService.obtener(id);
  }

  @Post()
  @RequierePermiso('creditos', 'crear')
  solicitar(@Body() dto: SolicitarCreditoDto) {
    return this.creditosService.solicitar(dto);
  }

  @Post(':id/aprobar')
  @RequierePermiso('creditos', 'aprobar')
  aprobar(@Param('id') id: string, @UsuarioActual() actor: any) {
    return this.creditosService.aprobar(id, actor.id);
  }

  @Post(':id/rechazar')
  @RequierePermiso('creditos', 'aprobar')
  rechazar(@Param('id') id: string, @Body() dto: RechazarCreditoDto, @UsuarioActual() actor: any) {
    return this.creditosService.rechazar(id, dto.motivo, actor.id);
  }

  @Post(':id/abonar')
  @RequierePermiso('creditos', 'crear')
  abonar(@Param('id') id: string, @Body() dto: AbonarCreditoDto, @UsuarioActual() actor: any) {
    return this.creditosService.abonar(id, dto, actor.id);
  }

  @Post(':id/refinanciar')
  @RequierePermiso('creditos', 'aprobar')
  refinanciar(@Param('id') id: string, @Body() dto: RefinanciarCreditoDto, @UsuarioActual() actor: any) {
    return this.creditosService.refinanciar(id, dto, actor.id);
  }

  @Post('marcar-mora')
  @RequierePermiso('creditos', 'editar')
  marcarMora() {
    return this.creditosService.marcarMora();
  }
}
