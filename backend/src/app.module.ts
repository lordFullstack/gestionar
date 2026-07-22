import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { InventarioModule } from './inventario/inventario.module';
import { CajaModule } from './caja/caja.module';
import { PosModule } from './pos/pos.module';
import { ClientesModule } from './clientes/clientes.module';
import { CreditosModule } from './creditos/creditos.module';
import { ComprasModule } from './compras/compras.module';
import { ContabilidadModule } from './contabilidad/contabilidad.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { JwtAuthGuard } from './shared/guards/jwt-auth.guard';

@Module({
  imports: [
    AuthModule,
    UsuariosModule,
    InventarioModule,
    CajaModule,
    PosModule,
    ClientesModule,
    CreditosModule,
    ComprasModule,
    ContabilidadModule,
    DashboardModule,
    AuditoriaModule,
    // Próximos módulos se agregan aquí sin tocar los anteriores:
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // protege TODO por defecto; @Public() lo desactiva puntualmente
    },
  ],
})
export class AppModule {}
