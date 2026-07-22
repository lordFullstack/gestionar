import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import { BitacoraService } from '../shared/bitacora.service';
import { CajaService } from '../caja/caja.service';
import { ContabilidadService } from '../contabilidad/contabilidad.service';
import { CrearFacturaCompraDto, CrearPagoCompraDto } from './dto/facturas-compra.dto';

@Injectable()
export class FacturasCompraService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cajaService: CajaService,
    private readonly bitacoraService: BitacoraService,
    private readonly contabilidadService: ContabilidadService,
  ) {}

  async crear(dto: CrearFacturaCompraDto, usuarioId: string) {
    const proveedor = await this.prisma.proveedor.findUnique({ where: { id: dto.proveedorId } });
    if (!proveedor) throw new NotFoundException('Proveedor no encontrado');

    if (dto.ordenCompraId) {
      const orden = await this.prisma.ordenCompra.findUnique({ where: { id: dto.ordenCompraId } });
      if (!orden) throw new NotFoundException('Orden de compra no encontrada');
    }

    const existente = await this.prisma.facturaCompra.findUnique({
      where: { proveedorId_numeroFactura: { proveedorId: dto.proveedorId, numeroFactura: dto.numeroFactura } },
    });
    if (existente) throw new BadRequestException('Ya existe una factura registrada con ese número para este proveedor');

    const factura = await this.prisma.facturaCompra.create({
      data: {
        proveedorId: dto.proveedorId,
        ordenCompraId: dto.ordenCompraId,
        numeroFactura: dto.numeroFactura,
        fechaEmision: dto.fechaEmision ? new Date(dto.fechaEmision) : new Date(),
        fechaVencimiento: dto.fechaVencimiento ? new Date(dto.fechaVencimiento) : undefined,
        subtotal: dto.subtotal,
        impuesto: dto.impuesto ?? 0,
        total: dto.total,
        saldoPendiente: dto.total,
        observaciones: dto.observaciones,
        usuarioId,
      },
    });

    await this.generarAsientoFactura(factura.id, dto.total, dto.numeroFactura, usuarioId);

    return factura;
  }

  // Débito Inventario / Crédito CxP proveedores por el total de la factura
  // (el IVA se capitaliza al costo de inventario en este plan de cuentas
  // simplificado, ya que no hay una cuenta separada de IVA descontable).
  private async generarAsientoFactura(facturaId: string, total: number, numeroFactura: string, usuarioId: string) {
    try {
      const monto = Math.round(total * 100) / 100;
      if (monto <= 0) return;

      await this.contabilidadService.registrarAsiento({
        concepto: `Factura de compra ${numeroFactura}`,
        origen: 'compra',
        origenId: facturaId,
        usuarioId,
        detalles: [
          { cuentaCodigo: '1435', debito: monto, descripcion: 'Inventario recibido' },
          { cuentaCodigo: '2205', credito: monto, descripcion: 'CxP proveedor' },
        ],
      });
    } catch (error) {
      console.error(`[Contabilidad] No se pudo generar el asiento automático de la factura ${facturaId}:`, error);
    }
  }

  async listar(filtros: { estado?: string; proveedorId?: string }) {
    await this.marcarVencidas();
    return this.prisma.facturaCompra.findMany({
      where: { estado: filtros.estado, proveedorId: filtros.proveedorId },
      include: { proveedor: true, pagos: true },
      orderBy: { creadoEn: 'desc' },
    });
  }

  async obtener(id: string) {
    const factura = await this.prisma.facturaCompra.findUnique({
      where: { id },
      include: {
        proveedor: true,
        pagos: { orderBy: { creadoEn: 'desc' } },
        devoluciones: { include: { items: true } },
        ordenCompra: true,
      },
    });
    if (!factura) throw new NotFoundException('Factura de compra no encontrada');
    return factura;
  }

  async anular(id: string, usuarioId: string) {
    const factura = await this.obtener(id);
    if (factura.pagos.length > 0) {
      throw new BadRequestException('No se puede anular una factura que ya tiene pagos registrados');
    }
    const anulada = await this.prisma.facturaCompra.update({ where: { id }, data: { estado: 'anulada' } });

    await this.reversarAsientoFactura(id, usuarioId);

    await this.bitacoraService.registrar({
      usuarioId,
      accion: 'anular_factura',
      modulo: 'compras',
      entidadId: id,
      detalle: { proveedorId: factura.proveedorId, numeroFactura: factura.numeroFactura },
    });

    return anulada;
  }

  // Nota: los asientos de "factura registrada" y de "pago" comparten
  // origen='compra' + origenId=facturaId. Esto es seguro porque anular()
  // ya bloquea facturas con pagos registrados, así que en el momento en
  // que esta función corre solo puede existir el asiento de registro.
  private async reversarAsientoFactura(facturaId: string, usuarioId: string) {
    try {
      const asiento = await this.prisma.asientoContable.findFirst({
        where: { origen: 'compra', origenId: facturaId, estado: 'activo' },
      });
      if (!asiento) return;
      await this.contabilidadService.anularAsiento(asiento.id, usuarioId, 'Factura de compra anulada');
    } catch (error) {
      console.error(`[Contabilidad] No se pudo reversar el asiento de la factura ${facturaId}:`, error);
    }
  }

  async pagar(id: string, dto: CrearPagoCompraDto, usuarioId: string) {
    const factura = await this.obtener(id);
    if (['pagada', 'anulada'].includes(factura.estado)) {
      throw new BadRequestException(`No se puede registrar un pago sobre una factura en estado "${factura.estado}"`);
    }
    if (dto.monto > Number(factura.saldoPendiente)) {
      throw new BadRequestException(`El pago (${dto.monto}) excede el saldo pendiente (${factura.saldoPendiente})`);
    }

    const pago = await this.prisma.$transaction(async (tx) => {
      const nuevoPago = await tx.pagoCompra.create({
        data: { facturaCompraId: id, monto: dto.monto, metodo: dto.metodo, referencia: dto.referencia, usuarioId },
      });

      const nuevoSaldo = Number(factura.saldoPendiente) - dto.monto;
      await tx.facturaCompra.update({
        where: { id },
        data: {
          saldoPendiente: nuevoSaldo,
          estado: nuevoSaldo <= 0.01 ? 'pagada' : 'parcial',
        },
      });

      return nuevoPago;
    });

    // Si el pago es en efectivo y el usuario tiene caja abierta, se refleja como egreso.
    // Pagos por transferencia/cheque, o sin caja abierta (ej. Contabilidad paga desde banco),
    // quedan registrados igual pero no afectan el arqueo de caja.
    if (dto.metodo === 'efectivo') {
      try {
        const caja = await this.cajaService.obtenerCajaAbierta(usuarioId);
        await this.cajaService.registrarMovimiento(caja.id, 'pago_compra', -Math.abs(dto.monto), usuarioId, {
          metodo: dto.metodo,
          referenciaTipo: 'factura_compra',
          referenciaId: id,
          motivo: `Pago a proveedor - factura ${factura.numeroFactura}`,
        });
      } catch {
        // Sin caja abierta: se omite el reflejo en caja, no se bloquea el pago.
      }
    }

    await this.bitacoraService.registrar({
      usuarioId,
      accion: 'pagar',
      modulo: 'compras',
      entidadId: id,
      detalle: { monto: dto.monto, metodo: dto.metodo, numeroFactura: factura.numeroFactura },
    });

    await this.generarAsientoPago(pago.id, id, dto.monto, dto.metodo, factura.numeroFactura, usuarioId);

    return pago;
  }

  // Débito CxP proveedores / Crédito Caja o Bancos, según el método de
  // pago (efectivo -> Caja general; cualquier otro método -> Bancos).
  private async generarAsientoPago(
    pagoId: string,
    facturaId: string,
    monto: number,
    metodo: string,
    numeroFactura: string,
    usuarioId: string,
  ) {
    try {
      const cantidad = Math.round(monto * 100) / 100;
      if (cantidad <= 0) return;
      const cuentaOrigen = metodo === 'efectivo' ? '1105' : '1110';

      await this.contabilidadService.registrarAsiento({
        concepto: `Pago a proveedor - factura ${numeroFactura}`,
        origen: 'compra',
        origenId: facturaId,
        usuarioId,
        detalles: [
          { cuentaCodigo: '2205', debito: cantidad, descripcion: 'Pago de CxP' },
          { cuentaCodigo: cuentaOrigen, credito: cantidad, descripcion: metodo === 'efectivo' ? 'Salida de caja' : 'Salida de banco' },
        ],
      });
    } catch (error) {
      console.error(`[Contabilidad] No se pudo generar el asiento automático del pago ${pagoId}:`, error);
    }
  }

  async listarPagos(id: string) {
    await this.obtener(id);
    return this.prisma.pagoCompra.findMany({ where: { facturaCompraId: id }, orderBy: { creadoEn: 'desc' } });
  }

  // Se ejecuta al listar; en producción también conviene un cron diario.
  async marcarVencidas() {
    await this.prisma.facturaCompra.updateMany({
      where: {
        estado: { in: ['pendiente', 'parcial'] },
        fechaVencimiento: { lt: new Date() },
      },
      data: { estado: 'vencida' },
    });
  }
}
