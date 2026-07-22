import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import { BitacoraService } from '../shared/bitacora.service';
import { ContabilidadService } from '../contabilidad/contabilidad.service';

@Injectable()
export class CajaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacoraService: BitacoraService,
    private readonly contabilidadService: ContabilidadService,
  ) {}

  async abrir(usuarioId: string, montoInicial: number) {
    const abiertaExistente = await this.prisma.caja.findFirst({
      where: { usuarioId, estado: 'abierta' },
    });
    if (abiertaExistente) {
      throw new BadRequestException('Ya tienes una caja abierta. Ciérrala antes de abrir otra.');
    }

    const caja = await this.prisma.caja.create({
      data: { usuarioId, montoInicial },
    });

    await this.prisma.movimientoCaja.create({
      data: { cajaId: caja.id, tipo: 'apertura', monto: montoInicial, usuarioId },
    });

    await this.bitacoraService.registrar({
      usuarioId,
      accion: 'abrir_caja',
      modulo: 'caja',
      entidadId: caja.id,
      detalle: { montoInicial },
    });

    return caja;
  }

  async obtenerCajaAbierta(usuarioId: string) {
    const caja = await this.prisma.caja.findFirst({
      where: { usuarioId, estado: 'abierta' },
      include: { movimientos: { orderBy: { creadoEn: 'desc' } } },
    });
    if (!caja) throw new NotFoundException('No tienes ninguna caja abierta');
    return caja;
  }

  // Usado internamente por el módulo POS al confirmar una venta/pago/devolución.
  // monto positivo = ingreso, negativo = egreso.
  async registrarMovimiento(
    cajaId: string,
    tipo: string,
    monto: number,
    usuarioId: string,
    opciones?: { metodo?: string; referenciaTipo?: string; referenciaId?: string; motivo?: string },
  ) {
    return this.prisma.movimientoCaja.create({
      data: {
        cajaId,
        tipo,
        monto,
        metodo: opciones?.metodo,
        referenciaTipo: opciones?.referenciaTipo,
        referenciaId: opciones?.referenciaId,
        motivo: opciones?.motivo,
        usuarioId,
      },
    });
  }

  async movimientoManual(usuarioId: string, tipo: 'ingreso_manual' | 'egreso_manual', monto: number, motivo?: string) {
    const caja = await this.obtenerCajaAbierta(usuarioId);
    const montoConSigno = tipo === 'egreso_manual' ? -Math.abs(monto) : Math.abs(monto);
    return this.registrarMovimiento(caja.id, tipo, montoConSigno, usuarioId, { motivo });
  }

  async cerrar(usuarioId: string, montoFinalDeclarado: number) {
    const caja = await this.obtenerCajaAbierta(usuarioId);

    const montoFinalSistema = caja.movimientos.reduce((suma, m) => suma + Number(m.monto), 0);
    const diferencia = Number(montoFinalDeclarado) - montoFinalSistema;

    const cajaCerrada = await this.prisma.caja.update({
      where: { id: caja.id },
      data: {
        estado: 'cerrada',
        montoFinalDeclarado,
        montoFinalSistema,
        diferencia,
        cerradaEn: new Date(),
      },
    });

    await this.bitacoraService.registrar({
      usuarioId,
      accion: 'cerrar_caja',
      modulo: 'caja',
      entidadId: caja.id,
      detalle: { montoFinalDeclarado, montoFinalSistema, diferencia },
    });

    await this.generarAsientoDiferencia(caja.id, usuarioId, diferencia);

    return {
      ...cajaCerrada,
      cuadrada: Math.abs(diferencia) < 0.01,
      mensaje:
        Math.abs(diferencia) < 0.01
          ? 'Caja cuadrada correctamente.'
          : diferencia > 0
            ? `Sobrante de ${diferencia.toFixed(2)}`
            : `Faltante de ${Math.abs(diferencia).toFixed(2)}`,
    };
  }

  // Solo genera asiento si hubo diferencia real (más allá de la tolerancia
  // de redondeo de 1 centavo que ya usa Contabilidad). Una caja cuadrada no
  // deja rastro contable, como es de esperar.
  private async generarAsientoDiferencia(cajaId: string, usuarioId: string, diferencia: number) {
    try {
      const monto = Math.round(Math.abs(diferencia) * 100) / 100;
      if (monto < 0.01) return;

      const detalles =
        diferencia > 0
          ? [
              { cuentaCodigo: '1105', debito: monto, descripcion: 'Sobrante de caja' },
              { cuentaCodigo: '5195', credito: monto, descripcion: 'Sobrante de caja' },
            ]
          : [
              { cuentaCodigo: '5195', debito: monto, descripcion: 'Faltante de caja' },
              { cuentaCodigo: '1105', credito: monto, descripcion: 'Faltante de caja' },
            ];

      await this.contabilidadService.registrarAsiento({
        concepto: `${diferencia > 0 ? 'Sobrante' : 'Faltante'} en cierre de caja`,
        origen: 'caja',
        origenId: cajaId,
        usuarioId,
        detalles,
      });
    } catch (error) {
      console.error(`[Contabilidad] No se pudo generar el asiento automático de la diferencia de caja ${cajaId}:`, error);
    }
  }

  async historial(desde?: Date, hasta?: Date) {
    return this.prisma.caja.findMany({
      where: { abiertaEn: { gte: desde, lte: hasta } },
      include: { movimientos: true },
      orderBy: { abiertaEn: 'desc' },
    });
  }

  async arqueoActual(usuarioId: string) {
    const caja = await this.obtenerCajaAbierta(usuarioId);
    const totalPorMetodo: Record<string, number> = {};
    for (const m of caja.movimientos) {
      const metodo = m.metodo ?? m.tipo;
      totalPorMetodo[metodo] = (totalPorMetodo[metodo] ?? 0) + Number(m.monto);
    }
    const totalSistema = caja.movimientos.reduce((s, m) => s + Number(m.monto), 0);
    return { cajaId: caja.id, totalPorMetodo, totalSistema };
  }
}
