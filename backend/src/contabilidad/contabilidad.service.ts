import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import { BitacoraService } from '../shared/bitacora.service';
import { CrearCuentaDto, ActualizarCuentaDto, CrearAsientoDto } from './dto/contabilidad.dto';

// Línea de asiento tal como la usan los OTROS módulos (POS, Compras, Caja,
// Créditos) al llamar a registrarAsiento() directamente en código, sin pasar
// por el controller/DTO de HTTP.
export interface LineaAsientoInterna {
  cuentaCodigo: string; // se resuelve por código, no por id, para no acoplar módulos a UUIDs
  debito?: number;
  credito?: number;
  descripcion?: string;
}

export interface RegistrarAsientoParams {
  concepto: string;
  origen: 'venta' | 'compra' | 'caja' | 'credito' | 'manual' | 'reversion';
  origenId?: string;
  usuarioId: string;
  detalles: LineaAsientoInterna[];
  fecha?: Date;
}

const TOLERANCIA_CUADRE = 0.01; // redondeos de centavos

@Injectable()
export class ContabilidadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacoraService: BitacoraService,
  ) {}

  // ---------- Plan de cuentas ----------
  async listarCuentas(soloActivas = false) {
    return this.prisma.cuentaContable.findMany({
      where: soloActivas ? { activa: true } : undefined,
      orderBy: { codigo: 'asc' },
    });
  }

  async obtenerCuenta(id: string) {
    const cuenta = await this.prisma.cuentaContable.findUnique({ where: { id } });
    if (!cuenta) throw new NotFoundException('Cuenta contable no encontrada');
    return cuenta;
  }

  async crearCuenta(dto: CrearCuentaDto) {
    const existente = await this.prisma.cuentaContable.findUnique({ where: { codigo: dto.codigo } });
    if (existente) throw new BadRequestException(`Ya existe una cuenta con código ${dto.codigo}`);
    if (dto.cuentaPadreId) await this.obtenerCuenta(dto.cuentaPadreId);
    return this.prisma.cuentaContable.create({ data: dto });
  }

  async actualizarCuenta(id: string, dto: ActualizarCuentaDto) {
    await this.obtenerCuenta(id);
    return this.prisma.cuentaContable.update({ where: { id }, data: dto });
  }

  // ---------- Asientos ----------

  // Punto de entrada para los OTROS módulos (no pasa por HTTP). Valida
  // partida doble, resuelve cuentas por código y crea cabecera+detalle en
  // una sola transacción. Si el cuadre no da, lanza excepción y no se
  // guarda nada (igual patrón de reversión automática que usa Inventario).
  async registrarAsiento(params: RegistrarAsientoParams) {
    const totalDebito = params.detalles.reduce((s, d) => s + (d.debito ?? 0), 0);
    const totalCredito = params.detalles.reduce((s, d) => s + (d.credito ?? 0), 0);
    if (Math.abs(totalDebito - totalCredito) > TOLERANCIA_CUADRE) {
      throw new BadRequestException(
        `El asiento no cuadra: débitos ${totalDebito.toFixed(2)} vs créditos ${totalCredito.toFixed(2)}`,
      );
    }

    const codigos = [...new Set(params.detalles.map((d) => d.cuentaCodigo))];
    const cuentas = await this.prisma.cuentaContable.findMany({ where: { codigo: { in: codigos } } });
    const mapaCuentas = new Map(cuentas.map((c) => [c.codigo, c]));
    for (const codigo of codigos) {
      if (!mapaCuentas.has(codigo)) {
        throw new BadRequestException(`Cuenta contable con código ${codigo} no existe en el plan de cuentas`);
      }
    }

    return this.prisma.asientoContable.create({
      data: {
        fecha: params.fecha ?? new Date(),
        concepto: params.concepto,
        origen: params.origen,
        origenId: params.origenId,
        usuarioId: params.usuarioId,
        detalles: {
          create: params.detalles.map((d) => ({
            cuentaId: mapaCuentas.get(d.cuentaCodigo)!.id,
            debito: d.debito ?? 0,
            credito: d.credito ?? 0,
            descripcion: d.descripcion,
          })),
        },
      },
      include: { detalles: { include: { cuenta: true } } },
    });
  }

  // Punto de entrada HTTP (asiento manual, por id de cuenta directo)
  async crearAsientoManual(dto: CrearAsientoDto, usuarioId: string) {
    const totalDebito = dto.detalles.reduce((s, d) => s + (d.debito ?? 0), 0);
    const totalCredito = dto.detalles.reduce((s, d) => s + (d.credito ?? 0), 0);
    if (Math.abs(totalDebito - totalCredito) > TOLERANCIA_CUADRE) {
      throw new BadRequestException(
        `El asiento no cuadra: débitos ${totalDebito.toFixed(2)} vs créditos ${totalCredito.toFixed(2)}`,
      );
    }
    for (const linea of dto.detalles) {
      await this.obtenerCuenta(linea.cuentaId); // valida existencia
    }

    return this.prisma.asientoContable.create({
      data: {
        fecha: dto.fecha ? new Date(dto.fecha) : new Date(),
        concepto: dto.concepto,
        origen: 'manual',
        usuarioId,
        detalles: {
          create: dto.detalles.map((d) => ({
            cuentaId: d.cuentaId,
            debito: d.debito ?? 0,
            credito: d.credito ?? 0,
            descripcion: d.descripcion,
          })),
        },
      },
      include: { detalles: { include: { cuenta: true } } },
    });
  }

  async listarAsientos(filtros: { origen?: string; desde?: string; hasta?: string }) {
    return this.prisma.asientoContable.findMany({
      where: {
        origen: filtros.origen,
        fecha: {
          gte: filtros.desde ? new Date(filtros.desde) : undefined,
          lte: filtros.hasta ? new Date(filtros.hasta) : undefined,
        },
      },
      include: { detalles: { include: { cuenta: true } } },
      orderBy: { fecha: 'desc' },
    });
  }

  async obtenerAsiento(id: string) {
    const asiento = await this.prisma.asientoContable.findUnique({
      where: { id },
      include: { detalles: { include: { cuenta: true } } },
    });
    if (!asiento) throw new NotFoundException('Asiento no encontrado');
    return asiento;
  }

  // No se borra nunca un asiento (trazabilidad); anular = crear la
  // contrapartida exacta y marcar el original como anulado.
  async anularAsiento(id: string, usuarioId: string, motivo?: string) {
    const original = await this.obtenerAsiento(id);
    if (original.estado === 'anulado') throw new BadRequestException('El asiento ya está anulado');

    const reversion = await this.prisma.$transaction(async (tx) => {
      await tx.asientoContable.update({ where: { id }, data: { estado: 'anulado' } });

      return tx.asientoContable.create({
        data: {
          fecha: new Date(),
          concepto: `Reversión de asiento #${original.numero}${motivo ? ` — ${motivo}` : ''}`,
          origen: 'reversion',
          origenId: original.id,
          usuarioId,
          detalles: {
            // se invierten débitos y créditos de cada línea original
            create: original.detalles.map((d) => ({
              cuentaId: d.cuentaId,
              debito: d.credito,
              credito: d.debito,
              descripcion: d.descripcion,
            })),
          },
        },
        include: { detalles: { include: { cuenta: true } } },
      });
    });

    await this.bitacoraService.registrar({
      usuarioId,
      accion: 'anular_asiento',
      modulo: 'contabilidad',
      entidadId: id,
      detalle: { motivo, asientoReversionId: reversion.id },
    });

    return reversion;
  }

  // ---------- Reportes ----------

  async libroDiario(filtros: { desde?: string; hasta?: string }) {
    return this.listarAsientos({ ...filtros, origen: undefined });
  }

  // Sumas y saldos por cuenta, solo asientos activos
  async balanceComprobacion(filtros: { desde?: string; hasta?: string }) {
    const detalles = await this.prisma.asientoDetalle.findMany({
      where: {
        asiento: {
          estado: 'activo',
          fecha: {
            gte: filtros.desde ? new Date(filtros.desde) : undefined,
            lte: filtros.hasta ? new Date(filtros.hasta) : undefined,
          },
        },
      },
      include: { cuenta: true },
    });

    const porCuenta = new Map<string, { cuenta: any; debitos: number; creditos: number }>();
    for (const d of detalles) {
      const key = d.cuentaId;
      if (!porCuenta.has(key)) porCuenta.set(key, { cuenta: d.cuenta, debitos: 0, creditos: 0 });
      const acc = porCuenta.get(key)!;
      acc.debitos += Number(d.debito);
      acc.creditos += Number(d.credito);
    }

    return Array.from(porCuenta.values())
      .map(({ cuenta, debitos, creditos }) => ({
        codigo: cuenta.codigo,
        nombre: cuenta.nombre,
        tipo: cuenta.tipo,
        totalDebitos: Math.round(debitos * 100) / 100,
        totalCreditos: Math.round(creditos * 100) / 100,
        saldo:
          cuenta.naturaleza === 'debito'
            ? Math.round((debitos - creditos) * 100) / 100
            : Math.round((creditos - debitos) * 100) / 100,
      }))
      .sort((a, b) => a.codigo.localeCompare(b.codigo));
  }

  // Ingresos - costos - gastos, en el rango de fechas dado
  async estadoResultados(filtros: { desde?: string; hasta?: string }) {
    const balance = await this.balanceComprobacion(filtros);
    const ingresos = balance.filter((c) => c.tipo === 'ingreso');
    const costos = balance.filter((c) => c.tipo === 'costo');
    const gastos = balance.filter((c) => c.tipo === 'gasto');

    const totalIngresos = ingresos.reduce((s, c) => s + c.saldo, 0);
    const totalCostos = costos.reduce((s, c) => s + c.saldo, 0);
    const totalGastos = gastos.reduce((s, c) => s + c.saldo, 0);
    const utilidadBruta = Math.round((totalIngresos - totalCostos) * 100) / 100;
    const utilidadNeta = Math.round((utilidadBruta - totalGastos) * 100) / 100;

    return {
      periodo: { desde: filtros.desde ?? null, hasta: filtros.hasta ?? null },
      ingresos,
      costos,
      gastos,
      totales: {
        totalIngresos: Math.round(totalIngresos * 100) / 100,
        totalCostos: Math.round(totalCostos * 100) / 100,
        totalGastos: Math.round(totalGastos * 100) / 100,
        utilidadBruta,
        utilidadNeta,
      },
    };
  }
}
