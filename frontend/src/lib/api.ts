import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { storage } from './storage';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const api = axios.create({ baseURL });

// Adjunta el access token a cada request saliente.
api.interceptors.request.use((config) => {
  const token = storage.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// El access token dura 1 hora (ver RESUMEN-PROYECTO.md). Si expira a mitad
// de una sesión, se intenta refrescar UNA vez con el refreshToken guardado
// y se reintenta la petición original. Si el refresh también falla, se
// limpia la sesión y se manda a /login — no hay forma de recuperarla sin
// volver a autenticar.
let refrescando: Promise<string | null> | null = null;

async function refrescarAccessToken(): Promise<string | null> {
  const refreshToken = storage.getRefreshToken();
  if (!refreshToken) return null;

  try {
    const { data } = await axios.post<{ accessToken: string }>(`${baseURL}/auth/refresh`, { refreshToken });
    storage.setAccessToken(data.accessToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (respuesta) => respuesta,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _reintentado?: boolean }) | undefined;

    if (error.response?.status !== 401 || !original || original._reintentado) {
      throw error;
    }
    // Nunca se reintenta el propio login/refresh — evita loops.
    if (original.url?.includes('/auth/login') || original.url?.includes('/auth/refresh')) {
      throw error;
    }

    original._reintentado = true;

    if (!refrescando) {
      refrescando = refrescarAccessToken().finally(() => {
        refrescando = null;
      });
    }
    const nuevoToken = await refrescando;

    if (!nuevoToken) {
      storage.limpiar();
      window.location.href = '/login';
      throw error;
    }

    original.headers.Authorization = `Bearer ${nuevoToken}`;
    return api.request(original);
  },
);
