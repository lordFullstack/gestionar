import { Module } from '@nestjs/common';
import { CatalogosController } from './catalogos.controller';
import { CatalogosService } from './catalogos.service';
import { ProductosController } from './productos.controller';
import { ProductosService } from './productos.service';
import { MovimientosController } from './movimientos.controller';
import { MovimientosService } from './movimientos.service';
import { PrismaService } from '../shared/prisma.service';
import { BitacoraService } from '../shared/bitacora.service';

@Module({
  controllers: [CatalogosController, ProductosController, MovimientosController],
  providers: [CatalogosService, ProductosService, MovimientosService, PrismaService, BitacoraService],
  exports: [ProductosService, MovimientosService], // otros módulos (POS, Compras) los necesitarán
})
export class InventarioModule {}
