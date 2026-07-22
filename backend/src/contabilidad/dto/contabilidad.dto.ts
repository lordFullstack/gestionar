import {
  IsString,
  IsUUID,
  IsNumber,
  IsOptional,
  IsArray,
  IsIn,
  IsBoolean,
  IsDateString,
  ValidateNested,
  ArrayMinSize,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

const TIPOS_CUENTA = ['activo', 'pasivo', 'patrimonio', 'ingreso', 'gasto', 'costo'];
const NATURALEZAS = ['debito', 'credito'];

export class CrearCuentaDto {
  @IsString() codigo: string;
  @IsString() nombre: string;
  @IsIn(TIPOS_CUENTA) tipo: string;
  @IsIn(NATURALEZAS) naturaleza: string;
  @IsOptional() @IsUUID() cuentaPadreId?: string;
}

export class ActualizarCuentaDto {
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsBoolean() activa?: boolean;
}

export class LineaAsientoDto {
  @IsUUID() cuentaId: string;
  @IsOptional() @IsNumber() @Min(0) debito?: number;
  @IsOptional() @IsNumber() @Min(0) credito?: number;
  @IsOptional() @IsString() descripcion?: string;
}

export class CrearAsientoDto {
  @IsOptional() @IsDateString() fecha?: string;
  @IsString() concepto: string;

  @IsArray()
  @ArrayMinSize(2) // toda partida doble necesita mínimo una línea débito y una crédito
  @ValidateNested({ each: true })
  @Type(() => LineaAsientoDto)
  detalles: LineaAsientoDto[];
}

export class AnularAsientoDto {
  @IsOptional() @IsString() motivo?: string;
}

export class FiltrosReporteDto {
  @IsOptional() @IsDateString() desde?: string;
  @IsOptional() @IsDateString() hasta?: string;
}
