import { Module } from '@nestjs/common';
import { CajaController } from './caja.controller';
import { CajaService } from './caja.service';
import { PrismaService } from '../shared/prisma.service';
import { BitacoraService } from '../shared/bitacora.service';
import { ContabilidadModule } from '../contabilidad/contabilidad.module';

@Module({
  imports: [ContabilidadModule],
  controllers: [CajaController],
  providers: [CajaService, PrismaService, BitacoraService],
  exports: [CajaService], // el módulo POS lo necesita para registrar ingresos de ventas
})
export class CajaModule {}
