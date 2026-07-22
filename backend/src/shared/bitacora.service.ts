import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

export interface RegistrarBitacoraParams {
  usuarioId?: string; // undefined = acción automática del sistema (ej. cron de mora)
  accion: string; // 'crear', 'editar', 'eliminar', 'aprobar', 'anular', etc.
  modulo: string;
  entidadId?: string;
  detalle?: Record<string, unknown>;
  ip?: string;
}

// Punto único de escritura en la bitácora de auditoría (tabla `Bitacora`).
// Antes, cada módulo llamaba a prisma.bitacora.create(...) por su cuenta
// (patrón usado hoy en Auth/Usuarios); este servicio centraliza esa
// escritura para los módulos nuevos instrumentados (Parte 2), evitando
// duplicar el mismo bloque en cada service.
//
// Este servicio SOLO escribe. La lectura/consulta de la bitácora vive en
// AuditoriaService (src/auditoria) — nunca al revés, para no crear un
// ciclo de dependencias entre módulos.
@Injectable()
export class BitacoraService {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(params: RegistrarBitacoraParams) {
    return this.prisma.bitacora.create({
      data: {
        usuarioId: params.usuarioId,
        accion: params.accion,
        modulo: params.modulo,
        entidadId: params.entidadId,
        detalle: params.detalle as any,
        ip: params.ip,
      },
    });
  }
}
