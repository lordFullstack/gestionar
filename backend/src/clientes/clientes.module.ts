import { Module } from '@nestjs/common';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';
import { PrismaService } from '../shared/prisma.service';
import { BitacoraService } from '../shared/bitacora.service';

@Module({
  controllers: [ClientesController],
  providers: [ClientesService, PrismaService, BitacoraService],
  exports: [ClientesService], // el módulo de Créditos lo necesitará
})
export class ClientesModule {}
