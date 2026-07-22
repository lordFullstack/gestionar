import { IsNumber, Min, IsOptional, IsString, IsIn } from 'class-validator';

export class AbrirCajaDto {
  @IsNumber() @Min(0)
  montoInicial: number;
}

export class CerrarCajaDto {
  @IsNumber() @Min(0)
  montoFinalDeclarado: number;
}

export class MovimientoManualCajaDto {
  @IsIn(['ingreso_manual', 'egreso_manual'])
  tipo: 'ingreso_manual' | 'egreso_manual';

  @IsNumber() @Min(0.01)
  monto: number;

  @IsOptional() @IsString()
  motivo?: string;
}
