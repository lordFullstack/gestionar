import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import { MovimientosService } from '../inventario/movimientos.service';
import { OrdenesCompraService } from './ordenes-compra.service';
import { CrearRecepcionDto } from './dto/recepciones.dto';

@Injectable()
export class RecepcionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly movimientosService: MovimientosService,
    private readonly ordenesCompraService: OrdenesCompraService,
  ) {}

  async recibir(ordenCompraId: string, dto: CrearRecepcionDto, usuarioId: string) {
    const orden = await this.prisma.ordenCompra.findUnique({
      where: { id: ordenCompraId },
      include: { items: true },
    });
    if (!orden) throw new NotFoundException('Orden de compra no encontrada');
    if (!['aprobada', 'recibida_parcial'].includes(orden.estado)) {
      throw new BadRequestException(`No se puede recibir mercadería para una orden en estado "${orden.estado}"`);
    }

    // Validar TODAS las líneas contra lo pendiente por recibir antes de tocar la base de datos.
    for (const linea of dto.items) {
      const itemOrden = orden.items.find((i) => i.id === linea.ordenCompraItemId);
      if (!itemOrden) throw new BadRequestException(`El ítem ${linea.ordenCompraItemId} no pertenece a esta orden`);
      const pendiente = itemOrden.cantidadSolicitada - itemOrden.cantidadRecibida;
      if (linea.cantidad > pendiente) {
        throw new BadRequestException(
          `Se intenta recibir ${linea.cantidad} pero solo quedan ${pendiente} unidades pendientes para el producto ${itemOrden.productoId}`,
        );
      }
    }

    const recepcion = await this.prisma.recepcionCompra.create({
      data: {
        ordenCompraId,
        ubicacionId: dto.ubicacionId,
        observaciones: dto.observaciones,
        usuarioId,
      },
    });

    // Cada línea genera su propio movimiento de entrada (MovimientosService ya es atómico por línea).
    // Si una línea falla a mitad de camino, se compensa lo ya aplicado y se anula la recepción,
    // siguiendo el mismo patrón usado en POS → Inventario.
    const lineasAplicadas: { productoId: string; cantidad: number }[] = [];
    try {
      for (const linea of dto.items) {
        const itemOrden = orden.items.find((i) => i.id === linea.ordenCompraItemId)!;
        const costo = linea.costoUnitario ?? Number(itemOrden.costoUnitario);

        const movimiento = await this.movimientosService.registrar(
          {
            productoId: itemOrden.productoId,
            tipo: 'entrada',
            cantidad: linea.cantidad,
            costoUnitario: costo,
            ubicacionDestinoId: dto.ubicacionId,
            referenciaTipo: 'recepcion_compra',
            referenciaId: recepcion.id,
            motivo: `Recepción de orden de compra #${orden.numero}`,
          },
          usuarioId,
        );

        await this.prisma.recepcionCompraItem.create({
          data: {
            recepcionId: recepcion.id,
            ordenCompraItemId: itemOrden.id,
            cantidad: linea.cantidad,
            costoUnitario: costo,
            movimientoInventarioId: movimiento.id,
          },
        });

        await this.prisma.ordenCompraItem.update({
          where: { id: itemOrden.id },
          data: { cantidadRecibida: { increment: linea.cantidad } },
        });

        lineasAplicadas.push({ productoId: itemOrden.productoId, cantidad: linea.cantidad });
      }
    } catch (error) {
      for (const aplicada of lineasAplicadas) {
        await this.movimientosService.registrar(
          {
            productoId: aplicada.productoId,
            tipo: 'salida',
            cantidad: aplicada.cantidad,
            ubicacionOrigenId: dto.ubicacionId,
            referenciaTipo: 'reversion_recepcion_compra',
            referenciaId: recepcion.id,
            motivo: 'Reversión automática por falla al recibir otro ítem de la misma recepción',
          },
          usuarioId,
        );
      }
      // Nota: las cantidadRecibida ya incrementadas para las líneas aplicadas quedan reflejadas;
      // se revierten explícitamente para que la orden vuelva a su estado real.
      for (const aplicada of lineasAplicadas) {
        const itemOrden = orden.items.find((i) => i.productoId === aplicada.productoId)!;
        await this.prisma.ordenCompraItem.update({
          where: { id: itemOrden.id },
          data: { cantidadRecibida: { decrement: aplicada.cantidad } },
        });
      }
      await this.prisma.recepcionCompra.delete({ where: { id: recepcion.id } });
      throw error;
    }

    await this.prisma.$transaction(async (tx) => {
      await this.ordenesCompraService.recalcularEstadoTrasRecepcion(tx, ordenCompraId);
    });

    return this.obtener(recepcion.id);
  }

  async obtener(id: string) {
    const recepcion = await this.prisma.recepcionCompra.findUnique({
      where: { id },
      include: {
        items: { include: { ordenCompraItem: { include: { producto: true } } } },
        ordenCompra: { include: { proveedor: true } },
      },
    });
    if (!recepcion) throw new NotFoundException('Recepción no encontrada');
    return recepcion;
  }

  async listarPorOrden(ordenCompraId: string) {
    return this.prisma.recepcionCompra.findMany({
      where: { ordenCompraId },
      include: { items: true },
      orderBy: { creadoEn: 'desc' },
    });
  }
}
