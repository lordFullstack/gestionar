import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../shared/prisma.service';
import { CrearUsuarioDto, ActualizarUsuarioDto, CambiarPasswordDto } from './dto/usuario.dto';

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar() {
    return this.prisma.usuario.findMany({
      select: {
        id: true,
        nombre: true,
        email: true,
        activo: true,
        ultimoLogin: true,
        creadoEn: true,
        rol: { select: { id: true, nombre: true } },
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async obtener(id: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        email: true,
        activo: true,
        ultimoLogin: true,
        rol: { include: { permisos: true } },
      },
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    return usuario;
  }

  async crear(dto: CrearUsuarioDto, actorId: string) {
    const existente = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
    if (existente) throw new ConflictException('Ya existe un usuario con ese email');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const usuario = await this.prisma.usuario.create({
      data: { nombre: dto.nombre, email: dto.email, passwordHash, rolId: dto.rolId },
    });

    await this.prisma.bitacora.create({
      data: { usuarioId: actorId, accion: 'crear', modulo: 'usuarios', entidadId: usuario.id },
    });

    const { passwordHash: _omit, ...usuarioSinPassword } = usuario;
    return usuarioSinPassword;
  }

  async actualizar(id: string, dto: ActualizarUsuarioDto, actorId: string) {
    await this.obtener(id); // valida existencia

    const usuario = await this.prisma.usuario.update({
      where: { id },
      data: dto,
    });

    await this.prisma.bitacora.create({
      data: { usuarioId: actorId, accion: 'editar', modulo: 'usuarios', entidadId: id, detalle: dto as any },
    });

    const { passwordHash: _omit, ...usuarioSinPassword } = usuario;
    return usuarioSinPassword;
  }

  async cambiarPassword(id: string, dto: CambiarPasswordDto) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const passwordValida = await bcrypt.compare(dto.passwordActual, usuario.passwordHash);
    if (!passwordValida) throw new BadRequestException('La contraseña actual no es correcta');

    const nuevoHash = await bcrypt.hash(dto.passwordNueva, 10);
    await this.prisma.usuario.update({ where: { id }, data: { passwordHash: nuevoHash } });

    await this.prisma.bitacora.create({
      data: { usuarioId: id, accion: 'cambio_password', modulo: 'usuarios', entidadId: id },
    });

    return { ok: true };
  }

  // Desactivar en vez de borrar: preserva integridad histórica (ventas, créditos, etc. quedan con referencia válida)
  async desactivar(id: string, actorId: string) {
    await this.obtener(id);
    await this.prisma.usuario.update({ where: { id }, data: { activo: false } });
    await this.prisma.bitacora.create({
      data: { usuarioId: actorId, accion: 'eliminar', modulo: 'usuarios', entidadId: id },
    });
    return { ok: true };
  }

  async listarRoles() {
    return this.prisma.rol.findMany({
      include: { permisos: true },
      orderBy: { nombre: 'asc' },
    });
  }
}
