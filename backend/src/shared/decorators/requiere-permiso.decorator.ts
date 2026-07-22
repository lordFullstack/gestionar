import { SetMetadata } from '@nestjs/common';

export const PERMISO_KEY = 'permiso_requerido';

export type AccionPermiso = 'crear' | 'editar' | 'eliminar' | 'aprobar' | 'imprimir' | 'exportar';

export interface PermisoRequerido {
  modulo: string;
  accion: AccionPermiso;
}

// Uso: @RequierePermiso('creditos', 'aprobar')
export const RequierePermiso = (modulo: string, accion: AccionPermiso) =>
  SetMetadata(PERMISO_KEY, { modulo, accion } as PermisoRequerido);
