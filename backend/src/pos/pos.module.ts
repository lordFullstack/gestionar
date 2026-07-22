import { Module } from '@nestjs/common';
import { VentasController } from './ventas.controller';
import { VentasService } from './ventas.service';
import { PrismaService } from '../shared/prisma.service';
import { BitacoraService } from '../shared/bitacora.service';
import { InventarioModule } from '../inventario/inventario.module';
import { CajaModule } from '../caja/caja.module';
import { ContabilidadModule } from '../contabilidad/contabilidad.module';

@Module({
  imports: [InventarioModule, CajaModule, ContabilidadModule], // reusa MovimientosService, CajaService y ContabilidadService ya probados
  controllers: [VentasController],
  providers: [VentasService, PrismaService, BitacoraService],
  exports: [VentasService],
})
export class PosModule {}
