import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';

// Este módulo NO escribe en la bitácora — eso lo hacen los demás módulos
// (Auth/Usuarios con prisma.bitacora.create(...) directo, y desde la
// Parte 2, Inventario, POS, Caja, Clientes, Créditos, Compras y
// Contabilidad a través de BitacoraService en src/shared/). Este módulo
// solo la CONSULTA.
@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtros: {
    usuarioId?: string;
    modulo?: string;
    accion?: string;
    desde?: string;
    hasta?: string;
    limite?: number;
  }) {
    return this.prisma.bitacora.findMany({
      where: {
        usuarioId: filtros.usuarioId,
        modulo: filtros.modulo,
        accion: filtros.accion,
        creadoEn: {
          gte: filtros.desde ? new Date(filtros.desde) : undefined,
          lte: filtros.hasta ? new Date(filtros.hasta) : undefined,
        },
      },
      include: { usuario: { select: { id: true, nombre: true, email: true } } },
      orderBy: { creadoEn: 'desc' },
      take: filtros.limite ?? 100,
    });
  }

  async obtener(id: string) {
    const registro = await this.prisma.bitacora.findUnique({
      where: { id },
      include: { usuario: { select: { id: true, nombre: true, email: true } } },
    });
    if (!registro) throw new NotFoundException('Registro de auditoría no encontrado');
    return registro;
  }

  // Actividad de un usuario específico (útil para "¿qué hizo fulano?")
  async porUsuario(usuarioId: string, limite = 100) {
    return this.listar({ usuarioId, limite });
  }

  // Historial de una entidad específica (útil para "¿quién tocó esta venta/producto/crédito?")
  async porEntidad(modulo: string, entidadId: string) {
    return this.prisma.bitacora.findMany({
      where: { modulo, entidadId },
      include: { usuario: { select: { id: true, nombre: true, email: true } } },
      orderBy: { creadoEn: 'desc' },
    });
  }

  // Conteo de acciones por módulo en un rango — útil para ver qué tan
  // instrumentado está cada módulo (mientras se completa la parte 2)
  async resumenPorModulo(filtros: { desde?: string; hasta?: string }) {
    const registros = await this.prisma.bitacora.findMany({
      where: {
        creadoEn: {
          gte: filtros.desde ? new Date(filtros.desde) : undefined,
          lte: filtros.hasta ? new Date(filtros.hasta) : undefined,
        },
      },
      select: { modulo: true, accion: true },
    });

    const porModulo = new Map<string, number>();
    for (const r of registros) {
      porModulo.set(r.modulo, (porModulo.get(r.modulo) ?? 0) + 1);
    }

    return Array.from(porModulo.entries())
      .map(([modulo, cantidad]) => ({ modulo, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }
}
