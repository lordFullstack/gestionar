import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import { CrearProductoDto, ActualizarProductoDto } from './dto/producto.dto';

@Injectable()
export class ProductosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtro?: { categoriaId?: string; soloActivos?: boolean; busqueda?: string }) {
    return this.prisma.producto.findMany({
      where: {
        categoriaId: filtro?.categoriaId,
        activo: filtro?.soloActivos ? true : undefined,
        OR: filtro?.busqueda
          ? [
              { nombre: { contains: filtro.busqueda, mode: 'insensitive' } },
              { sku: { contains: filtro.busqueda, mode: 'insensitive' } },
              { codigoBarras: { contains: filtro.busqueda, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: {
        categoria: true,
        marca: true,
        proveedor: true,
        stocks: { include: { ubicacion: true } },
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async obtener(id: string) {
    const producto = await this.prisma.producto.findUnique({
      where: { id },
      include: {
        categoria: true,
        marca: true,
        proveedor: true,
        stocks: { include: { ubicacion: true } },
        lotes: { orderBy: { fechaVencimiento: 'asc' } },
      },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    return producto;
  }

  // Usado por el POS al escanear código de barras
  async buscarPorCodigoBarras(codigo: string) {
    const producto = await this.prisma.producto.findUnique({
      where: { codigoBarras: codigo },
      include: { stocks: true },
    });
    if (!producto) throw new NotFoundException('No se encontró un producto con ese código de barras');
    return producto;
  }

  async crear(dto: CrearProductoDto) {
    const existeSku = await this.prisma.producto.findUnique({ where: { sku: dto.sku } });
    if (existeSku) throw new ConflictException('Ya existe un producto con ese SKU');

    if (dto.codigoBarras) {
      const existeCodigo = await this.prisma.producto.findUnique({ where: { codigoBarras: dto.codigoBarras } });
      if (existeCodigo) throw new ConflictException('Ya existe un producto con ese código de barras');
    }

    return this.prisma.producto.create({ data: dto });
  }

  async actualizar(id: string, dto: ActualizarProductoDto) {
    await this.obtener(id);
    return this.prisma.producto.update({ where: { id }, data: dto });
  }

  async desactivar(id: string) {
    await this.obtener(id);
    return this.prisma.producto.update({ where: { id }, data: { activo: false } });
  }

  // ---------- Alertas de stock (consumidas por el Dashboard) ----------

  async productosStockBajo() {
    const productos = await this.prisma.producto.findMany({
      where: { activo: true },
      include: { stocks: true },
    });
    return productos
      .map((p) => ({ ...p, stockTotal: p.stocks.reduce((sum, s) => sum + s.cantidad, 0) }))
      .filter((p) => p.stockTotal > 0 && p.stockTotal <= p.stockMinimo);
  }

  async productosAgotados() {
    const productos = await this.prisma.producto.findMany({
      where: { activo: true },
      include: { stocks: true },
    });
    return productos
      .map((p) => ({ ...p, stockTotal: p.stocks.reduce((sum, s) => sum + s.cantidad, 0) }))
      .filter((p) => p.stockTotal <= 0);
  }

  async productosProximosAVencer(diasUmbral = 30) {
    const limite = new Date();
    limite.setDate(limite.getDate() + diasUmbral);
    return this.prisma.lote.findMany({
      where: { fechaVencimiento: { lte: limite, gte: new Date() }, cantidad: { gt: 0 } },
      include: { producto: true },
      orderBy: { fechaVencimiento: 'asc' },
    });
  }
}
