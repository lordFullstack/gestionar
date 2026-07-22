import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';

@Injectable()
export class CatalogosService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Categorías ----------
  listarCategorias() {
    return this.prisma.categoria.findMany({ orderBy: { nombre: 'asc' } });
  }
  async crearCategoria(nombre: string) {
    const existe = await this.prisma.categoria.findUnique({ where: { nombre } });
    if (existe) throw new ConflictException('Ya existe una categoría con ese nombre');
    return this.prisma.categoria.create({ data: { nombre } });
  }
  async actualizarCategoria(id: string, data: { nombre?: string; activo?: boolean }) {
    await this.asegurarExiste(this.prisma.categoria, id, 'Categoría');
    return this.prisma.categoria.update({ where: { id }, data });
  }

  // ---------- Marcas ----------
  listarMarcas() {
    return this.prisma.marca.findMany({ orderBy: { nombre: 'asc' } });
  }
  async crearMarca(nombre: string) {
    const existe = await this.prisma.marca.findUnique({ where: { nombre } });
    if (existe) throw new ConflictException('Ya existe una marca con ese nombre');
    return this.prisma.marca.create({ data: { nombre } });
  }
  async actualizarMarca(id: string, data: { nombre?: string; activo?: boolean }) {
    await this.asegurarExiste(this.prisma.marca, id, 'Marca');
    return this.prisma.marca.update({ where: { id }, data });
  }

  // ---------- Proveedores ----------
  listarProveedores() {
    return this.prisma.proveedor.findMany({ orderBy: { nombre: 'asc' } });
  }
  crearProveedor(data: { nombre: string; ruc?: string; telefono?: string; email?: string; direccion?: string }) {
    return this.prisma.proveedor.create({ data });
  }
  async actualizarProveedor(id: string, data: Partial<{ nombre: string; ruc: string; telefono: string; email: string; direccion: string; activo: boolean }>) {
    await this.asegurarExiste(this.prisma.proveedor, id, 'Proveedor');
    return this.prisma.proveedor.update({ where: { id }, data });
  }

  // ---------- Ubicaciones ----------
  listarUbicaciones() {
    return this.prisma.ubicacion.findMany({ orderBy: { nombre: 'asc' } });
  }
  async crearUbicacion(nombre: string, descripcion?: string) {
    const existe = await this.prisma.ubicacion.findUnique({ where: { nombre } });
    if (existe) throw new ConflictException('Ya existe una ubicación con ese nombre');
    return this.prisma.ubicacion.create({ data: { nombre, descripcion } });
  }
  async actualizarUbicacion(id: string, data: { nombre?: string; descripcion?: string; activo?: boolean }) {
    await this.asegurarExiste(this.prisma.ubicacion, id, 'Ubicación');
    return this.prisma.ubicacion.update({ where: { id }, data });
  }

  private async asegurarExiste(modelo: any, id: string, etiqueta: string) {
    const registro = await modelo.findUnique({ where: { id } });
    if (!registro) throw new NotFoundException(`${etiqueta} no encontrada`);
    return registro;
  }
}
