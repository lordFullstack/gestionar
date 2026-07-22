import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import { BitacoraService } from '../shared/bitacora.service';
import {
  CrearClienteDto,
  ActualizarClienteDto,
  CrearDireccionDto,
  CrearContactoDto,
  CrearReferenciaDto,
  CrearDocumentoDto,
} from './dto/cliente.dto';

@Injectable()
export class ClientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacoraService: BitacoraService,
  ) {}

  async listar(filtro?: { busqueda?: string; clasificacion?: string }) {
    return this.prisma.cliente.findMany({
      where: {
        activo: true,
        clasificacion: filtro?.clasificacion,
        OR: filtro?.busqueda
          ? [
              { nombre: { contains: filtro.busqueda, mode: 'insensitive' } },
              { numeroDocumento: { contains: filtro.busqueda, mode: 'insensitive' } },
              { telefono: { contains: filtro.busqueda, mode: 'insensitive' } },
            ]
          : undefined,
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async obtener(id: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id },
      include: { direcciones: true, contactos: true, referencias: true, documentos: true },
    });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');
    return cliente;
  }

  async crear(dto: CrearClienteDto) {
    if (dto.numeroDocumento) {
      const existe = await this.prisma.cliente.findUnique({ where: { numeroDocumento: dto.numeroDocumento } });
      if (existe) throw new ConflictException('Ya existe un cliente con ese número de documento');
    }
    return this.prisma.cliente.create({
      data: { ...dto, fechaNacimiento: dto.fechaNacimiento ? new Date(dto.fechaNacimiento) : undefined },
    });
  }

  async actualizar(id: string, dto: ActualizarClienteDto) {
    await this.obtener(id);
    return this.prisma.cliente.update({
      where: { id },
      data: { ...dto, fechaNacimiento: dto.fechaNacimiento ? new Date(dto.fechaNacimiento) : undefined },
    });
  }

  async desactivar(id: string) {
    await this.obtener(id);
    return this.prisma.cliente.update({ where: { id }, data: { activo: false } });
  }

  // ---------- Historial de compras ----------
  async historialCompras(id: string) {
    await this.obtener(id);
    const ventas = await this.prisma.venta.findMany({
      where: { clienteId: id },
      include: { items: true, pagos: true },
      orderBy: { creadoEn: 'desc' },
    });

    const totalComprado = ventas
      .filter((v) => v.estado === 'completada')
      .reduce((s, v) => s + Number(v.total), 0);

    return { ventas, totalComprado, cantidadCompras: ventas.filter((v) => v.estado === 'completada').length };
  }

  // ---------- Direcciones ----------
  async agregarDireccion(clienteId: string, dto: CrearDireccionDto) {
    await this.obtener(clienteId);
    if (dto.esPrincipal) {
      await this.prisma.clienteDireccion.updateMany({ where: { clienteId }, data: { esPrincipal: false } });
    }
    return this.prisma.clienteDireccion.create({ data: { ...dto, clienteId } });
  }

  async eliminarDireccion(clienteId: string, direccionId: string) {
    await this.asegurarPertenece(this.prisma.clienteDireccion, direccionId, clienteId, 'Dirección');
    return this.prisma.clienteDireccion.delete({ where: { id: direccionId } });
  }

  // ---------- Contactos ----------
  async agregarContacto(clienteId: string, dto: CrearContactoDto) {
    await this.obtener(clienteId);
    return this.prisma.clienteContacto.create({ data: { ...dto, clienteId } });
  }

  async eliminarContacto(clienteId: string, contactoId: string) {
    await this.asegurarPertenece(this.prisma.clienteContacto, contactoId, clienteId, 'Contacto');
    return this.prisma.clienteContacto.delete({ where: { id: contactoId } });
  }

  // ---------- Referencias ----------
  async agregarReferencia(clienteId: string, dto: CrearReferenciaDto) {
    await this.obtener(clienteId);
    return this.prisma.clienteReferencia.create({ data: { ...dto, clienteId } });
  }

  async eliminarReferencia(clienteId: string, referenciaId: string) {
    await this.asegurarPertenece(this.prisma.clienteReferencia, referenciaId, clienteId, 'Referencia');
    return this.prisma.clienteReferencia.delete({ where: { id: referenciaId } });
  }

  // ---------- Documentos ----------
  async agregarDocumento(clienteId: string, dto: CrearDocumentoDto, subidoPor: string) {
    await this.obtener(clienteId);
    return this.prisma.clienteDocumento.create({ data: { ...dto, clienteId, subidoPor } });
  }

  async eliminarDocumento(clienteId: string, documentoId: string) {
    await this.asegurarPertenece(this.prisma.clienteDocumento, documentoId, clienteId, 'Documento');
    return this.prisma.clienteDocumento.delete({ where: { id: documentoId } });
  }

  // ---------- Clasificación y observaciones ----------
  // usuarioId es opcional: Créditos invoca este método automáticamente
  // (cron de mora / revisión al saldar) sin un actor humano detrás.
  async clasificar(id: string, clasificacion: 'regular' | 'vip' | 'moroso', usuarioId?: string) {
    const clienteAnterior = await this.obtener(id);
    const cliente = await this.prisma.cliente.update({ where: { id }, data: { clasificacion } });

    await this.bitacoraService.registrar({
      usuarioId,
      accion: 'cambiar_clasificacion',
      modulo: 'clientes',
      entidadId: id,
      detalle: { clasificacionAnterior: clienteAnterior.clasificacion, clasificacionNueva: clasificacion },
    });

    return cliente;
  }

  private async asegurarPertenece(modelo: any, id: string, clienteId: string, etiqueta: string) {
    const registro = await modelo.findUnique({ where: { id } });
    if (!registro) throw new NotFoundException(`${etiqueta} no encontrada`);
    if (registro.clienteId !== clienteId) throw new BadRequestException(`${etiqueta} no pertenece a este cliente`);
    return registro;
  }
}
