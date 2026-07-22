import { IsUUID, IsNumber, Min, IsInt, IsIn, IsOptional, IsString } from 'class-validator';

export class SolicitarCreditoDto {
  @IsUUID() clienteId: string;
  @IsOptional() @IsUUID() ventaId?: string;
  @IsNumber() @Min(0.01) montoSolicitado: number;
  @IsNumber() @Min(0) tasaInteres: number; // % total del plazo (ej. 12 = 12% total)
  @IsInt() @Min(1) numeroCuotas: number;
  @IsIn(['semanal', 'quincenal', 'mensual']) frecuenciaPago: 'semanal' | 'quincenal' | 'mensual';
}

export class RechazarCreditoDto {
  @IsString() motivo: string;
}

export class AbonarCreditoDto {
  @IsOptional() @IsUUID() cuotaId?: string; // si se omite, se aplica a la cuota pendiente más antigua
  @IsNumber() @Min(0.01) monto: number;
  @IsIn(['efectivo', 'tarjeta', 'transferencia']) metodo: 'efectivo' | 'tarjeta' | 'transferencia';
}

export class RefinanciarCreditoDto {
  @IsNumber() @Min(0) tasaInteres: number;
  @IsInt() @Min(1) numeroCuotas: number;
  @IsIn(['semanal', 'quincenal', 'mensual']) frecuenciaPago: 'semanal' | 'quincenal' | 'mensual';
  @IsOptional() @IsString() motivo?: string;
}
