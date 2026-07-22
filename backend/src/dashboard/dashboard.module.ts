import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../shared/prisma.service';
import { InventarioModule } from '../inventario/inventario.module';
import { CajaModule } from '../caja/caja.module';
import { CreditosModule } from '../creditos/creditos.module';
import { PosModule } from '../pos/pos.module';
import { ComprasModule } from '../compras/compras.module';

@Module({
  imports: [InventarioModule, CajaModule, CreditosModule, PosModule, ComprasModule], // solo lectura: reutiliza todo, no duplica lógica
  controllers: [DashboardController],
  providers: [DashboardService, PrismaService],
})
export class DashboardModule {}
