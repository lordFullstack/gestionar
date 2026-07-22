import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import {
  CrearClienteDto,
  ActualizarClienteDto,
  CrearDireccionDto,
  CrearContactoDto,
  CrearReferenciaDto,
  CrearDocumentoDto,
} from './dto/cliente.dto';
import { RequierePermiso } from '../shared/decorators/requiere-permiso.decorator';
import { PermisosGuard } from '../shared/guards/permisos.guard';
import { UsuarioActual } from '../shared/decorators/public.decorator';

@Controller('clientes')
@UseGuards(PermisosGuard)
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Get()
  listar(@Query('busqueda') busqueda?: string, @Query('clasificacion') clasificacion?: string) {
    return this.clientesService.listar({ busqueda, clasificacion });
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.clientesService.obtener(id);
  }

  @Get(':id/historial-compras')
  historialCompras(@Param('id') id: string) {
    return this.clientesService.historialCompras(id);
  }

  @Post()
  @RequierePermiso('clientes', 'crear')
  crear(@Body() dto: CrearClienteDto) {
    return this.clientesService.crear(dto);
  }

  @Patch(':id')
  @RequierePermiso('clientes', 'editar')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarClienteDto) {
    return this.clientesService.actualizar(id, dto);
  }

  @Patch(':id/clasificacion')
  @RequierePermiso('clientes', 'editar')
  clasificar(@Param('id') id: string, @Body() body: { clasificacion: 'regular' | 'vip' | 'moroso' }, @UsuarioActual() actor: any) {
    return this.clientesService.clasificar(id, body.clasificacion, actor.id);
  }

  @Delete(':id')
  @RequierePermiso('clientes', 'eliminar')
  desactivar(@Param('id') id: string) {
    return this.clientesService.desactivar(id);
  }

  // ---------- Direcciones ----------
  @Post(':id/direcciones')
  @RequierePermiso('clientes', 'editar')
  agregarDireccion(@Param('id') id: string, @Body() dto: CrearDireccionDto) {
    return this.clientesService.agregarDireccion(id, dto);
  }
  @Delete(':id/direcciones/:direccionId')
  @RequierePermiso('clientes', 'editar')
  eliminarDireccion(@Param('id') id: string, @Param('direccionId') direccionId: string) {
    return this.clientesService.eliminarDireccion(id, direccionId);
  }

  // ---------- Contactos ----------
  @Post(':id/contactos')
  @RequierePermiso('clientes', 'editar')
  agregarContacto(@Param('id') id: string, @Body() dto: CrearContactoDto) {
    return this.clientesService.agregarContacto(id, dto);
  }
  @Delete(':id/contactos/:contactoId')
  @RequierePermiso('clientes', 'editar')
  eliminarContacto(@Param('id') id: string, @Param('contactoId') contactoId: string) {
    return this.clientesService.eliminarContacto(id, contactoId);
  }

  // ---------- Referencias ----------
  @Post(':id/referencias')
  @RequierePermiso('clientes', 'editar')
  agregarReferencia(@Param('id') id: string, @Body() dto: CrearReferenciaDto) {
    return this.clientesService.agregarReferencia(id, dto);
  }
  @Delete(':id/referencias/:referenciaId')
  @RequierePermiso('clientes', 'editar')
  eliminarReferencia(@Param('id') id: string, @Param('referenciaId') referenciaId: string) {
    return this.clientesService.eliminarReferencia(id, referenciaId);
  }

  // ---------- Documentos ----------
  @Post(':id/documentos')
  @RequierePermiso('clientes', 'editar')
  agregarDocumento(@Param('id') id: string, @Body() dto: CrearDocumentoDto, @UsuarioActual() actor: any) {
    return this.clientesService.agregarDocumento(id, dto, actor.id);
  }
  @Delete(':id/documentos/:documentoId')
  @RequierePermiso('clientes', 'editar')
  eliminarDocumento(@Param('id') id: string, @Param('documentoId') documentoId: string) {
    return this.clientesService.eliminarDocumento(id, documentoId);
  }
}
