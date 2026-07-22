// Tipos espejo de las formas que devuelve el backend (NestJS + Prisma).
// No son un mirror 1:1 exhaustivo — solo lo que el frontend consume hoy.
// Ampliar según se vayan construyendo más pantallas.

export interface Permiso {
  modulo: string;
  crear: boolean;
  editar: boolean;
  eliminar: boolean;
  aprobar: boolean;
  imprimir: boolean;
  exportar: boolean;
}

export interface UsuarioActual {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  permisos: Permiso[];
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  usuario: UsuarioActual;
}

export interface DashboardResumen {
  fecha: string;
  ventas: {
    cantidadHoy: number;
    totalHoy: number;
  };
  caja:
    | { estado: 'abierta'; id: string; abiertaEn: string }
    | { estado: 'cerrada' };
  alertasInventario: {
    stockBajo: number;
    agotados: number;
    proximosAVencer: number;
  };
  cartera: {
    clientesEnMora: number;
  };
}
