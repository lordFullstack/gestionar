import { Body, Controller, Get, Post, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto } from './dto/login.dto';
import { Public } from '../shared/decorators/public.decorator';
import { UsuarioActual } from '../shared/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto.email, dto.password, req.ip);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refrescarToken(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body() dto: RefreshDto) {
    return this.authService.logout(dto.refreshToken);
  }

  // Requiere JWT válido (protegido por el guard global, no lleva @Public()).
  // Le da al frontend una forma de restaurar la sesión (nombre, rol,
  // permisos) tras un refresh de página sin tener que decodificar el JWT
  // a mano ni volver a pedir credenciales.
  @Get('me')
  @HttpCode(HttpStatus.OK)
  me(@UsuarioActual() actor: any) {
    return actor; // ya trae { id, nombre, email, rol, permisos } vía JwtStrategy.validate()
  }
}
