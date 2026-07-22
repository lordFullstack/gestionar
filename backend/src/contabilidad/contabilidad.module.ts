import { Module } from '@nestjs/common';
import { ContabilidadController } from './contabilidad.controller';
import { ContabilidadService } from './contabilidad.service';
import { PrismaService } from '../shared/prisma.service';
import { BitacoraService } from '../shared/bitacora.service';

@Module({
  controllers: [ContabilidadController],
  providers: [ContabilidadService, PrismaService, BitacoraService],
  exports: [ContabilidadService], // POS, Compras, Caja y Créditos lo inyectan para registrar sus asientos
})
export class ContabilidadModule {}
