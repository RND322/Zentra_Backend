import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl || databaseUrl.trim().length === 0) {
  throw new Error("DATABASE_URL no está definida para ejecutar seed.");
}

const adapter = new PrismaMariaDb(databaseUrl);
const prisma = new PrismaClient({
  adapter,
});

/**
 * Inserta datos mínimos para operar el MVP local.
 */
async function main(): Promise<void> {
  const defaultPasswordHash = hashSync("Admin1234", 10);

  const adminRole = await prisma.role.upsert({
    where: { roleName: "ADMIN" },
    create: {
      roleName: "ADMIN",
      isActive: true,
    },
    update: {
      isActive: true,
    },
  });

  const sellerRole = await prisma.role.upsert({
    where: { roleName: "SELLER" },
    create: {
      roleName: "SELLER",
      isActive: true,
    },
    update: {
      isActive: true,
    },
  });

  const modules = [
    { moduleCode: "dashboard", moduleName: "Dashboard" },
    { moduleCode: "products", moduleName: "Productos" },
    { moduleCode: "inventory", moduleName: "Inventario" },
    { moduleCode: "sales", moduleName: "Ventas" },
    { moduleCode: "production", moduleName: "Producción" },
    { moduleCode: "expenses", moduleName: "Gastos" },
    { moduleCode: "reports", moduleName: "Reportes" },
    { moduleCode: "users", moduleName: "Usuarios" },
    { moduleCode: "settings", moduleName: "Configuración" },
    { moduleCode: "security", moduleName: "Seguridad" },
    { moduleCode: "audit", moduleName: "Bitácora" },
  ] as const;
  const moduleByCode = new Map<string, number>();
  for (const moduleRow of modules) {
    const persisted = await prisma.module.upsert({
      where: { moduleCode: moduleRow.moduleCode },
      create: {
        moduleCode: moduleRow.moduleCode,
        moduleName: moduleRow.moduleName,
        isActive: true,
      },
      update: {
        moduleName: moduleRow.moduleName,
        isActive: true,
      },
    });
    moduleByCode.set(moduleRow.moduleCode, persisted.idModule);
  }

  for (const moduleRow of modules) {
    const idModule = moduleByCode.get(moduleRow.moduleCode);
    if (!idModule) {
      continue;
    }
    await prisma.roleModulePermission.upsert({
      where: {
        idRole_idModule: {
          idRole: adminRole.idRole,
          idModule,
        },
      },
      create: {
        idRole: adminRole.idRole,
        idModule,
        canCreate: true,
        canRead: true,
        canUpdate: true,
        canDelete: true,
        canExport: true,
      },
      update: {
        canCreate: true,
        canRead: true,
        canUpdate: true,
        canDelete: true,
        canExport: true,
      },
    });
    const sellerCanRead =
      moduleRow.moduleCode !== "settings" &&
      moduleRow.moduleCode !== "users" &&
      moduleRow.moduleCode !== "security" &&
      moduleRow.moduleCode !== "audit";
    await prisma.roleModulePermission.upsert({
      where: {
        idRole_idModule: {
          idRole: sellerRole.idRole,
          idModule,
        },
      },
      create: {
        idRole: sellerRole.idRole,
        idModule,
        canCreate: moduleRow.moduleCode === "sales" || moduleRow.moduleCode === "production",
        canRead: sellerCanRead,
        canUpdate:
          moduleRow.moduleCode === "inventory" ||
          moduleRow.moduleCode === "sales",
        canDelete: false,
        canExport: false,
      },
      update: {
        canCreate: moduleRow.moduleCode === "sales" || moduleRow.moduleCode === "production",
        canRead: sellerCanRead,
        canUpdate:
          moduleRow.moduleCode === "inventory" ||
          moduleRow.moduleCode === "sales",
        canDelete: false,
        canExport: false,
      },
    });
  }

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@zentra.local" },
    create: {
      fullName: "Administrador Zentra",
      email: "admin@zentra.local",
      passwordHash: defaultPasswordHash,
      idRole: adminRole.idRole,
      isActive: true,
      mustChangePass: true,
    },
    update: {
      idRole: adminRole.idRole,
      isActive: true,
      mustChangePass: true,
      passwordHash: defaultPasswordHash,
    },
  });

  const sellerUser = await prisma.user.upsert({
    where: { email: "vendedor@zentra.local" },
    create: {
      fullName: "Vendedor Demo",
      email: "vendedor@zentra.local",
      passwordHash: defaultPasswordHash,
      idRole: sellerRole.idRole,
      isActive: true,
      mustChangePass: true,
    },
    update: {
      idRole: sellerRole.idRole,
      isActive: true,
      mustChangePass: true,
      passwordHash: defaultPasswordHash,
    },
  });

  const sellerAnaUser = await prisma.user.upsert({
    where: { email: "ana@zentra.local" },
    create: {
      fullName: "Ana Diaz",
      email: "ana@zentra.local",
      passwordHash: defaultPasswordHash,
      idRole: sellerRole.idRole,
      isActive: true,
      mustChangePass: true,
    },
    update: {
      idRole: sellerRole.idRole,
      isActive: true,
      mustChangePass: true,
      passwordHash: defaultPasswordHash,
    },
  });

  const settings = [
    {
      settingKey: "system_currency_code",
      settingValue: "HNL",
      valueType: "string",
      category: "general",
      description: "Moneda de visualización del sistema",
    },
    {
      settingKey: "credit_grace_days",
      settingValue: "30",
      valueType: "number",
      category: "ventas",
      description: "Dias desde la venta o vencimiento para marcar credito vencido",
    },
    {
      settingKey: "billing_isv_rate_percent",
      settingValue: "15",
      valueType: "number",
      category: "facturacion",
      description: "Porcentaje ISV por defecto",
    },
    {
      settingKey: "billing_iva_rate_percent",
      settingValue: "15",
      valueType: "number",
      category: "facturacion",
      description: "Porcentaje IVA por defecto",
    },
    {
      settingKey: "business_name",
      settingValue: "Sistema Zentra",
      valueType: "string",
      category: "facturacion",
      description: "Nombre del negocio para documentos y facturas",
    },
    {
      settingKey: "billing_rtn",
      settingValue: "0801-1999-123456",
      valueType: "string",
      category: "facturacion",
      description: "RTN del emisor",
    },
    {
      settingKey: "billing_cai",
      settingValue: "ABCD-1234-EFGH-5678-IJKL-9012-MNOP-3456",
      valueType: "string",
      category: "facturacion",
      description: "CAI vigente",
    },
    {
      settingKey: "billing_sanitary_registry",
      settingValue: "RS-01-2026-ABCD",
      valueType: "string",
      category: "facturacion",
      description: "Registro sanitario",
    },
    {
      settingKey: "billing_invoice_range_start",
      settingValue: "100",
      valueType: "number",
      category: "facturacion",
      description: "Inicio de rango fiscal",
    },
    {
      settingKey: "billing_invoice_range_end",
      settingValue: "1000",
      valueType: "number",
      category: "facturacion",
      description: "Fin de rango fiscal",
    },
    {
      settingKey: "billing_invoice_range_current",
      settingValue: "100",
      valueType: "number",
      category: "facturacion",
      description: "Correlativo fiscal actual",
    },
  ] as const;

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { settingKey: setting.settingKey },
      create: setting,
      update: {
        settingValue: setting.settingValue,
        valueType: setting.valueType,
        category: setting.category,
        description: setting.description,
      },
    });
  }

  const currencies = [
    { currencyCode: "USD", currencyName: "Dólar estadounidense", currencySymbol: "$" },
    { currencyCode: "GTQ", currencyName: "Quetzal guatemalteco", currencySymbol: "Q" },
    { currencyCode: "HNL", currencyName: "Lempira hondureño", currencySymbol: "L" },
    { currencyCode: "NIO", currencyName: "Córdoba nicaragüense", currencySymbol: "C$" },
    { currencyCode: "CRC", currencyName: "Colón costarricense", currencySymbol: "₡" },
    { currencyCode: "PAB", currencyName: "Balboa panameño", currencySymbol: "B/." },
    { currencyCode: "BZD", currencyName: "Dólar beliceño", currencySymbol: "BZ$" },
  ] as const;
  for (const currency of currencies) {
    await prisma.currencyCatalog.upsert({
      where: { currencyCode: currency.currencyCode },
      create: {
        currencyCode: currency.currencyCode,
        currencyName: currency.currencyName,
        currencySymbol: currency.currencySymbol,
        isActive: true,
      },
      update: {
        currencyName: currency.currencyName,
        currencySymbol: currency.currencySymbol,
        isActive: true,
      },
    });
  }

  const catalogSeeds = {
    products: ["Huevos grandes", "Huevos medianos", "Plátano"],
    climate_conditions: ["Soleado", "Nublado", "Lluvia"],
    roles: ["Administrador", "Vendedor"],
    payment_types: ["Efectivo", "Transferencia", "Crédito"],
    business_lines: [
      "Plátanos",
      "Casa",
      "Transporte y plátanos",
      "Gallinas",
      "Transporte",
      "Cable",
      "Girasoles",
    ],
    sub_lines: [
      "Limpieza",
      "Arado",
      "Varios",
      "Riego",
      "Fertilización",
      "Alimentación",
    ],
    units: ["unidad", "carton", "dedo", "racimo"],
    production_subtypes: ["Grande", "Mediano", "Pequeño", "Mini"],
    customer_places: [
      "Tegucigalpa",
      "San Pedro Sula",
      "La Ceiba",
      "Choluteca",
      "Comayagua",
      "El Progreso",
      "Otros",
    ],
  } as const;
  for (const [catalogType, itemNames] of Object.entries(catalogSeeds)) {
    for (const itemName of itemNames) {
      await prisma.catalogItem.upsert({
        where: {
          catalogType_itemName: {
            catalogType,
            itemName,
          },
        },
        create: {
          catalogType,
          itemName,
          isActive: true,
        },
        update: {
          isActive: true,
        },
      });
    }
  }

  /**
   * Asegura producto por nombre para no duplicar seed.
   */
  const ensureProduct = async (
    productName: string,
    baseUnit: string,
  ): Promise<{ idProduct: number; productName: string; baseUnit: string }> => {
    const existing = await prisma.product.findFirst({
      where: { productName },
    });
    if (existing) {
      const updated = await prisma.product.update({
        where: { idProduct: existing.idProduct },
        data: {
          baseUnit,
          isActive: true,
        },
      });
      return {
        idProduct: updated.idProduct,
        productName: updated.productName,
        baseUnit: updated.baseUnit,
      };
    }
    const created = await prisma.product.create({
      data: {
        productName,
        baseUnit,
        isActive: true,
      },
    });
    return {
      idProduct: created.idProduct,
      productName: created.productName,
      baseUnit: created.baseUnit,
    };
  };

  const huevosGrandes = await ensureProduct("Huevos grandes", "unidad");
  const huevosMedianos = await ensureProduct("Huevos medianos", "unidad");
  const platano = await ensureProduct("Plátano", "dedo");

  const ensureProductPrice = async (
    idProduct: number,
    unitLabel: string,
    price: number,
  ): Promise<void> => {
    const existing = await prisma.productPrice.findFirst({
      where: {
        idProduct,
        unitLabel,
        validTo: null,
      },
    });
    if (existing) {
      await prisma.productPrice.update({
        where: { idPrice: existing.idPrice },
        data: { price },
      });
      return;
    }
    await prisma.productPrice.create({
      data: {
        idProduct,
        unitLabel,
        price,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
        validTo: null,
      },
    });
  };

  await ensureProductPrice(huevosGrandes.idProduct, "unidad", 3);
  await ensureProductPrice(huevosGrandes.idProduct, "carton", 120);
  await ensureProductPrice(platano.idProduct, "dedo", 5);
  await ensureProductPrice(platano.idProduct, "racimo", 150);

  /**
   * Asegura fila de inventario por ubicación, incluso cuando idUser es null.
   */
  const ensureInventory = async (
    idProduct: number,
    locationType: "WAREHOUSE" | "USER",
    idUser: number | null,
    stock: number,
  ): Promise<void> => {
    const existing = await prisma.inventory.findFirst({
      where: {
        idProduct,
        locationType,
        idUser,
      },
    });
    if (existing) {
      await prisma.inventory.update({
        where: { idInventory: existing.idInventory },
        data: { stock },
      });
      return;
    }
    await prisma.inventory.create({
      data: {
        idProduct,
        locationType,
        idUser,
        stock,
      },
    });
  };

  await ensureInventory(huevosGrandes.idProduct, "WAREHOUSE", null, 900);
  await ensureInventory(huevosMedianos.idProduct, "WAREHOUSE", null, 750);
  await ensureInventory(platano.idProduct, "WAREHOUSE", null, 1500);

  await prisma.inventory.upsert({
    where: {
      idProduct_locationType_idUser: {
        idProduct: huevosGrandes.idProduct,
        locationType: "USER",
        idUser: sellerUser.idUser,
      },
    },
    create: {
      idProduct: huevosGrandes.idProduct,
      locationType: "USER",
      idUser: sellerUser.idUser,
      stock: 120,
    },
    update: {
      stock: 120,
    },
  });

  await prisma.inventory.upsert({
    where: {
      idProduct_locationType_idUser: {
        idProduct: platano.idProduct,
        locationType: "USER",
        idUser: sellerAnaUser.idUser,
      },
    },
    create: {
      idProduct: platano.idProduct,
      locationType: "USER",
      idUser: sellerAnaUser.idUser,
      stock: 160,
    },
    update: {
      stock: 160,
    },
  });

  const existingSalesCount = await prisma.sale.count();
  if (existingSalesCount === 0) {
    await prisma.sale.create({
      data: {
        idUser: sellerUser.idUser,
        subtotal: 220.5,
        taxIsv: 0,
        taxIva: 0,
        total: 220.5,
        isCredit: false,
        hasInvoice: false,
        invoiceNumber: null,
        details: {
          create: [
            {
              idProduct: huevosGrandes.idProduct,
              quantitySale: 73.5,
              quantityBase: 74,
              unitLabel: "unidad",
              conversionFactor: 1,
              unitPrice: 3,
              subtotal: 220.5,
            },
          ],
        },
      },
    });
  }

  const ensureCustomer = async (
    customerName: string,
    phone: string,
    email: string,
  ): Promise<void> => {
    const existing = await prisma.customer.findFirst({
      where: {
        customerName,
      },
    });
    if (existing) {
      await prisma.customer.update({
        where: { idCustomer: existing.idCustomer },
        data: {
          phone,
          email,
          isActive: true,
        },
      });
      return;
    }
    await prisma.customer.create({
      data: {
        customerName,
        phone,
        email,
        isActive: true,
      },
    });
  };

  await ensureCustomer("Colmado La Esquina", "809-555-0101", "colmado.esquina@demo.local");
  await ensureCustomer(
    "Comedor El Buen Sabor",
    "829-555-0102",
    "comedor.buensabor@demo.local",
  );

  const smtpRow = await prisma.smtpSetting.findFirst({
    orderBy: { idSmtpSetting: "asc" },
  });
  if (smtpRow) {
    await prisma.smtpSetting.update({
      where: { idSmtpSetting: smtpRow.idSmtpSetting },
      data: {
        smtpHost: "smtp.hostinger.com",
        smtpPort: 587,
        smtpUser: "no-reply@zentra.com",
        smtpPasswordEnc: "TEMP_SMTP_PASSWORD",
        smtpEncryption: "TLS",
        fromEmail: "no-reply@zentra.com",
        fromName: "Sistema Zentra",
        isActive: true,
      },
    });
  } else {
    await prisma.smtpSetting.create({
      data: {
        smtpHost: "smtp.hostinger.com",
        smtpPort: 587,
        smtpUser: "no-reply@zentra.com",
        smtpPasswordEnc: "TEMP_SMTP_PASSWORD",
        smtpEncryption: "TLS",
        fromEmail: "no-reply@zentra.com",
        fromName: "Sistema Zentra",
        isActive: true,
      },
    });
  }

  console.log(
    `Seed completado. Admin: ${adminUser.email} | Seller demo: ${sellerUser.email} | Seller Ana: ${sellerAnaUser.email}`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
