import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Módulos del sistema (se irán agregando más a medida que se construyan)
const MODULOS = [
  'pos',
  'caja',
  'clientes',
  'inventario',
  'creditos',
  'compras',
  'contabilidad',
  'informes',
  'usuarios',
  'auditoria',
];

// Matriz de permisos por defecto por rol.
// true en todas las acciones = acceso total; se ajusta fino después desde la UI de Usuarios.
const MATRIZ_ROLES: Record<
  string,
  Record<string, { crear: boolean; editar: boolean; eliminar: boolean; aprobar: boolean; imprimir: boolean; exportar: boolean }>
> = {
  Administrador: full(MODULOS, true),
  Gerente: full(MODULOS, true, { eliminar: false }),
  Supervisor: full(['pos', 'caja', 'clientes', 'inventario', 'creditos', 'compras', 'informes'], true, {
    eliminar: false,
  }),
  Cajero: only(['pos', 'caja', 'clientes'], { crear: true, editar: false, eliminar: false, aprobar: false, imprimir: true, exportar: false }),
  Vendedor: only(['pos', 'clientes', 'creditos'], { crear: true, editar: false, eliminar: false, aprobar: false, imprimir: true, exportar: false }),
  Bodega: only(['inventario', 'compras'], { crear: true, editar: true, eliminar: false, aprobar: false, imprimir: true, exportar: false }),
  Contabilidad: only(['contabilidad', 'informes', 'compras'], {
    crear: true,
    editar: true,
    eliminar: false,
    aprobar: true,
    imprimir: true,
    exportar: true,
  }),
  Cobranza: only(['creditos', 'clientes'], { crear: true, editar: true, eliminar: false, aprobar: false, imprimir: true, exportar: true }),
  Consulta: only(
    MODULOS.filter((m) => m !== 'auditoria'),
    { crear: false, editar: false, eliminar: false, aprobar: false, imprimir: false, exportar: true },
  ),
};

function full(
  modulos: string[],
  valor: boolean,
  overrides: Partial<{ crear: boolean; editar: boolean; eliminar: boolean; aprobar: boolean; imprimir: boolean; exportar: boolean }> = {},
) {
  const base = Object.fromEntries(
    modulos.map((m) => [
      m,
      { crear: valor, editar: valor, eliminar: valor, aprobar: valor, imprimir: valor, exportar: valor, ...overrides },
    ]),
  );
  return base;
}

function only(
  modulos: string[],
  acciones: { crear: boolean; editar: boolean; eliminar: boolean; aprobar: boolean; imprimir: boolean; exportar: boolean },
) {
  return Object.fromEntries(modulos.map((m) => [m, acciones]));
}

async function main() {
  console.log('Sembrando roles y permisos...');

  for (const [nombreRol, permisosPorModulo] of Object.entries(MATRIZ_ROLES)) {
    const rol = await prisma.rol.upsert({
      where: { nombre: nombreRol },
      update: {},
      create: { nombre: nombreRol, esSistema: true },
    });

    for (const [modulo, acciones] of Object.entries(permisosPorModulo)) {
      await prisma.permiso.upsert({
        where: { rolId_modulo: { rolId: rol.id, modulo } },
        update: acciones,
        create: { rolId: rol.id, modulo, ...acciones },
      });
    }
    console.log(`  ✔ Rol ${nombreRol} listo`);
  }

  // Usuario administrador inicial
  const rolAdmin = await prisma.rol.findUnique({ where: { nombre: 'Administrador' } });
  const emailAdmin = 'admin@almacen.local';
  const existente = await prisma.usuario.findUnique({ where: { email: emailAdmin } });

  if (!existente) {
    const passwordHash = await bcrypt.hash('CambiarEsta123!', 10);
    await prisma.usuario.create({
      data: {
        nombre: 'Administrador',
        email: emailAdmin,
        passwordHash,
        rolId: rolAdmin!.id,
      },
    });
    console.log(`  ✔ Usuario admin creado: ${emailAdmin} / CambiarEsta123!  (cambiar en el primer login)`);
  }

  await seedPlanDeCuentas();

  console.log('Seed completo.');
}

// Plan de cuentas mínimo para que Contabilidad funcione desde el día uno.
// Los códigos siguen la lógica del PUC colombiano simplificado (no es el PUC
// completo, solo lo necesario para los asientos automáticos de POS/Compras/Caja/Créditos).
async function seedPlanDeCuentas() {
  const cuentas: { codigo: string; nombre: string; tipo: string; naturaleza: string }[] = [
    { codigo: '1105', nombre: 'Caja general', tipo: 'activo', naturaleza: 'debito' },
    { codigo: '1110', nombre: 'Bancos', tipo: 'activo', naturaleza: 'debito' },
    { codigo: '1305', nombre: 'Cuentas por cobrar clientes', tipo: 'activo', naturaleza: 'debito' },
    { codigo: '1435', nombre: 'Inventario de mercancías', tipo: 'activo', naturaleza: 'debito' },
    { codigo: '2205', nombre: 'Cuentas por pagar proveedores', tipo: 'pasivo', naturaleza: 'credito' },
    { codigo: '3105', nombre: 'Capital social', tipo: 'patrimonio', naturaleza: 'credito' },
    { codigo: '4135', nombre: 'Ventas', tipo: 'ingreso', naturaleza: 'credito' },
    { codigo: '4210', nombre: 'Ingresos financieros (intereses de crédito)', tipo: 'ingreso', naturaleza: 'credito' },
    { codigo: '5135', nombre: 'Gastos generales', tipo: 'gasto', naturaleza: 'debito' },
    { codigo: '5195', nombre: 'Faltantes y sobrantes en caja', tipo: 'gasto', naturaleza: 'debito' },
    { codigo: '6135', nombre: 'Costo de ventas', tipo: 'costo', naturaleza: 'debito' },
  ];

  for (const cuenta of cuentas) {
    await prisma.cuentaContable.upsert({
      where: { codigo: cuenta.codigo },
      update: {},
      create: cuenta,
    });
  }
  console.log(`  ✔ Plan de cuentas: ${cuentas.length} cuentas base creadas/verificadas`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
