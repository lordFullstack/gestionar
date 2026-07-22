import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import { BitacoraService } from '../shared/bitacora.service';
import { CajaService } from '../caja/caja.service';
import { ClientesService } from '../clientes/clientes.service';
import { ContabilidadService, LineaAsientoInterna } from '../contabilidad/contabilidad.service';
import { SolicitarCreditoDto, AbonarCreditoDto, RefinanciarCreditoDto } from './dto/credito.dto';

const DIAS_MORA_PARA_MARCAR_MOROSO = 15;

@Injectable()
export class CreditosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cajaService: CajaService,
    private readonly clientesService: ClientesService,
    private readonly bitacoraService: BitacoraService,
    private readonly contabilidadService: ContabilidadService,
  ) {}

  // ---------- Solicitud ----------
  async solicitar(dto: SolicitarCreditoDto) {
    const cliente = await this.prisma.cliente.findUnique({ where: { id: dto.clienteId } });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');

    // Validación básica de límite de crédito del cliente
    const creditosActivos = await this.prisma.credito.findMany({
      where: { clienteId: dto.clienteId, estado: 'activo' },
    });
    const deudaActual = creditosActivos.reduce((s, c) => s + Number(c.saldoPendiente), 0);
    if (Number(cliente.limiteCredito) > 0 && deudaActual + dto.montoSolicitado > Number(cliente.limiteCredito)) {
      throw new BadRequestException(
        `El monto solicitado excede el límite de crédito disponible. Límite: ${cliente.limiteCredito}, deuda actual: ${deudaActual}`,
      );
    }

    const interesTotal = Math.round(dto.montoSolicitado * (dto.tasaInteres / 100) * 100) / 100;
    const montoTotal = Math.round((dto.montoSolicitado + interesTotal) * 100) / 100;

    return this.prisma.credito.create({
      data: {
        clienteId: dto.clienteId,
        ventaId: dto.ventaId,
        montoSolicitado: dto.montoSolicitado,
        tasaInteres: dto.tasaInteres,
        numeroCuotas: dto.numeroCuotas,
        frecuenciaPago: dto.frecuenciaPago,
        montoTotal,
        saldoPendiente: montoTotal,
        estado: 'solicitado',
      },
    });
  }

  // ---------- Aprobación / rechazo ----------
  async aprobar(id: string, usuarioId: string) {
    const credito = await this.obtener(id);
    if (credito.estado !== 'solicitado') throw new BadRequestException('Solo se pueden aprobar créditos en estado "solicitado"');

    const cuotas = this.generarCalendarioCuotas(credito);

    await this.prisma.$transaction([
      this.prisma.credito.update({
        where: { id },
        data: { estado: 'activo', fechaAprobacion: new Date(), aprobadoPor: usuarioId },
      }),
      this.prisma.cuota.createMany({ data: cuotas.map((c) => ({ ...c, creditoId: id })) }),
    ]);

    await this.bitacoraService.registrar({
      usuarioId,
      accion: 'aprobar',
      modulo: 'creditos',
      entidadId: id,
      detalle: { montoTotal: credito.montoTotal },
    });

    return this.obtener(id);
  }

  async rechazar(id: string, motivo: string, usuarioId: string) {
    const credito = await this.obtener(id);
    if (credito.estado !== 'solicitado') throw new BadRequestException('Solo se pueden rechazar créditos en estado "solicitado"');
    const rechazado = await this.prisma.credito.update({ where: { id }, data: { estado: 'rechazado', motivoRechazo: motivo } });

    await this.bitacoraService.registrar({
      usuarioId,
      accion: 'rechazar',
      modulo: 'creditos',
      entidadId: id,
      detalle: { motivo },
    });

    return rechazado;
  }

  // Genera el calendario de cuotas en partes iguales de capital e interés
  private generarCalendarioCuotas(credito: { montoSolicitado: any; montoTotal: any; numeroCuotas: number; frecuenciaPago: string }) {
    const capitalPorCuota = Math.round((Number(credito.montoSolicitado) / credito.numeroCuotas) * 100) / 100;
    const interesTotal = Number(credito.montoTotal) - Number(credito.montoSolicitado);
    const interesPorCuota = Math.round((interesTotal / credito.numeroCuotas) * 100) / 100;

    const cuotas = [];
    let fecha = new Date();

    for (let numero = 1; numero <= credito.numeroCuotas; numero++) {
      fecha = this.siguienteFecha(fecha, credito.frecuenciaPago);
      const esUltima = numero === credito.numeroCuotas;
      // Ajuste de redondeo en la última cuota para que la suma cuadre exacto
      const capital = esUltima
        ? Math.round((Number(credito.montoSolicitado) - capitalPorCuota * (credito.numeroCuotas - 1)) * 100) / 100
        : capitalPorCuota;
      const interes = esUltima
        ? Math.round((interesTotal - interesPorCuota * (credito.numeroCuotas - 1)) * 100) / 100
        : interesPorCuota;

      cuotas.push({
        numero,
        fechaVencimiento: new Date(fecha),
        montoCapital: capital,
        montoInteres: interes,
        montoTotal: Math.round((capital + interes) * 100) / 100,
      });
    }
    return cuotas;
  }

  private siguienteFecha(desde: Date, frecuencia: string): Date {
    const fecha = new Date(desde);
    if (frecuencia === 'semanal') fecha.setDate(fecha.getDate() + 7);
    else if (frecuencia === 'quincenal') fecha.setDate(fecha.getDate() + 15);
    else fecha.setMonth(fecha.getMonth() + 1); // mensual
    return fecha;
  }

  // ---------- Consulta ----------
  async listar(filtro?: { estado?: string; clienteId?: string }) {
    return this.prisma.credito.findMany({
      where: { estado: filtro?.estado, clienteId: filtro?.clienteId },
      include: { cliente: true },
      orderBy: { creadoEn: 'desc' },
    });
  }

  async obtener(id: string) {
    const credito = await this.prisma.credito.findUnique({
      where: { id },
      include: { cliente: true, cuotas: { include: { abonos: true }, orderBy: { numero: 'asc' } } },
    });
    if (!credito) throw new NotFoundException('Crédito no encontrado');
    return credito;
  }

  async historialCliente(clienteId: string) {
    return this.prisma.credito.findMany({
      where: { clienteId },
      include: { cuotas: true },
      orderBy: { creadoEn: 'desc' },
    });
  }

  // ---------- Abonos / cobranza ----------
  async abonar(creditoId: string, dto: AbonarCreditoDto, usuarioId: string) {
    const credito = await this.obtener(creditoId);
    if (credito.estado !== 'activo') throw new BadRequestException('Solo se puede abonar a créditos activos');

    const caja = await this.cajaService.obtenerCajaAbierta(usuarioId);

    let restante = dto.monto;
    let capitalAplicado = 0;
    let interesAplicado = 0;
    const cuotasOrdenadas = dto.cuotaId
      ? credito.cuotas.filter((c) => c.id === dto.cuotaId)
      : credito.cuotas.filter((c) => c.estado !== 'pagada').sort((a, b) => a.numero - b.numero);

    if (cuotasOrdenadas.length === 0) throw new BadRequestException('No hay cuotas pendientes para abonar');

    for (const cuota of cuotasOrdenadas) {
      if (restante <= 0) break;
      const faltante = Math.round((Number(cuota.montoTotal) - Number(cuota.montoPagado)) * 100) / 100;
      if (faltante <= 0) continue;

      const aplicar = Math.min(restante, faltante);

      await this.prisma.abono.create({
        data: { cuotaId: cuota.id, creditoId, monto: aplicar, metodo: dto.metodo, usuarioId },
      });

      const nuevoPagado = Math.round((Number(cuota.montoPagado) + aplicar) * 100) / 100;
      await this.prisma.cuota.update({
        where: { id: cuota.id },
        data: {
          montoPagado: nuevoPagado,
          estado: nuevoPagado >= Number(cuota.montoTotal) ? 'pagada' : 'parcial',
        },
      });

      // Reparte lo aplicado en esta cuota proporcionalmente entre capital
      // e interés, según la composición original de la cuota, para poder
      // acreditar 1305 (CxC) y 4210 (ingreso financiero) por separado.
      if (Number(cuota.montoTotal) > 0) {
        const proporcionInteres = Number(cuota.montoInteres) / Number(cuota.montoTotal);
        interesAplicado += Math.round(aplicar * proporcionInteres * 100) / 100;
        capitalAplicado += Math.round(aplicar * (1 - proporcionInteres) * 100) / 100;
      } else {
        capitalAplicado += aplicar;
      }

      restante = Math.round((restante - aplicar) * 100) / 100;
    }

    const abonadoReal = dto.monto - restante;
    if (restante > 0) {
      // Sobrante no aplicado (ej. abonó más de lo que debía en total) — se informa pero no se pierde
    }

    await this.cajaService.registrarMovimiento(caja.id, 'abono_credito', abonadoReal, usuarioId, {
      metodo: dto.metodo,
      referenciaTipo: 'abono_credito',
      referenciaId: creditoId,
    });

    const nuevoSaldo = Math.round((Number(credito.saldoPendiente) - abonadoReal) * 100) / 100;
    const nuevoEstado = nuevoSaldo <= 0.01 ? 'pagado' : 'activo';
    await this.prisma.credito.update({ where: { id: creditoId }, data: { saldoPendiente: Math.max(nuevoSaldo, 0), estado: nuevoEstado } });

    // Si el crédito quedó saldado y el cliente estaba marcado moroso, revisar si ya no tiene otra mora activa
    if (nuevoEstado === 'pagado') {
      await this.revisarClasificacionCliente(credito.clienteId);
    }

    await this.generarAsientoAbono(creditoId, usuarioId, capitalAplicado, interesAplicado);

    return { ...(await this.obtener(creditoId)), montoAplicado: abonadoReal, sobrante: restante };
  }

  // Débito Caja por lo cobrado; crédito CxC clientes por la porción de
  // capital y crédito Ingresos financieros por la porción de interés. Se
  // asume que el CxC original ya fue registrado por POS al facturar la
  // venta a crédito — este asiento solo cubre el abono en sí.
  private async generarAsientoAbono(creditoId: string, usuarioId: string, capitalAplicado: number, interesAplicado: number) {
    try {
      const capital = Math.round(capitalAplicado * 100) / 100;
      const interes = Math.round(interesAplicado * 100) / 100;
      const total = Math.round((capital + interes) * 100) / 100;
      if (total <= 0) return;

      const detalles: LineaAsientoInterna[] = [{ cuentaCodigo: '1105', debito: total, descripcion: 'Cobro de abono' }];
      if (capital > 0) detalles.push({ cuentaCodigo: '1305', credito: capital, descripcion: 'Abono a capital' });
      if (interes > 0) detalles.push({ cuentaCodigo: '4210', credito: interes, descripcion: 'Interés cobrado' });

      await this.contabilidadService.registrarAsiento({
        concepto: `Abono a crédito`,
        origen: 'credito',
        origenId: creditoId,
        usuarioId,
        detalles,
      });
    } catch (error) {
      console.error(`[Contabilidad] No se pudo generar el asiento automático del abono al crédito ${creditoId}:`, error);
    }
  }

  // ---------- Mora ----------
  // Pensado para ejecutarse por cron diario; también se puede invocar manualmente
  async marcarMora() {
    const hoy = new Date();
    const cuotasVencidas = await this.prisma.cuota.findMany({
      where: { estado: { in: ['pendiente', 'parcial'] }, fechaVencimiento: { lt: hoy } },
      include: { credito: true },
    });

    const clientesAfectados = new Set<string>();

    for (const cuota of cuotasVencidas) {
      const diasMora = Math.floor((hoy.getTime() - cuota.fechaVencimiento.getTime()) / (1000 * 60 * 60 * 24));
      await this.prisma.cuota.update({ where: { id: cuota.id }, data: { estado: 'vencida', diasMora } });

      if (diasMora >= DIAS_MORA_PARA_MARCAR_MOROSO) {
        clientesAfectados.add(cuota.credito.clienteId);
      }
    }

    for (const clienteId of clientesAfectados) {
      await this.clientesService.clasificar(clienteId, 'moroso');
    }

    return { cuotasActualizadas: cuotasVencidas.length, clientesMarcadosMorosos: clientesAfectados.size };
  }

  async alertaCreditosVencidos() {
    return this.prisma.cuota.findMany({
      where: { estado: 'vencida' },
      include: { credito: { include: { cliente: true } } },
      orderBy: { diasMora: 'desc' },
    });
  }

  async alertaProximosAVencer(diasUmbral = 7) {
    const limite = new Date();
    limite.setDate(limite.getDate() + diasUmbral);
    return this.prisma.cuota.findMany({
      where: { estado: { in: ['pendiente', 'parcial'] }, fechaVencimiento: { lte: limite, gte: new Date() } },
      include: { credito: { include: { cliente: true } } },
      orderBy: { fechaVencimiento: 'asc' },
    });
  }

  // Lista de cobranza: todas las cuotas vencidas con datos de contacto del cliente
  async listaCobranza() {
    const vencidas = await this.prisma.cuota.findMany({
      where: { estado: 'vencida' },
      include: { credito: { include: { cliente: { include: { contactos: true } } } } },
      orderBy: { diasMora: 'desc' },
    });
    return vencidas;
  }

  // ---------- Refinanciación ----------
  async refinanciar(creditoOriginalId: string, dto: RefinanciarCreditoDto, usuarioId: string) {
    const original = await this.obtener(creditoOriginalId);
    if (original.estado !== 'activo') throw new BadRequestException('Solo se pueden refinanciar créditos activos');
    if (Number(original.saldoPendiente) <= 0) throw new BadRequestException('Este crédito no tiene saldo pendiente para refinanciar');

    const montoBase = Number(original.saldoPendiente);
    const interesTotal = Math.round(montoBase * (dto.tasaInteres / 100) * 100) / 100;
    const montoTotal = Math.round((montoBase + interesTotal) * 100) / 100;

    const nuevo = await this.prisma.credito.create({
      data: {
        clienteId: original.clienteId,
        montoSolicitado: montoBase,
        tasaInteres: dto.tasaInteres,
        numeroCuotas: dto.numeroCuotas,
        frecuenciaPago: dto.frecuenciaPago,
        montoTotal,
        saldoPendiente: montoTotal,
        estado: 'activo',
        fechaAprobacion: new Date(),
        aprobadoPor: usuarioId,
      },
    });

    const cuotas = this.generarCalendarioCuotas(nuevo);
    await this.prisma.cuota.createMany({ data: cuotas.map((c) => ({ ...c, creditoId: nuevo.id })) });

    await this.prisma.credito.update({ where: { id: creditoOriginalId }, data: { estado: 'refinanciado', saldoPendiente: 0 } });

    await this.prisma.refinanciacion.create({
      data: { creditoOriginalId, creditoNuevoId: nuevo.id, motivo: dto.motivo, usuarioId },
    });

    await this.bitacoraService.registrar({
      usuarioId,
      accion: 'refinanciar',
      modulo: 'creditos',
      entidadId: nuevo.id,
      detalle: { creditoOriginalId, motivo: dto.motivo },
    });

    return this.obtener(nuevo.id);
  }

  private async revisarClasificacionCliente(clienteId: string) {
    const otrosVencidos = await this.prisma.cuota.count({
      where: { estado: 'vencida', credito: { clienteId, estado: 'activo' } },
    });
    if (otrosVencidos === 0) {
      await this.clientesService.clasificar(clienteId, 'regular');
    }
  }
}
