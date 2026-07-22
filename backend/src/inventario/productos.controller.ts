import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, Delete } from '@nestjs/common';
import { ProductosService } from './productos.service';
import { CrearProductoDto, ActualizarProductoDto } from './dto/producto.dto';
import { RequierePermiso } from '../shared/decorators/requiere-permiso.decorator';
import { PermisosGuard } from '../shared/guards/permisos.guard';

@Controller('inventario/productos')
@UseGuards(PermisosGuard)
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  @Get()
  listar(@Query('categoriaId') categoriaId?: string, @Query('busqueda') busqueda?: string) {
    return this.productosService.listar({ categoriaId, busqueda, soloActivos: true });
  }

  // Alertas — se ubican antes de ':id' para que no choquen con el wildcard
  @Get('alertas/stock-bajo')
  stockBajo() {
    return this.productosService.productosStockBajo();
  }

  @Get('alertas/agotados')
  agotados() {
    return this.productosService.productosAgotados();
  }

  @Get('alertas/por-vencer')
  porVencer(@Query('dias') dias?: string) {
    return this.productosService.productosProximosAVencer(dias ? Number(dias) : 30);
  }

  @Get('buscar/codigo-barras/:codigo')
  buscarPorCodigo(@Param('codigo') codigo: string) {
    return this.productosService.buscarPorCodigoBarras(codigo);
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.productosService.obtener(id);
  }

  @Post()
  @RequierePermiso('inventario', 'crear')
  crear(@Body() dto: CrearProductoDto) {
    return this.productosService.crear(dto);
  }

  @Patch(':id')
  @RequierePermiso('inventario', 'editar')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarProductoDto) {
    return this.productosService.actualizar(id, dto);
  }

  @Delete(':id')
  @RequierePermiso('inventario', 'eliminar')
  desactivar(@Param('id') id: string) {
    return this.productosService.desactivar(id);
  }
}
