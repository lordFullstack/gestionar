import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import { ProductosService } from '../inventario/productos.service';
import { CajaService } from '../caja/caja.service';
import { CreditosService } from '../creditos/creditos.service';
import { VentasService } from '../pos/ventas.service';
import { FacturasCompraService } from '../compras/facturas-compra.service';

// Este módulo NO tiene tablas propias: solo compone datos que ya existen
// en Inventario, Caja, Créditos y POS. Toda la lógica de negocio (qué es
// "stock bajo", qué crédito está "vencido", etc.) vive en esos módulos —
// aquí solo se agrega/formatea para consumo del futuro frontend.
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productosService: ProductosService,
    private readonly cajaService: CajaService,
    private readonly creditosService: CreditosService,
    private readonly ventasService: VentasService,
    private readonly facturasCompraService: FacturasCompraService,
  ) {}

  // ---------- Resumen para pantalla principal ----------
  async resumen(usuarioId: string) {
    const hoyInicio = new Date();
    hoyInicio.setHours(0, 0, 0, 0);
    const hoyFin = new Date();
    hoyFin.setHours(23, 59, 59, 999);

    const [ventasHoy, stockBajo, agotados, porVencer, creditosVencidos, cajaAbierta] = await Promise.all([
      this.ventasService.listar({ estado: 'completada', desde: hoyInicio, hasta: hoyFin }),
      this.productosService.productosStockBajo(),
      this.productosService.productosAgotados(),
      this.productosService.productosProximosAVencer(30),
      this.creditosService.alertaCreditosVencidos(),
      this.cajaService.obtenerCajaAbierta(usuarioId).catch(() => null), // no todos tienen caja abierta ahora mismo
    ]);

    const totalVentasHoy = ventasHoy.reduce(
      (s, v) => s + v.pagos.reduce((sp, p) => sp + Number(p.monto), 0),
      0,
    );

    return {
      fecha: new Date().toISOString().slice(0, 10),
      ventas: {
        cantidadHoy: ventasHoy.length,
        totalHoy: Math.round(totalVentasHoy * 100) / 100,
      },
      caja: cajaAbierta
        ? { estado: 'abierta', id: cajaAbierta.id, abiertaEn: cajaAbierta.abiertaEn }
        : { estado: 'cerrada' },
      alertasInventario: {
        stockBajo: stockBajo.length,
        agotados: agotados.length,
        proximosAVencer: porVencer.length,
      },
      cartera: {
        clientesEnMora: creditosVencidos.length,
      },
    };
  }

  // ---------- Informe de ventas ----------
  async informeVentas(filtros: { desde?: string; hasta?: string }) {
    const desde = filtros.desde ? new Date(filtros.desde) : undefined;
    const hasta = filtros.hasta ? new Date(filtros.hasta) : undefined;
    const ventas = await this.ventasService.listar({ estado: 'completada', desde, hasta });

    const totalVentas = ventas.reduce((s, v) => s + v.pagos.reduce((sp, p) => sp + Number(p.monto), 0), 0);
    const totalItems = ventas.reduce((s, v) => s + v.items.length, 0);

    // ranking simple de productos más vendidos (por cantidad) en el período
    const cantidadPorProducto = new Map<string, number>();
    for (const venta of ventas) {
      for (const item of venta.items as any[]) {
        cantidadPorProducto.set(item.productoId, (cantidadPorProducto.get(item.productoId) ?? 0) + item.cantidad);
      }
    }
    const topProductoIds = [...cantidadPorProducto.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const productos = await this.prisma.producto.findMany({
      where: { id: { in: topProductoIds.map(([id]) => id) } },
    });
    const productosPorId = new Map(productos.map((p) => [p.id, p]));

    return {
      periodo: { desde: filtros.desde ?? null, hasta: filtros.hasta ?? null },
      totales: {
        cantidadVentas: ventas.length,
        totalVendido: Math.round(totalVentas * 100) / 100,
        itemsVendidos: totalItems,
      },
      topProductos: topProductoIds.map(([productoId, cantidad]) => ({
        producto: productosPorId.get(productoId)?.nombre ?? 'Producto eliminado',
        cantidadVendida: cantidad,
      })),
    };
  }

  // ---------- Informe de inventario ----------
  async informeInventario() {
    const [stockBajo, agotados, porVencer, productos] = await Promise.all([
      this.productosService.productosStockBajo(),
      this.productosService.productosAgotados(),
      this.productosService.productosProximosAVencer(30),
      this.prisma.producto.findMany({ where: { activo: true }, include: { stocks: true } }),
    ]);

    const valorizacionTotal = productos.reduce((suma, p) => {
      const stockTotal = p.stocks.reduce((s, st) => s + st.cantidad, 0);
      return suma + stockTotal * Number(p.precioCosto ?? 0);
    }, 0);

    return {
      valorizacionInventario: Math.round(valorizacionTotal * 100) / 100,
      totalProductosActivos: productos.length,
      alertas: {
        stockBajo: stockBajo.map((p) => ({ id: p.id, nombre: p.nombre, stockTotal: p.stockTotal, stockMinimo: p.stockMinimo })),
        agotados: agotados.map((p) => ({ id: p.id, nombre: p.nombre })),
        proximosAVencer: porVencer.map((l) => ({
          producto: l.producto?.nombre,
          lote: l.numeroLote,
          fechaVencimiento: l.fechaVencimiento,
          cantidad: l.cantidad,
        })),
      },
    };
  }

  // ---------- Informe de cartera (créditos) ----------
  async informeCartera() {
    const [vencidas, proximasAVencer] = await Promise.all([
      this.creditosService.listaCobranza(),
      this.creditosService.alertaProximosAVencer(7),
    ]);

    const saldoCuota = (c: any) => Number(c.montoTotal) - Number(c.montoPagado);
    const totalEnMora = vencidas.reduce((s, c: any) => s + saldoCuota(c), 0);

    return {
      cuotasVencidas: vencidas.map((c: any) => ({
        cliente: c.credito?.cliente?.nombre,
        credito: c.creditoId,
        diasMora: c.diasMora,
        saldoPendiente: Math.round(saldoCuota(c) * 100) / 100,
        fechaVencimiento: c.fechaVencimiento,
      })),
      proximasAVencer: proximasAVencer.map((c: any) => ({
        cliente: c.credito?.cliente?.nombre,
        credito: c.creditoId,
        saldoPendiente: Math.round(saldoCuota(c) * 100) / 100,
        fechaVencimiento: c.fechaVencimiento,
      })),
      totales: {
        cuotasVencidas: vencidas.length,
        montoTotalEnMora: Math.round(totalEnMora * 100) / 100,
        cuotasProximasAVencer: proximasAVencer.length,
      },
    };
  }

  // ---------- Informe de compras (cuentas por pagar) ----------
  async informeCompras(filtros: { proveedorId?: string }) {
    const pendientes = await this.facturasCompraService.listar({ estado: 'pendiente', proveedorId: filtros.proveedorId });
    const parciales = await this.facturasCompraService.listar({ estado: 'parcial', proveedorId: filtros.proveedorId });
    const vencidas = await this.facturasCompraService.listar({ estado: 'vencida', proveedorId: filtros.proveedorId });

    const todasPorPagar = [...pendientes, ...parciales, ...vencidas];
    const totalPorPagar = todasPorPagar.reduce((s, f) => s + Number(f.saldoPendiente), 0);

    // agrupado por proveedor, útil para saber a quién se le debe más
    const porProveedor = new Map<string, { proveedor: string; saldo: number; facturas: number }>();
    for (const f of todasPorPagar as any[]) {
      const key = f.proveedorId;
      if (!porProveedor.has(key)) porProveedor.set(key, { proveedor: f.proveedor?.nombre ?? '—', saldo: 0, facturas: 0 });
      const acc = porProveedor.get(key)!;
      acc.saldo += Number(f.saldoPendiente);
      acc.facturas += 1;
    }

    return {
      totales: {
        facturasPorPagar: todasPorPagar.length,
        saldoTotalPorPagar: Math.round(totalPorPagar * 100) / 100,
        facturasVencidas: vencidas.length,
      },
      porProveedor: Array.from(porProveedor.values())
        .map((p) => ({ ...p, saldo: Math.round(p.saldo * 100) / 100 }))
        .sort((a, b) => b.saldo - a.saldo),
    };
  }

  // ---------- Informe de caja (histórico de cierres) ----------
  async informeCaja(filtros: { desde?: string; hasta?: string }) {
    const desde = filtros.desde ? new Date(filtros.desde) : undefined;
    const hasta = filtros.hasta ? new Date(filtros.hasta) : undefined;
    const cierres = await this.cajaService.historial(desde, hasta);

    const cerradas = (cierres as any[]).filter((c) => c.estado === 'cerrada');
    const diferenciaAcumulada = cerradas.reduce((s, c) => s + Number(c.diferencia ?? 0), 0);

    return {
      totalCierres: cerradas.length,
      diferenciaAcumulada: Math.round(diferenciaAcumulada * 100) / 100,
      historial: cierres,
    };
  }
}
