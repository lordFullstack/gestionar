import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../shared/prisma.service';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DIAS = 7;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string, ip?: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
      include: { rol: { include: { permisos: true } } },
    });

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordValida = await bcrypt.compare(password, usuario.passwordHash);
    if (!passwordValida) {
      // No revelar si fue el email o el password lo que falló
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const accessToken = this.jwtService.sign(
      { sub: usuario.id, email: usuario.email },
      { expiresIn: ACCESS_TOKEN_TTL },
    );
    const refreshToken = await this.generarRefreshToken(usuario.id);

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoLogin: new Date() },
    });

    await this.prisma.bitacora.create({
      data: { usuarioId: usuario.id, accion: 'login', modulo: 'usuarios', ip },
    });

    return {
      accessToken,
      refreshToken,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol.nombre,
        permisos: usuario.rol.permisos,
      },
    };
  }

  async refrescarToken(refreshTokenValor: string) {
    const registro = await this.prisma.refreshToken.findUnique({
      where: { token: refreshTokenValor },
      include: { usuario: true },
    });

    if (!registro || registro.revocado || registro.expiraEn < new Date()) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const accessToken = this.jwtService.sign(
      { sub: registro.usuario.id, email: registro.usuario.email },
      { expiresIn: ACCESS_TOKEN_TTL },
    );

    return { accessToken };
  }

  async logout(refreshTokenValor: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token: refreshTokenValor },
      data: { revocado: true },
    });
    return { ok: true };
  }

  private async generarRefreshToken(usuarioId: string): Promise<string> {
    const token = crypto.randomBytes(48).toString('hex');
    const expiraEn = new Date();
    expiraEn.setDate(expiraEn.getDate() + REFRESH_TOKEN_TTL_DIAS);

    await this.prisma.refreshToken.create({
      data: { token, usuarioId, expiraEn },
    });

    return token;
  }
}
