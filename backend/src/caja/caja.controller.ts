import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CajaService } from './caja.service';
import { AbrirCajaDto, CerrarCajaDto, MovimientoManualCajaDto } from './dto/caja.dto';
import { PermisosGuard } from '../shared/guards/permisos.guard';
import { RequierePermiso } from '../shared/decorators/requiere-permiso.decorator';
import { UsuarioActual } from '../shared/decorators/public.decorator';

@Controller('caja')
@UseGuards(PermisosGuard)
export class CajaController {
  constructor(private readonly cajaService: CajaService) {}

  @Post('abrir')
  @RequierePermiso('caja', 'crear')
  abrir(@Body() dto: AbrirCajaDto, @UsuarioActual() actor: any) {
    return this.cajaService.abrir(actor.id, dto.montoInicial);
  }

  @Get('actual')
  actual(@UsuarioActual() actor: any) {
    return this.cajaService.obtenerCajaAbierta(actor.id);
  }

  @Get('arqueo')
  arqueo(@UsuarioActual() actor: any) {
    return this.cajaService.arqueoActual(actor.id);
  }

  @Post('movimiento')
  @RequierePermiso('caja', 'crear')
  movimientoManual(@Body() dto: MovimientoManualCajaDto, @UsuarioActual() actor: any) {
    return this.cajaService.movimientoManual(actor.id, dto.tipo, dto.monto, dto.motivo);
  }

  @Post('cerrar')
  @RequierePermiso('caja', 'aprobar')
  cerrar(@Body() dto: CerrarCajaDto, @UsuarioActual() actor: any) {
    return this.cajaService.cerrar(actor.id, dto.montoFinalDeclarado);
  }

  @Get('historial')
  @RequierePermiso('caja', 'exportar')
  historial(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.cajaService.historial(desde ? new Date(desde) : undefined, hasta ? new Date(hasta) : undefined);
  }
}
