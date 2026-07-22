import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISO_KEY, PermisoRequerido } from '../decorators/requiere-permiso.decorator';

@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requerido = this.reflector.getAllAndOverride<PermisoRequerido>(PERMISO_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si el endpoint no pidió un permiso específico, solo requiere estar autenticado
    if (!requerido) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('No autenticado');

    // Administrador siempre pasa (ajustable si se quiere quitar este atajo)
    if (user.rol === 'Administrador') return true;

    const permisoModulo = user.permisos?.find((p: any) => p.modulo === requerido.modulo);

    if (!permisoModulo || !permisoModulo[requerido.accion]) {
      throw new ForbiddenException(
        `El rol "${user.rol}" no tiene permiso de "${requerido.accion}" en el módulo "${requerido.modulo}"`,
      );
    }

    return true;
  }
}
