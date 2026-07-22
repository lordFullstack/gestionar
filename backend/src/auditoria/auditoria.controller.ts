import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuditoriaService } from './auditoria.service';
import { PermisosGuard } from '../shared/guards/permisos.guard';
import { RequierePermiso } from '../shared/decorators/requiere-permiso.decorator';

@Controller('auditoria')
@UseGuards(PermisosGuard)
@RequierePermiso('auditoria', 'exportar') // todo el módulo restringido a quien tenga permiso de auditoría (Admin/Gerente por defecto)
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  listar(
    @Query('usuarioId') usuarioId?: string,
    @Query('modulo') modulo?: string,
    @Query('accion') accion?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('limite') limite?: string,
  ) {
    return this.auditoriaService.listar({
      usuarioId,
      modulo,
      accion,
      desde,
      hasta,
      limite: limite ? Number(limite) : undefined,
    });
  }

  @Get('resumen')
  resumenPorModulo(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.auditoriaService.resumenPorModulo({ desde, hasta });
  }

  @Get('usuario/:usuarioId')
  porUsuario(@Param('usuarioId') usuarioId: string, @Query('limite') limite?: string) {
    return this.auditoriaService.porUsuario(usuarioId, limite ? Number(limite) : undefined);
  }

  @Get('entidad/:modulo/:entidadId')
  porEntidad(@Param('modulo') modulo: string, @Param('entidadId') entidadId: string) {
    return this.auditoriaService.porEntidad(modulo, entidadId);
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.auditoriaService.obtener(id);
  }
}
