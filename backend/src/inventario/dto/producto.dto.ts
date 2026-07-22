import { IsString, IsOptional, IsBoolean, IsUUID, IsNumber, Min, IsIn } from 'class-validator';

export class CrearProductoDto {
  @IsString() sku: string;
  @IsOptional() @IsString() codigoBarras?: string;
  @IsString() nombre: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsUUID() categoriaId?: string;
  @IsOptional() @IsUUID() marcaId?: string;
  @IsOptional() @IsUUID() proveedorId?: string;
  @IsNumber() @Min(0) precioCosto: number;
  @IsNumber() @Min(0) precioVenta: number;
  @IsOptional() @IsString() unidadMedida?: string;
  @IsOptional() @IsNumber() @Min(0) stockMinimo?: number;
  @IsOptional() @IsNumber() @Min(0) stockMaximo?: number;
  @IsOptional() @IsBoolean() manejaLotes?: boolean;
  @IsOptional() @IsBoolean() manejaSeries?: boolean;
}

export class ActualizarProductoDto {
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsUUID() categoriaId?: string;
  @IsOptional() @IsUUID() marcaId?: string;
  @IsOptional() @IsUUID() proveedorId?: string;
  @IsOptional() @IsNumber() @Min(0) precioCosto?: number;
  @IsOptional() @IsNumber() @Min(0) precioVenta?: number;
  @IsOptional() @IsString() unidadMedida?: string;
  @IsOptional() @IsNumber() @Min(0) stockMinimo?: number;
  @IsOptional() @IsNumber() @Min(0) stockMaximo?: number;
  @IsOptional() @IsBoolean() activo?: boolean;
}

export class RegistrarMovimientoDto {
  @IsUUID() productoId: string;

  @IsIn(['entrada', 'salida', 'ajuste_positivo', 'ajuste_negativo', 'transferencia'])
  tipo: 'entrada' | 'salida' | 'ajuste_positivo' | 'ajuste_negativo' | 'transferencia';

  @IsNumber() @Min(1) cantidad: number;

  @IsOptional() @IsNumber() @Min(0) costoUnitario?: number;

  @IsOptional() @IsUUID() ubicacionOrigenId?: string;
  @IsOptional() @IsUUID() ubicacionDestinoId?: string;

  @IsOptional() @IsString() referenciaTipo?: string;
  @IsOptional() @IsString() referenciaId?: string;
  @IsOptional() @IsString() motivo?: string;
}
