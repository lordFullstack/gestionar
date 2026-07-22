import { IsString, IsOptional, IsBoolean, IsEmail } from 'class-validator';

export class CrearCategoriaDto {
  @IsString()
  nombre: string;
}
export class ActualizarCategoriaDto {
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsBoolean() activo?: boolean;
}

export class CrearMarcaDto {
  @IsString()
  nombre: string;
}
export class ActualizarMarcaDto {
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsBoolean() activo?: boolean;
}

export class CrearProveedorDto {
  @IsString() nombre: string;
  @IsOptional() @IsString() ruc?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() direccion?: string;
}
export class ActualizarProveedorDto {
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsString() ruc?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() direccion?: string;
  @IsOptional() @IsBoolean() activo?: boolean;
}

export class CrearUbicacionDto {
  @IsString() nombre: string;
  @IsOptional() @IsString() descripcion?: string;
}
export class ActualizarUbicacionDto {
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsBoolean() activo?: boolean;
}
