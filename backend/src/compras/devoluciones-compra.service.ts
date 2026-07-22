import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import { MovimientosService } from '../inventario/movimientos.service';
import { CrearDevolucionCompraDto } from './dto/devoluciones-compra.dto';

@Injectable()
export class DevolucionesCompraService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly movimientosService: MovimientosService,
  ) {}

  async crear(dto: CrearDevolucionCompraDto, usuarioId: string) {
    const proveedor = await this.prisma.proveedor.findUnique({ where: { id: dto.proveedorId } });
    if (!proveedor) throw new NotFoundException('Proveedor no encontrado');

    let factura: { id: string; saldoPendiente: any; estado: string } | null = null;
    if (dto.facturaCompraId) {
      factura = await this.prisma.facturaCompra.findUnique({ where: { id: dto.facturaCompraId } });
      if (!factura) throw new NotFoundException('Factura de compra no encontrada');
    }

    const items = dto.items.map((i) => ({
      productoId: i.productoId,
      cantidad: i.cantidad,
      costoUnitario: i.costoUnitario,
      subtotal: i.cantidad * i.costoUnitario,
    }));
    const montoTotal = items.reduce((s, i) => s + i.subtotal, 0);

    const devolucion = await this.prisma.devolucionCompra.create({
      data: {
        proveedorId: dto.proveedorId,
        facturaCompraId: dto.facturaCompraId,
        ubicacionId: dto.ubicacionId,
        motivo: dto.motivo,
        usuarioId,
        items: { create: items },
      },
    });

    // Cada línea sale físicamente del inventario. Si alguna falla (ej. stock insuficiente
    // porque ya se vendió), se compensa lo ya aplicado y se anula la devolución completa,
    // mismo patrón que POS y Recepciones.
    const lineasAplicadas: { productoId: string; cantidad: number }[] = [];
    try {
      for (const item of dto.items) {
        await this.movimientosService.registrar(
          {
            productoId: item.productoId,
            tipo: 'salida',
            cantidad: item.cantidad,
            costoUnitario: item.costoUnitario,
            ubicacionOrigenId: dto.ubicacionId,
            referenciaTipo: 'devolucion_compra',
            referenciaId: devolucion.id,
            motivo: dto.motivo ?? 'Devolución a proveedor',
          },
          usuarioId,
        );
        lineasAplicadas.push({ productoId: item.productoId, cantidad: item.cantidad });
      }
    } catch (error) {
      for (const aplicada of lineasAplicadas) {
        await this.movimientosService.registrar(
          {
            productoId: aplicada.productoId,
            tipo: 'entrada',
            cantidad: aplicada.cantidad,
            ubicacionDestinoId: dto.ubicacionId,
            referenciaTipo: 'reversion_devolucion_compra',
            referenciaId: devolucion.id,
            motivo: 'Reversión automática por falla al procesar otro ítem de la misma devolución',
          },
          usuarioId,
        );
      }
      await this.prisma.devolucionCompra.delete({ where: { id: devolucion.id } });
      throw error;
    }

    // Si está asociada a una factura, el monto devuelto reduce el saldo pendiente (nota de crédito).
    if (factura) {
      const nuevoSaldo = Math.max(0, Number(factura.saldoPendiente) - montoTotal);
      await this.prisma.facturaCompra.update({
        where: { id: factura.id },
        data: {
          saldoPendiente: nuevoSaldo,
          estado: nuevoSaldo <= 0.01 ? 'pagada' : factura.estado === 'vencida' ? 'vencida' : 'parcial',
        },
      });
    }

    return this.obtener(devolucion.id);
  }

  async obtener(id: string) {
    const devolucion = await this.prisma.devolucionCompra.findUnique({
      where: { id },
      include: { items: { include: { producto: true } }, proveedor: true, facturaCompra: true },
    });
    if (!devolucion) throw new NotFoundException('Devolución no encontrada');
    return devolucion;
  }

  async listar(filtros: { proveedorId?: string }) {
    return this.prisma.devolucionCompra.findMany({
      where: { proveedorId: filtros.proveedorId },
      include: { items: true, proveedor: true },
      orderBy: { creadoEn: 'desc' },
    });
  }
}
