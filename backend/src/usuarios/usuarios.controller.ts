import { Body, Controller, Get, Param, Patch, Post, Delete, UseGuards } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { CrearUsuarioDto, ActualizarUsuarioDto, CambiarPasswordDto } from './dto/usuario.dto';
import { RequierePermiso } from '../shared/decorators/requiere-permiso.decorator';
import { PermisosGuard } from '../shared/guards/permisos.guard';
import { UsuarioActual } from '../shared/decorators/public.decorator';

@Controller('usuarios')
@UseGuards(PermisosGuard) // JwtAuthGuard ya es global (ver app.module)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  @RequierePermiso('usuarios', 'crear') // solo quien puede crear puede listar (ajustable)
  listar() {
    return this.usuariosService.listar();
  }

  @Get('roles')
  @RequierePermiso('usuarios', 'crear')
  listarRoles() {
    return this.usuariosService.listarRoles();
  }

  @Get(':id')
  @RequierePermiso('usuarios', 'crear')
  obtener(@Param('id') id: string) {
    return this.usuariosService.obtener(id);
  }

  @Post()
  @RequierePermiso('usuarios', 'crear')
  crear(@Body() dto: CrearUsuarioDto, @UsuarioActual() actor: any) {
    return this.usuariosService.crear(dto, actor.id);
  }

  @Patch(':id')
  @RequierePermiso('usuarios', 'editar')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarUsuarioDto, @UsuarioActual() actor: any) {
    return this.usuariosService.actualizar(id, dto, actor.id);
  }

  @Patch(':id/password')
  cambiarPassword(@Param('id') id: string, @Body() dto: CambiarPasswordDto) {
    // Cualquier usuario autenticado puede cambiar SU propia contraseña; no requiere permiso de módulo
    return this.usuariosService.cambiarPassword(id, dto);
  }

  @Delete(':id')
  @RequierePermiso('usuarios', 'eliminar')
  desactivar(@Param('id') id: string, @UsuarioActual() actor: any) {
    return this.usuariosService.desactivar(id, actor.id);
  }
}
