import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import { storage } from './storage';
import type { LoginResponse, UsuarioActual } from './types';

interface AuthContextValue {
  usuario: UsuarioActual | null;
  cargando: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  tienePermiso: (modulo: string, accion: keyof Omit<import('./types').Permiso, 'modulo'>) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioActual | null>(() => storage.getUsuario());
  // Arranca "cargando" solo si había una sesión guardada que hay que
  // revalidar contra el backend; si no había nada, no tiene sentido
  // bloquear la pantalla de login con un spinner.
  const [cargando, setCargando] = useState(() => !!storage.getRefreshToken());

  useEffect(() => {
    const refreshToken = storage.getRefreshToken();
    if (!refreshToken) {
      setCargando(false);
      return;
    }

    // Revalida la sesión contra /auth/me (trae rol/permisos frescos, no lo
    // que haya quedado cacheado de un login anterior). Si el access token
    // ya expiró, el interceptor de api.ts lo refresca solo antes de que
    // esta llamada falle.
    api
      .get<UsuarioActual>('/auth/me')
      .then(({ data }) => {
        storage.setUsuario(data);
        setUsuario(data);
      })
      .catch(() => {
        storage.limpiar();
        setUsuario(null);
      })
      .finally(() => setCargando(false));
  }, []);

  async function login(email: string, password: string) {
    const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
    storage.setSesion(data.accessToken, data.refreshToken, data.usuario);
    setUsuario(data.usuario);
  }

  function logout() {
    const refreshToken = storage.getRefreshToken();
    storage.limpiar();
    setUsuario(null);
    if (refreshToken) {
      // Best-effort: invalida el refresh token en el servidor. No se
      // espera la respuesta — la sesión local ya se cerró de todas formas.
      api.post('/auth/logout', { refreshToken }).catch(() => {});
    }
  }

  function tienePermiso(modulo: string, accion: keyof Omit<import('./types').Permiso, 'modulo'>) {
    if (!usuario) return false;
    if (usuario.rol === 'Administrador') return true; // mismo atajo que PermisosGuard en el backend
    const permiso = usuario.permisos.find((p) => p.modulo === modulo);
    return !!permiso?.[accion];
  }

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, logout, tienePermiso }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
