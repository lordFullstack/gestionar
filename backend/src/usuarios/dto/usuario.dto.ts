import { IsEmail, IsString, MinLength, IsUUID, IsOptional, IsBoolean } from 'class-validator';

export class CrearUsuarioDto {
  @IsString()
  nombre: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password: string;

  @IsUUID()
  rolId: string;
}

export class ActualizarUsuarioDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsUUID()
  rolId?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class CambiarPasswordDto {
  @IsString()
  passwordActual: string;

  @IsString()
  @MinLength(8)
  passwordNueva: string;
}
