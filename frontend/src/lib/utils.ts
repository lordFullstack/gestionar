import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Formato de moneda consistente en toda la app. Se usa junto con la clase
// CSS `.figure` (JetBrains Mono, tabular-nums) — ver src/index.css.
// No se asume un país/moneda específico (el backend tampoco lo hace, los
// montos son `Decimal` sin código de moneda) — símbolo genérico "$" con
// separador de miles. Si el negocio usa una moneda distinta, cambiar aquí
// es el único lugar que hace falta tocar.
export function formatoMoneda(valor: number | string) {
  const numero = typeof valor === 'string' ? Number(valor) : valor;
  const formateado = new Intl.NumberFormat('es', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numero ?? 0);
  return `$${formateado}`;
}

export function formatoFecha(valor: string | Date) {
  const fecha = typeof valor === 'string' ? new Date(valor) : valor;
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(fecha);
}

export function formatoFechaHora(valor: string | Date) {
  const fecha = typeof valor === 'string' ? new Date(valor) : valor;
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(fecha);
}
