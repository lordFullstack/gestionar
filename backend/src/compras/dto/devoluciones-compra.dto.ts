import { IsString, IsUUID, IsInt, IsNumber, IsOptional, IsArray, ValidateNested, Min, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class ItemDevolucionCompraDto {
  @IsUUID() productoId: string;
  @IsInt() @Min(1) cantidad: number;
  @IsNumber() @Min(0) costoUnitario: number;
}

export class CrearDevolucionCompraDto {
  @IsUUID() proveedorId: string;
  @IsOptional() @IsUUID() facturaCompraId?: string;
  @IsUUID() ubicacionId: string;
  @IsOptional() @IsString() motivo?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemDevolucionCompraDto)
  items: ItemDevolucionCompraDto[];
}
