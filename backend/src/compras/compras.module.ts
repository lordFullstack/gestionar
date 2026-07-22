import { Module } from '@nestjs/common';
import { OrdenesCompraController } from './ordenes-compra.controller';
import { OrdenesCompraService } from './ordenes-compra.service';
import { RecepcionesService } from './recepciones.service';
import { FacturasCompraController } from './facturas-compra.controller';
import { FacturasCompraService } from './facturas-compra.service';
import { DevolucionesCompraController } from './devoluciones-compra.controller';
import { DevolucionesCompraService } from './devoluciones-compra.service';
import { PrismaService } from '../shared/prisma.service';
import { BitacoraService } from '../shared/bitacora.service';
import { InventarioModule } from '../inventario/inventario.module';
import { CajaModule } from '../caja/caja.module';
import { ContabilidadModule } from '../contabilidad/contabilidad.module';

@Module({
  imports: [InventarioModule, CajaModule, ContabilidadModule], // reusa MovimientosService, CajaService y ContabilidadService ya probados
  controllers: [OrdenesCompraController, FacturasCompraController, DevolucionesCompraController],
  providers: [OrdenesCompraService, RecepcionesService, FacturasCompraService, DevolucionesCompraService, PrismaService, BitacoraService],
  exports: [OrdenesCompraService, FacturasCompraService], // Contabilidad e Informes los necesitarán
})
export class ComprasModule {}
