import { Module } from '@nestjs/common';
import { CreditosController } from './creditos.controller';
import { CreditosService } from './creditos.service';
import { PrismaService } from '../shared/prisma.service';
import { BitacoraService } from '../shared/bitacora.service';
import { CajaModule } from '../caja/caja.module';
import { ClientesModule } from '../clientes/clientes.module';
import { ContabilidadModule } from '../contabilidad/contabilidad.module';

@Module({
  imports: [CajaModule, ClientesModule, ContabilidadModule],
  controllers: [CreditosController],
  providers: [CreditosService, PrismaService, BitacoraService],
  exports: [CreditosService],
})
export class CreditosModule {}
