import { IsString, IsUUID, IsInt, IsNumber, IsOptional, IsArray, ValidateNested, Min, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class ItemRecepcionDto {
  @IsUUID() ordenCompraItemId: string;
  @IsInt() @Min(1) cantidad: number;

  // Solo si el costo real de entrega difiere del costo pactado en la orden
  @IsOptional() @IsNumber() @Min(0) costoUnitario?: number;
}

export class CrearRecepcionDto {
  @IsUUID() ubicacionId: string;
  @IsOptional() @IsString() observaciones?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemRecepcionDto)
  items: ItemRecepcionDto[];
}
