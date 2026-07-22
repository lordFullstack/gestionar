import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CatalogosService } from './catalogos.service';
import {
  CrearCategoriaDto,
  ActualizarCategoriaDto,
  CrearMarcaDto,
  ActualizarMarcaDto,
  CrearProveedorDto,
  ActualizarProveedorDto,
  CrearUbicacionDto,
  ActualizarUbicacionDto,
} from './dto/catalogos.dto';
import { RequierePermiso } from '../shared/decorators/requiere-permiso.decorator';
import { PermisosGuard } from '../shared/guards/permisos.guard';

@Controller('inventario')
@UseGuards(PermisosGuard)
export class CatalogosController {
  constructor(private readonly catalogos: CatalogosService) {}

  // Categorías
  @Get('categorias')
  listarCategorias() {
    return this.catalogos.listarCategorias();
  }
  @Post('categorias')
  @RequierePermiso('inventario', 'crear')
  crearCategoria(@Body() dto: CrearCategoriaDto) {
    return this.catalogos.crearCategoria(dto.nombre);
  }
  @Patch('categorias/:id')
  @RequierePermiso('inventario', 'editar')
  actualizarCategoria(@Param('id') id: string, @Body() dto: ActualizarCategoriaDto) {
    return this.catalogos.actualizarCategoria(id, dto);
  }

  // Marcas
  @Get('marcas')
  listarMarcas() {
    return this.catalogos.listarMarcas();
  }
  @Post('marcas')
  @RequierePermiso('inventario', 'crear')
  crearMarca(@Body() dto: CrearMarcaDto) {
    return this.catalogos.crearMarca(dto.nombre);
  }
  @Patch('marcas/:id')
  @RequierePermiso('inventario', 'editar')
  actualizarMarca(@Param('id') id: string, @Body() dto: ActualizarMarcaDto) {
    return this.catalogos.actualizarMarca(id, dto);
  }

  // Proveedores
  @Get('proveedores')
  listarProveedores() {
    return this.catalogos.listarProveedores();
  }
  @Post('proveedores')
  @RequierePermiso('inventario', 'crear')
  crearProveedor(@Body() dto: CrearProveedorDto) {
    return this.catalogos.crearProveedor(dto);
  }
  @Patch('proveedores/:id')
  @RequierePermiso('inventario', 'editar')
  actualizarProveedor(@Param('id') id: string, @Body() dto: ActualizarProveedorDto) {
    return this.catalogos.actualizarProveedor(id, dto);
  }

  // Ubicaciones
  @Get('ubicaciones')
  listarUbicaciones() {
    return this.catalogos.listarUbicaciones();
  }
  @Post('ubicaciones')
  @RequierePermiso('inventario', 'crear')
  crearUbicacion(@Body() dto: CrearUbicacionDto) {
    return this.catalogos.crearUbicacion(dto.nombre, dto.descripcion);
  }
  @Patch('ubicaciones/:id')
  @RequierePermiso('inventario', 'editar')
  actualizarUbicacion(@Param('id') id: string, @Body() dto: ActualizarUbicacionDto) {
    return this.catalogos.actualizarUbicacion(id, dto);
  }
}
