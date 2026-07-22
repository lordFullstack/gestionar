import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import { BitacoraService } from '../shared/bitacora.service';
import { CrearOrdenCompraDto, ActualizarOrdenCompraDto } from './dto/ordenes-compra.dto';

@Injectable()
export class OrdenesCompraService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacoraService: BitacoraService,
  ) {}

  async crear(dto: CrearOrdenCompraDto, usuarioId: string) {
    const proveedor = await this.prisma.proveedor.findUnique({ where: { id: dto.proveedorId } });
    if (!proveedor || !proveedor.activo) throw new NotFoundException('Proveedor no encontrado o inactivo');

    const items = dto.items.map((i) => ({
      productoId: i.productoId,
      cantidadSolicitada: i.cantidadSolicitada,
      costoUnitario: i.costoUnitario,
      subtotal: i.cantidadSolicitada * i.costoUnitario,
    }));
    const subtotal = items.reduce((s, i) => s + i.subtotal, 0);

    return this.prisma.ordenCompra.create({
      data: {
        proveedorId: dto.proveedorId,
        fechaEntregaEsperada: dto.fechaEntregaEsperada ? new Date(dto.fechaEntregaEsperada) : undefined,
        observaciones: dto.observaciones,
        creadoPor: usuarioId,
        subtotal,
        total: subtotal, // el impuesto real se factura al recibir la factura del proveedor
        items: { create: items },
      },
      include: { items: true, proveedor: true },
    });
  }

  async listar(filtros: { estado?: string; proveedorId?: string }) {
    return this.prisma.ordenCompra.findMany({
      where: { estado: filtros.estado, proveedorId: filtros.proveedorId },
      include: { proveedor: true, items: true },
      orderBy: { creadoEn: 'desc' },
    });
  }

  async obtener(id: string) {
    const orden = await this.prisma.ordenCompra.findUnique({
      where: { id },
      include: {
        proveedor: true,
        items: { include: { producto: true } },
        recepciones: { include: { items: true } },
        facturas: true,
      },
    });
    if (!orden) throw new NotFoundException('Orden de compra no encontrada');
    return orden;
  }

  private async obtenerEditable(id: string) {
    const orden = await this.obtener(id);
    if (orden.estado !== 'borrador') {
      throw new BadRequestException('Solo se puede modificar una orden en estado "borrador"');
    }
    return orden;
  }

  async actualizar(id: string, dto: ActualizarOrdenCompraDto) {
    await this.obtenerEditable(id);

    return this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.ordenCompraItem.deleteMany({ where: { ordenCompraId: id } });
        const items = dto.items.map((i) => ({
          ordenCompraId: id,
          productoId: i.productoId,
          cantidadSolicitada: i.cantidadSolicitada,
          costoUnitario: i.costoUnitario,
          subtotal: i.cantidadSolicitada * i.costoUnitario,
        }));
        await tx.ordenCompraItem.createMany({ data: items });
        const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
        await tx.ordenCompra.update({ where: { id }, data: { subtotal, total: subtotal } });
      }

      return tx.ordenCompra.update({
        where: { id },
        data: {
          fechaEntregaEsperada: dto.fechaEntregaEsperada ? new Date(dto.fechaEntregaEsperada) : undefined,
          observaciones: dto.observaciones,
        },
        include: { items: true },
      });
    });
  }

  async enviar(id: string) {
    await this.obtenerEditable(id);
    return this.prisma.ordenCompra.update({ where: { id }, data: { estado: 'enviada' } });
  }

  async aprobar(id: string, usuarioId: string) {
    const orden = await this.obtener(id);
    if (!['borrador', 'enviada'].includes(orden.estado)) {
      throw new BadRequestException(`No se puede aprobar una orden en estado "${orden.estado}"`);
    }
    const aprobada = await this.prisma.ordenCompra.update({
      where: { id },
      data: { estado: 'aprobada', aprobadoPor: usuarioId, fechaAprobacion: new Date() },
    });

    await this.bitacoraService.registrar({
      usuarioId,
      accion: 'aprobar',
      modulo: 'compras',
      entidadId: id,
      detalle: { total: orden.total, proveedorId: orden.proveedorId },
    });

    return aprobada;
  }

  async anular(id: string, usuarioId: string, motivo?: string) {
    const orden = await this.obtener(id);
    if (['recibida_parcial', 'recibida_total'].includes(orden.estado)) {
      throw new BadRequestException(
        'No se puede anular una orden que ya tiene recepciones registradas. Use una devolución al proveedor.',
      );
    }
    const anulada = await this.prisma.ordenCompra.update({
      where: { id },
      data: { estado: 'anulada', motivoAnulacion: motivo },
    });

    await this.bitacoraService.registrar({
      usuarioId,
      accion: 'anular_orden',
      modulo: 'compras',
      entidadId: id,
      detalle: { motivo },
    });

    return anulada;
  }

  // Usado internamente por RecepcionesService tras cada recepción, dentro de su propia transacción.
  async recalcularEstadoTrasRecepcion(tx: any, ordenCompraId: string) {
    const items = await tx.ordenCompraItem.findMany({ where: { ordenCompraId } });
    const totalSolicitado = items.reduce((s: number, i: any) => s + i.cantidadSolicitada, 0);
    const totalRecibido = items.reduce((s: number, i: any) => s + i.cantidadRecibida, 0);

    const estado = totalRecibido === 0 ? 'aprobada' : totalRecibido < totalSolicitado ? 'recibida_parcial' : 'recibida_total';

    await tx.ordenCompra.update({ where: { id: ordenCompraId }, data: { estado } });
  }
}
