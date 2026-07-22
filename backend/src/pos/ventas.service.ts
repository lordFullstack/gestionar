import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import { BitacoraService } from '../shared/bitacora.service';
import { MovimientosService } from '../inventario/movimientos.service';
import { CajaService } from '../caja/caja.service';
import { ContabilidadService, LineaAsientoInterna } from '../contabilidad/contabilidad.service';
import { CrearVentaDto, AbonarVentaDto, CrearDevolucionDto } from './dto/pos.dto';

@Injectable()
export class VentasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly movimientosService: MovimientosService,
    private readonly cajaService: CajaService,
    private readonly bitacoraService: BitacoraService,
    private readonly contabilidadService: ContabilidadService,
  ) {}

  async listar(filtro?: { estado?: string; desde?: Date; hasta?: Date }) {
    return this.prisma.venta.findMany({
      where: {
        estado: filtro?.estado,
        creadoEn: { gte: filtro?.desde, lte: filtro?.hasta },
      },
      include: { items: true, pagos: true, cliente: true },
      orderBy: { creadoEn: 'desc' },
    });
  }

  async obtener(id: string) {
    const venta = await this.prisma.venta.findUnique({
      where: { id },
      include: { items: { include: { producto: true } }, pagos: true, cliente: true, devoluciones: true },
    });
    if (!venta) throw new NotFoundException('Venta no encontrada');
    return venta;
  }

  // Usado para reimpresión — misma forma que el recibo original
  async reimprimir(id: string) {
    return this.obtener(id);
  }

  async crear(dto: CrearVentaDto, usuarioId: string) {
    const tipo = dto.tipo ?? 'venta';
    if (dto.items.length === 0) throw new BadRequestException('La venta debe tener al menos un producto');

    const subtotal = dto.items.reduce((s, i) => s + i.cantidad * i.precioUnitario, 0);
    const descuentoTotal = dto.items.reduce((s, i) => s + (i.descuento ?? 0), 0);
    const impuesto = dto.impuesto ?? 0;
    const total = Math.round((subtotal - descuentoTotal + impuesto) * 100) / 100;

    let caja: { id: string } | null = null;
    if (tipo !== 'cotizacion') {
      caja = await this.cajaService.obtenerCajaAbierta(usuarioId);
    }

    const sumaPagos = (dto.pagos ?? []).reduce((s, p) => s + p.monto, 0);

    if (tipo === 'venta' && sumaPagos < total) {
      throw new BadRequestException(`Pago insuficiente: total ${total}, recibido ${sumaPagos}`);
    }
    if (tipo === 'apartado' && sumaPagos <= 0) {
      throw new BadRequestException('El apartado requiere al menos un abono inicial');
    }

    const estado = tipo === 'cotizacion' ? 'pendiente' : sumaPagos >= total ? 'completada' : 'pendiente';

    // 1. Crear venta + items (atómico)
    const venta = await this.prisma.venta.create({
      data: {
        tipo,
        estado,
        clienteId: dto.clienteId,
        vendedorId: usuarioId,
        cajaId: caja?.id,
        ubicacionId: tipo !== 'cotizacion' ? dto.ubicacionId : null,
        subtotal,
        descuentoTotal,
        impuesto,
        total,
        items: {
          create: dto.items.map((i) => ({
            productoId: i.productoId,
            cantidad: i.cantidad,
            precioUnitario: i.precioUnitario,
            descuento: i.descuento ?? 0,
            subtotal: i.cantidad * i.precioUnitario - (i.descuento ?? 0),
          })),
        },
      },
      include: { items: true },
    });

    // 2. Descontar stock (venta y apartado reservan stock; cotización no)
    if (tipo !== 'cotizacion') {
      const movimientosOk: string[] = [];
      try {
        for (const item of venta.items) {
          await this.movimientosService.registrar(
            {
              productoId: item.productoId,
              tipo: 'salida',
              cantidad: item.cantidad,
              ubicacionOrigenId: dto.ubicacionId,
              referenciaTipo: 'venta',
              referenciaId: venta.id,
            },
            usuarioId,
          );
          movimientosOk.push(item.productoId);
        }
      } catch (error) {
        // Compensar lo ya descontado y anular la venta para no dejar inconsistencias
        for (const productoId of movimientosOk) {
          const item = venta.items.find((i) => i.productoId === productoId)!;
          await this.movimientosService.registrar(
            {
              productoId,
              tipo: 'ajuste_positivo',
              cantidad: item.cantidad,
              ubicacionOrigenId: dto.ubicacionId,
              referenciaTipo: 'reversion_venta',
              referenciaId: venta.id,
              motivo: 'Reversión automática por falla de stock en otro ítem',
            },
            usuarioId,
          );
        }
        await this.prisma.venta.update({ where: { id: venta.id }, data: { estado: 'anulada' } });
        throw error;
      }
    }

    // 3. Registrar pagos y su reflejo en caja
    for (const pago of dto.pagos ?? []) {
      await this.prisma.pagoVenta.create({
        data: { ventaId: venta.id, metodo: pago.metodo, monto: pago.monto, referencia: pago.referencia },
      });
      if (caja) {
        await this.cajaService.registrarMovimiento(caja.id, 'venta', pago.monto, usuarioId, {
          metodo: pago.metodo,
          referenciaTipo: 'venta',
          referenciaId: venta.id,
        });
      }
    }

    const vuelto = tipo === 'venta' && sumaPagos > total ? Math.round((sumaPagos - total) * 100) / 100 : 0;

    await this.bitacoraService.registrar({
      usuarioId,
      accion: 'crear',
      modulo: 'pos',
      entidadId: venta.id,
      detalle: { tipo, total, estado },
    });

    if (tipo !== 'cotizacion') {
      await this.generarAsientoVenta(venta.id, usuarioId);
    }

    return { ...(await this.obtener(venta.id)), vuelto };
  }

  // Genera el asiento contable de una venta/apartado ya confirmado (no
  // aplica a cotizaciones, que no tienen efecto financiero real). Se llama
  // DESPUÉS de que la venta ya se dio por exitosa, así que un fallo aquí no
  // debe tumbar la venta — solo se registra en consola para revisión manual
  // (mismo criterio que ya usa este módulo con el reflejo en caja).
  private async generarAsientoVenta(ventaId: string, usuarioId: string) {
    try {
      const venta = await this.prisma.venta.findUnique({
        where: { id: ventaId },
        include: { items: { include: { producto: true } }, pagos: true },
      });
      if (!venta) return;

      const total = Number(venta.total);
      const subtotalNeto = Math.round((Number(venta.subtotal) - Number(venta.descuentoTotal)) * 100) / 100;
      const impuesto = Number(venta.impuesto);
      const sumaPagos = venta.pagos.reduce((s, p) => s + Number(p.monto), 0);
      const cobrado = venta.tipo === 'venta' ? total : Math.min(sumaPagos, total);
      const pendiente = Math.max(Math.round((total - cobrado) * 100) / 100, 0);
      const costoTotal =
        Math.round(venta.items.reduce((s, i) => s + i.cantidad * Number(i.producto.precioCosto), 0) * 100) / 100;

      const detalles: LineaAsientoInterna[] = [];
      if (cobrado > 0) detalles.push({ cuentaCodigo: '1105', debito: cobrado, descripcion: 'Cobrado en caja' });
      if (pendiente > 0) detalles.push({ cuentaCodigo: '1305', debito: pendiente, descripcion: 'Saldo a crédito (apartado)' });
      if (subtotalNeto > 0) detalles.push({ cuentaCodigo: '4135', credito: subtotalNeto, descripcion: 'Venta neta' });
      if (impuesto > 0) detalles.push({ cuentaCodigo: '4135', credito: impuesto, descripcion: 'IVA' });
      if (costoTotal > 0) {
        detalles.push({ cuentaCodigo: '6135', debito: costoTotal, descripcion: 'Costo de venta' });
        detalles.push({ cuentaCodigo: '1435', credito: costoTotal, descripcion: 'Salida de inventario' });
      }
      if (detalles.length === 0) return;

      await this.contabilidadService.registrarAsiento({
        concepto: `Venta #${venta.numero}`,
        origen: 'venta',
        origenId: venta.id,
        usuarioId,
        detalles,
      });
    } catch (error) {
      console.error(`[Contabilidad] No se pudo generar el asiento automático de la venta ${ventaId}:`, error);
    }
  }

  // Busca el asiento generado por generarAsientoVenta() y lo revierte con
  // el mecanismo estándar de Contabilidad (crea la contrapartida, marca el
  // original como anulado). Si no hay asiento (falló al crearse, o era una
  // cotización), no hace nada.
  private async reversarAsientoVenta(ventaId: string, usuarioId: string, motivo?: string) {
    try {
      const asiento = await this.prisma.asientoContable.findFirst({
        where: { origen: 'venta', origenId: ventaId, estado: 'activo' },
      });
      if (!asiento) return;
      await this.contabilidadService.anularAsiento(asiento.id, usuarioId, motivo ?? 'Venta anulada');
    } catch (error) {
      console.error(`[Contabilidad] No se pudo reversar el asiento de la venta ${ventaId}:`, error);
    }
  }

  // Abono adicional sobre un apartado existente
  async abonar(ventaId: string, dto: AbonarVentaDto, usuarioId: string) {
    const venta = await this.obtener(ventaId);
    if (venta.tipo !== 'apartado') throw new BadRequestException('Solo los apartados aceptan abonos');
    if (venta.estado === 'anulada') throw new BadRequestException('La venta está anulada');
    if (venta.estado === 'completada') throw new BadRequestException('El apartado ya está completamente pagado');

    const caja = await this.cajaService.obtenerCajaAbierta(usuarioId);
    const nuevoAbono = dto.pagos.reduce((s, p) => s + p.monto, 0);
    const pagadoPrevio = venta.pagos.reduce((s, p) => s + Number(p.monto), 0);
    const pagadoTotal = pagadoPrevio + nuevoAbono;

    for (const pago of dto.pagos) {
      await this.prisma.pagoVenta.create({
        data: { ventaId, metodo: pago.metodo, monto: pago.monto, referencia: pago.referencia },
      });
      await this.cajaService.registrarMovimiento(caja.id, 'venta', pago.monto, usuarioId, {
        metodo: pago.metodo,
        referenciaTipo: 'abono_apartado',
        referenciaId: ventaId,
      });
    }

    const nuevoEstado = pagadoTotal >= Number(venta.total) ? 'completada' : 'pendiente';
    await this.prisma.venta.update({ where: { id: ventaId }, data: { estado: nuevoEstado } });

    return this.obtener(ventaId);
  }

  // Convierte una cotización en venta real: descuenta stock y registra pagos
  async convertirCotizacion(ventaId: string, ubicacionId: string, pagos: { metodo: string; monto: number; referencia?: string }[], usuarioId: string) {
    const venta = await this.obtener(ventaId);
    if (venta.tipo !== 'cotizacion') throw new BadRequestException('Solo las cotizaciones se pueden convertir');
    if (venta.estado !== 'pendiente') throw new BadRequestException('La cotización ya fue procesada');

    const sumaPagos = pagos.reduce((s, p) => s + p.monto, 0);
    if (sumaPagos < Number(venta.total)) {
      throw new BadRequestException(`Pago insuficiente: total ${venta.total}, recibido ${sumaPagos}`);
    }

    const caja = await this.cajaService.obtenerCajaAbierta(usuarioId);

    for (const item of venta.items) {
      await this.movimientosService.registrar(
        {
          productoId: item.productoId,
          tipo: 'salida',
          cantidad: item.cantidad,
          ubicacionOrigenId: ubicacionId,
          referenciaTipo: 'venta',
          referenciaId: venta.id,
        },
        usuarioId,
      );
    }

    for (const pago of pagos) {
      await this.prisma.pagoVenta.create({
        data: { ventaId, metodo: pago.metodo as any, monto: pago.monto, referencia: pago.referencia },
      });
      await this.cajaService.registrarMovimiento(caja.id, 'venta', pago.monto, usuarioId, {
        metodo: pago.metodo,
        referenciaTipo: 'venta',
        referenciaId: ventaId,
      });
    }

    await this.prisma.venta.update({
      where: { id: ventaId },
      data: { tipo: 'venta', estado: 'completada', cajaId: caja.id },
    });

    return this.obtener(ventaId);
  }

  async anular(ventaId: string, usuarioId: string, motivo?: string) {
    const venta = await this.obtener(ventaId);
    if (venta.estado === 'anulada') throw new BadRequestException('La venta ya está anulada');

    // Revertir stock si ya se había descontado (venta y apartado, no cotización)
    if (venta.tipo !== 'cotizacion') {
      if (!venta.ubicacionId) {
        throw new BadRequestException('La venta no tiene ubicación de origen registrada; no se puede revertir stock automáticamente');
      }
      for (const item of venta.items) {
        const disponibleParaRevertir = item.cantidad - item.cantidadDevuelta;
        if (disponibleParaRevertir > 0) {
          await this.movimientosService.registrar(
            {
              productoId: item.productoId,
              tipo: 'ajuste_positivo',
              cantidad: disponibleParaRevertir,
              ubicacionOrigenId: venta.ubicacionId,
              referenciaTipo: 'anulacion_venta',
              referenciaId: venta.id,
              motivo: motivo ?? 'Venta anulada',
            },
            usuarioId,
          );
        }
      }
    }

    // Reembolsar en caja lo cobrado
    if (venta.cajaId) {
      const totalCobrado = venta.pagos.reduce((s, p) => s + Number(p.monto), 0);
      if (totalCobrado > 0) {
        await this.cajaService.registrarMovimiento(venta.cajaId, 'venta', -totalCobrado, usuarioId, {
          referenciaTipo: 'anulacion_venta',
          referenciaId: venta.id,
          motivo: 'Reembolso por anulación',
        });
      }
    }

    await this.prisma.venta.update({ where: { id: ventaId }, data: { estado: 'anulada' } });

    await this.reversarAsientoVenta(ventaId, usuarioId, motivo);

    await this.bitacoraService.registrar({
      usuarioId,
      accion: 'anular',
      modulo: 'pos',
      entidadId: ventaId,
      detalle: { motivo },
    });

    return { ok: true };
  }

  async crearDevolucion(dto: CrearDevolucionDto, usuarioId: string, ubicacionId: string) {
    const venta = await this.obtener(dto.ventaId);
    if (venta.estado !== 'completada') throw new BadRequestException('Solo se pueden devolver ventas completadas');

    const devolucion = await this.prisma.devolucionVenta.create({
      data: { ventaId: venta.id, motivo: dto.motivo, usuarioId },
    });

    let montoTotalDevuelto = 0;
    let costoTotalDevuelto = 0;

    for (const itemDto of dto.items) {
      const ventaItem = venta.items.find((i) => i.id === itemDto.ventaItemId);
      if (!ventaItem) throw new NotFoundException(`Ítem ${itemDto.ventaItemId} no pertenece a esta venta`);

      const disponible = ventaItem.cantidad - ventaItem.cantidadDevuelta;
      if (itemDto.cantidad > disponible) {
        throw new BadRequestException(
          `No se puede devolver ${itemDto.cantidad} de "${ventaItem.productoId}": solo quedan ${disponible} disponibles para devolución`,
        );
      }

      const montoItem = Math.round((Number(ventaItem.precioUnitario) * itemDto.cantidad) * 100) / 100;
      montoTotalDevuelto += montoItem;
      costoTotalDevuelto += itemDto.cantidad * Number(ventaItem.producto.precioCosto);

      await this.prisma.devolucionItem.create({
        data: { devolucionId: devolucion.id, ventaItemId: ventaItem.id, cantidad: itemDto.cantidad, monto: montoItem },
      });

      await this.prisma.ventaItem.update({
        where: { id: ventaItem.id },
        data: { cantidadDevuelta: { increment: itemDto.cantidad } },
      });

      // Reingresar stock
      await this.movimientosService.registrar(
        {
          productoId: ventaItem.productoId,
          tipo: 'entrada',
          cantidad: itemDto.cantidad,
          ubicacionDestinoId: ubicacionId,
          referenciaTipo: 'devolucion',
          referenciaId: devolucion.id,
        },
        usuarioId,
      );
    }

    // Egreso en caja por el reembolso
    if (venta.cajaId && montoTotalDevuelto > 0) {
      await this.cajaService.registrarMovimiento(venta.cajaId, 'devolucion', -montoTotalDevuelto, usuarioId, {
        referenciaTipo: 'devolucion',
        referenciaId: devolucion.id,
      });
    }

    await this.generarAsientoDevolucion(devolucion.id, venta, montoTotalDevuelto, costoTotalDevuelto, usuarioId);

    await this.bitacoraService.registrar({
      usuarioId,
      accion: 'crear_devolucion',
      modulo: 'pos',
      entidadId: devolucion.id,
      detalle: { ventaId: venta.id, montoTotalDevuelto },
    });

    return this.prisma.devolucionVenta.findUnique({ where: { id: devolucion.id }, include: { items: true } });
  }

  // Devolución parcial: revierte proporcionalmente el ingreso y el costo
  // de venta de los ítems devueltos. Usa las mismas cuentas que la venta
  // original (en dirección contraria) en vez de una cuenta de "devoluciones"
  // separada, para mantener el plan de cuentas mínimo.
  private async generarAsientoDevolucion(
    devolucionId: string,
    venta: { id: string; numero: number; cajaId: string | null },
    montoTotalDevuelto: number,
    costoTotalDevuelto: number,
    usuarioId: string,
  ) {
    try {
      if (montoTotalDevuelto <= 0 && costoTotalDevuelto <= 0) return;
      if (!venta.cajaId) {
        console.warn(
          `[Contabilidad] Devolución ${devolucionId}: la venta ${venta.id} no tiene caja asociada, no se genera asiento automático.`,
        );
        return;
      }

      const monto = Math.round(montoTotalDevuelto * 100) / 100;
      const costo = Math.round(costoTotalDevuelto * 100) / 100;

      const detalles: LineaAsientoInterna[] = [];
      if (monto > 0) {
        detalles.push({ cuentaCodigo: '4135', debito: monto, descripcion: 'Reversión de venta por devolución' });
        detalles.push({ cuentaCodigo: '1105', credito: monto, descripcion: 'Reembolso al cliente' });
      }
      if (costo > 0) {
        detalles.push({ cuentaCodigo: '1435', debito: costo, descripcion: 'Reingreso de inventario' });
        detalles.push({ cuentaCodigo: '6135', credito: costo, descripcion: 'Reversión de costo de venta' });
      }
      if (detalles.length === 0) return;

      await this.contabilidadService.registrarAsiento({
        concepto: `Devolución sobre venta #${venta.numero}`,
        origen: 'venta',
        origenId: devolucionId,
        usuarioId,
        detalles,
      });
    } catch (error) {
      console.error(`[Contabilidad] No se pudo generar el asiento automático de la devolución ${devolucionId}:`, error);
    }
  }
}
