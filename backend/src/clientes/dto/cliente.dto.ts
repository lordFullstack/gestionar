import { IsString, IsOptional, IsEmail, IsNumber, Min, IsIn, IsBoolean, IsDateString } from 'class-validator';

export class CrearClienteDto {
  @IsString() nombre: string;
  @IsOptional() @IsIn(['cedula', 'ruc', 'pasaporte']) tipoDocumento?: string;
  @IsOptional() @IsString() numeroDocumento?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsDateString() fechaNacimiento?: string;
  @IsOptional() @IsNumber() @Min(0) limiteCredito?: number;
  @IsOptional() @IsString() observaciones?: string;
}

export class ActualizarClienteDto {
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsIn(['cedula', 'ruc', 'pasaporte']) tipoDocumento?: string;
  @IsOptional() @IsString() numeroDocumento?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsDateString() fechaNacimiento?: string;
  @IsOptional() @IsNumber() @Min(0) limiteCredito?: number;
  @IsOptional() @IsIn(['regular', 'vip', 'moroso']) clasificacion?: string;
  @IsOptional() @IsString() observaciones?: string;
  @IsOptional() @IsBoolean() activo?: boolean;
}

export class CrearDireccionDto {
  @IsOptional() @IsIn(['casa', 'trabajo', 'envio']) etiqueta?: string;
  @IsString() direccion: string;
  @IsOptional() @IsString() ciudad?: string;
  @IsOptional() @IsString() referencia?: string;
  @IsOptional() @IsBoolean() esPrincipal?: boolean;
}

export class CrearContactoDto {
  @IsString() nombre: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() relacion?: string;
}

export class CrearReferenciaDto {
  @IsIn(['personal', 'comercial']) tipo: string;
  @IsString() nombre: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsString() direccion?: string;
}

export class CrearDocumentoDto {
  @IsString() tipo: string;
  @IsString() urlArchivo: string;
}
