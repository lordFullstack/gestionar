import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import { BitacoraService } from '../shared/bitacora.service';
import { RegistrarMovimientoDto } from './dto/producto.dto';

@Injectable()
export class MovimientosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacoraService: BitacoraService,
  ) {}

  // Punto único de entrada para TODOS los movimientos de inventario, sin
  // importar el módulo que los origine (POS, Compras, ajustes manuales).
  // Instrumentar aquí la bitácora cubre automáticamente a todos esos
  // orígenes sin duplicar la escritura en cada módulo llamador.
  async registrar(dto: RegistrarMovimientoDto, usuarioId: string) {
    const producto = await this.prisma.producto.findUnique({ where: { id: dto.productoId } });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    let movimiento;
    switch (dto.tipo) {
      case 'entrada':
        if (!dto.ubicacionDestinoId) throw new BadRequestException('La entrada requiere ubicacionDestinoId');
        movimiento = await this.ejecutarEntrada(dto, usuarioId);
        break;

      case 'salida':
      case 'ajuste_negativo':
        if (!dto.ubicacionOrigenId) throw new BadRequestException(`${dto.tipo} requiere ubicacionOrigenId`);
        movimiento = await this.ejecutarSalida(dto, usuarioId);
        break;

      case 'ajuste_positivo':
        if (!dto.ubicacionOrigenId) throw new BadRequestException('El ajuste positivo requiere ubicacionOrigenId (la ubicación ajustada)');
        movimiento = await this.ejecutarAjustePositivo(dto, usuarioId);
        break;

      case 'transferencia':
        if (!dto.ubicacionOrigenId || !dto.ubicacionDestinoId) {
          throw new BadRequestException('La transferencia requiere ubicacionOrigenId y ubicacionDestinoId');
        }
        movimiento = await this.ejecutarTransferencia(dto, usuarioId);
        break;

      default:
        throw new BadRequestException('Tipo de movimiento no soportado');
    }

    await this.bitacoraService.registrar({
      usuarioId,
      accion: dto.tipo,
      modulo: 'inventario',
      entidadId: movimiento.id,
      detalle: {
        productoId: dto.productoId,
        cantidad: dto.cantidad,
        referenciaTipo: dto.referenciaTipo,
        referenciaId: dto.referenciaId,
      },
    });

    return movimiento;
  }

  private async ejecutarEntrada(dto: RegistrarMovimientoDto, usuarioId: string) {
    return this.prisma.$transaction(async (tx) => {
      const movimiento = await tx.movimientoInventario.create({
        data: {
          productoId: dto.productoId,
          tipo: 'entrada',
          cantidad: dto.cantidad,
          costoUnitario: dto.costoUnitario,
          ubicacionDestinoId: dto.ubicacionDestinoId,
          referenciaTipo: dto.referenciaTipo,
          referenciaId: dto.referenciaId,
          motivo: dto.motivo,
          usuarioId,
        },
      });

      await this.sumarStock(tx, dto.productoId, dto.ubicacionDestinoId!, dto.cantidad);
      return movimiento;
    });
  }

  private async ejecutarSalida(dto: RegistrarMovimientoDto, usuarioId: string) {
    return this.prisma.$transaction(async (tx) => {
      const stockActual = await tx.stockUbicacion.findUnique({
        where: { productoId_ubicacionId: { productoId: dto.productoId, ubicacionId: dto.ubicacionOrigenId! } },
      });

      const disponible = stockActual?.cantidad ?? 0;
      if (disponible < dto.cantidad) {
        throw new BadRequestException(
          `Stock insuficiente: disponible ${disponible}, se intentó descontar ${dto.cantidad}`,
        );
      }

      const movimiento = await tx.movimientoInventario.create({
        data: {
          productoId: dto.productoId,
          tipo: dto.tipo,
          cantidad: dto.cantidad,
          costoUnitario: dto.costoUnitario,
          ubicacionOrigenId: dto.ubicacionOrigenId,
          referenciaTipo: dto.referenciaTipo,
          referenciaId: dto.referenciaId,
          motivo: dto.motivo,
          usuarioId,
        },
      });

      await this.restarStock(tx, dto.productoId, dto.ubicacionOrigenId!, dto.cantidad);
      return movimiento;
    });
  }

  private async ejecutarAjustePositivo(dto: RegistrarMovimientoDto, usuarioId: string) {
    return this.prisma.$transaction(async (tx) => {
      const movimiento = await tx.movimientoInventario.create({
        data: {
          productoId: dto.productoId,
          tipo: 'ajuste_positivo',
          cantidad: dto.cantidad,
          ubicacionOrigenId: dto.ubicacionOrigenId,
          referenciaTipo: dto.referenciaTipo ?? 'ajuste_manual',
          motivo: dto.motivo,
          usuarioId,
        },
      });
      await this.sumarStock(tx, dto.productoId, dto.ubicacionOrigenId!, dto.cantidad);
      return movimiento;
    });
  }

  private async ejecutarTransferencia(dto: RegistrarMovimientoDto, usuarioId: string) {
    return this.prisma.$transaction(async (tx) => {
      const stockOrigen = await tx.stockUbicacion.findUnique({
        where: { productoId_ubicacionId: { productoId: dto.productoId, ubicacionId: dto.ubicacionOrigenId! } },
      });
      const disponible = stockOrigen?.cantidad ?? 0;
      if (disponible < dto.cantidad) {
        throw new BadRequestException(
          `Stock insuficiente en la ubicación de origen: disponible ${disponible}, se intentó transferir ${dto.cantidad}`,
        );
      }

      const movimiento = await tx.movimientoInventario.create({
        data: {
          productoId: dto.productoId,
          tipo: 'transferencia',
          cantidad: dto.cantidad,
          ubicacionOrigenId: dto.ubicacionOrigenId,
          ubicacionDestinoId: dto.ubicacionDestinoId,
          motivo: dto.motivo,
          usuarioId,
        },
      });

      await this.restarStock(tx, dto.productoId, dto.ubicacionOrigenId!, dto.cantidad);
      await this.sumarStock(tx, dto.productoId, dto.ubicacionDestinoId!, dto.cantidad);
      return movimiento;
    });
  }

  private async sumarStock(tx: any, productoId: string, ubicacionId: string, cantidad: number) {
    await tx.stockUbicacion.upsert({
      where: { productoId_ubicacionId: { productoId, ubicacionId } },
      update: { cantidad: { increment: cantidad } },
      create: { productoId, ubicacionId, cantidad },
    });
  }

  private async restarStock(tx: any, productoId: string, ubicacionId: string, cantidad: number) {
    await tx.stockUbicacion.update({
      where: { productoId_ubicacionId: { productoId, ubicacionId } },
      data: { cantidad: { decrement: cantidad } },
    });
  }

  // Kardex de un producto — historial completo ordenado
  async kardex(productoId: string) {
    return this.prisma.movimientoInventario.findMany({
      where: { productoId },
      include: { ubicacionOrigen: true, ubicacionDestino: true },
      orderBy: { creadoEn: 'desc' },
    });
  }
}
