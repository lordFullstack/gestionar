import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'es_publico';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// Uso: async miEndpoint(@UsuarioActual() usuario: UsuarioAutenticado)
export const UsuarioActual = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
