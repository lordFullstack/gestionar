import { IsString, IsUUID, IsNumber, IsOptional, Min, IsDateString } from 'class-validator';

export class CrearFacturaCompraDto {
  @IsUUID() proveedorId: string;
  @IsOptional() @IsUUID() ordenCompraId?: string;

  @IsString() numeroFactura: string;

  @IsOptional() @IsDateString() fechaEmision?: string;
  @IsOptional() @IsDateString() fechaVencimiento?: string;

  @IsNumber() @Min(0) subtotal: number;
  @IsOptional() @IsNumber() @Min(0) impuesto?: number;
  @IsNumber() @Min(0.01) total: number;

  @IsOptional() @IsString() observaciones?: string;
}

export class CrearPagoCompraDto {
  @IsNumber() @Min(0.01) monto: number;
  @IsString() metodo: string; // efectivo, transferencia, cheque, tarjeta
  @IsOptional() @IsString() referencia?: string;
}
