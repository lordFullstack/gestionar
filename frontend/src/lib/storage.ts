import type { UsuarioActual } from './types';

// Todo lo relacionado a persistir la sesión en localStorage vive aquí, para
// que auth-context.tsx y api.ts (que no puede usar hooks de React) compartan
// una sola fuente de verdad sin importarse entre sí.
const KEYS = {
  accessToken: 'erp:accessToken',
  refreshToken: 'erp:refreshToken',
  usuario: 'erp:usuario',
} as const;

export const storage = {
  getAccessToken: () => localStorage.getItem(KEYS.accessToken),
  getRefreshToken: () => localStorage.getItem(KEYS.refreshToken),
  getUsuario: (): UsuarioActual | null => {
    const raw = localStorage.getItem(KEYS.usuario);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UsuarioActual;
    } catch {
      return null;
    }
  },
  setSesion: (accessToken: string, refreshToken: string, usuario: UsuarioActual) => {
    localStorage.setItem(KEYS.accessToken, accessToken);
    localStorage.setItem(KEYS.refreshToken, refreshToken);
    localStorage.setItem(KEYS.usuario, JSON.stringify(usuario));
  },
  setAccessToken: (accessToken: string) => localStorage.setItem(KEYS.accessToken, accessToken),
  setUsuario: (usuario: UsuarioActual) => localStorage.setItem(KEYS.usuario, JSON.stringify(usuario)),
  limpiar: () => {
    localStorage.removeItem(KEYS.accessToken);
    localStorage.removeItem(KEYS.refreshToken);
    localStorage.removeItem(KEYS.usuario);
  },
};
