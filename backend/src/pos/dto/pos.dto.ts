import { IsArray, IsIn, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ItemVentaDto {
  @IsUUID() productoId: string;
  @IsNumber() @Min(0.01) cantidad: number;
  @IsNumber() @Min(0) precioUnitario: number;
  @IsOptional() @IsNumber() @Min(0) descuento?: number;
}

export class PagoDto {
  @IsIn(['efectivo', 'tarjeta', 'transferencia', 'credito'])
  metodo: 'efectivo' | 'tarjeta' | 'transferencia' | 'credito';

  @IsNumber() @Min(0.01) monto: number;
  @IsOptional() @IsString() referencia?: string;
}

export class CrearVentaDto {
  @IsOptional() @IsIn(['venta', 'cotizacion', 'apartado'])
  tipo?: 'venta' | 'cotizacion' | 'apartado';

  @IsOptional() @IsUUID() clienteId?: string;

  @IsUUID() ubicacionId: string; // de dónde se descuenta el stock

  @IsArray() @ValidateNested({ each: true }) @Type(() => ItemVentaDto)
  items: ItemVentaDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PagoDto)
  pagos?: PagoDto[];

  @IsOptional() @IsNumber() @Min(0) impuesto?: number;
}

export class AbonarVentaDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => PagoDto)
  pagos: PagoDto[];
}

export class DevolucionItemDto {
  @IsUUID() ventaItemId: string;
  @IsNumber() @Min(0.01) cantidad: number;
}

export class CrearDevolucionDto {
  @IsUUID() ventaId: string;
  @IsOptional() @IsString() motivo?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => DevolucionItemDto)
  items: DevolucionItemDto[];
}
