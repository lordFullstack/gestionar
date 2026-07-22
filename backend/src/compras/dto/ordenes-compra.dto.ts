import { IsString, IsUUID, IsInt, IsNumber, IsOptional, IsArray, ValidateNested, Min, IsDateString, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class ItemOrdenCompraDto {
  @IsUUID() productoId: string;
  @IsInt() @Min(1) cantidadSolicitada: number;
  @IsNumber() @Min(0) costoUnitario: number;
}

export class CrearOrdenCompraDto {
  @IsUUID() proveedorId: string;

  @IsOptional() @IsDateString() fechaEntregaEsperada?: string;
  @IsOptional() @IsString() observaciones?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemOrdenCompraDto)
  items: ItemOrdenCompraDto[];
}

export class ActualizarOrdenCompraDto {
  @IsOptional() @IsDateString() fechaEntregaEsperada?: string;
  @IsOptional() @IsString() observaciones?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemOrdenCompraDto)
  items?: ItemOrdenCompraDto[];
}

export class AnularOrdenCompraDto {
  @IsOptional() @IsString() motivo?: string;
}
