import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ContabilidadService } from './contabilidad.service';
import { CrearCuentaDto, ActualizarCuentaDto, CrearAsientoDto, AnularAsientoDto } from './dto/contabilidad.dto';
import { PermisosGuard } from '../shared/guards/permisos.guard';
import { RequierePermiso } from '../shared/decorators/requiere-permiso.decorator';
import { UsuarioActual } from '../shared/decorators/public.decorator';

@Controller('contabilidad')
@UseGuards(PermisosGuard)
export class ContabilidadController {
  constructor(private readonly contabilidadService: ContabilidadService) {}

  // ---------- Plan de cuentas ----------
  @Get('cuentas')
  listarCuentas(@Query('soloActivas') soloActivas?: string) {
    return this.contabilidadService.listarCuentas(soloActivas === 'true');
  }

  @Get('cuentas/:id')
  obtenerCuenta(@Param('id') id: string) {
    return this.contabilidadService.obtenerCuenta(id);
  }

  @Post('cuentas')
  @RequierePermiso('contabilidad', 'crear')
  crearCuenta(@Body() dto: CrearCuentaDto) {
    return this.contabilidadService.crearCuenta(dto);
  }

  @Patch('cuentas/:id')
  @RequierePermiso('contabilidad', 'editar')
  actualizarCuenta(@Param('id') id: string, @Body() dto: ActualizarCuentaDto) {
    return this.contabilidadService.actualizarCuenta(id, dto);
  }

  // ---------- Asientos ----------
  @Get('asientos')
  listarAsientos(
    @Query('origen') origen?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.contabilidadService.listarAsientos({ origen, desde, hasta });
  }

  @Get('asientos/:id')
  obtenerAsiento(@Param('id') id: string) {
    return this.contabilidadService.obtenerAsiento(id);
  }

  @Post('asientos')
  @RequierePermiso('contabilidad', 'crear')
  crearAsiento(@Body() dto: CrearAsientoDto, @UsuarioActual() actor: any) {
    return this.contabilidadService.crearAsientoManual(dto, actor.id);
  }

  @Post('asientos/:id/anular')
  @RequierePermiso('contabilidad', 'eliminar')
  anularAsiento(@Param('id') id: string, @Body() dto: AnularAsientoDto, @UsuarioActual() actor: any) {
    return this.contabilidadService.anularAsiento(id, actor.id, dto?.motivo);
  }

  // ---------- Reportes ----------
  @Get('libro-diario')
  @RequierePermiso('contabilidad', 'exportar')
  libroDiario(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.contabilidadService.libroDiario({ desde, hasta });
  }

  @Get('balance-comprobacion')
  @RequierePermiso('contabilidad', 'exportar')
  balanceComprobacion(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.contabilidadService.balanceComprobacion({ desde, hasta });
  }

  @Get('estado-resultados')
  @RequierePermiso('contabilidad', 'exportar')
  estadoResultados(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.contabilidadService.estadoResultados({ desde, hasta });
  }
}
