import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma, type Sale } from "@prisma/client";
import type { AuthUser } from "../auth/types/auth-user.type";
import { PermissionsService } from "../auth/permissions.service";
import { InventoryService } from "../inventory/inventory.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AssignInventoryDto } from "./dto/assign-inventory.dto";
import type { CreateSaleDto } from "./dto/create-sale.dto";
import type { RegisterCreditPaymentDto } from "./dto/register-credit-payment.dto";
import type { RegisterCustomerBalancePaymentDto } from "./dto/register-customer-balance-payment.dto";

export interface SaleResponse {
  idSale: number;
  idSeller: number;
  sellerName: string;
  idCustomer: number | null;
  customerName: string | null;
  customerPlace: string | null;
  subtotal: number;
  taxIsv: number;
  taxIva: number;
  total: number;
  isCredit: boolean;
  hasInvoice: boolean;
  invoiceNumber: number | null;
  createdAt: string;
}

export interface CreditAccountResponse {
  idCreditAccount: number;
  idSale: number;
  customerName: string;
  creditTotal: number;
  paidTotal: number;
  balanceTotal: number;
  status: "PENDING" | "PARTIAL" | "PAID";
  createdAt: string;
}

/**
 * Resumen de cartera por cliente (saldo total y semaforo).
 */
export interface CustomerCreditSummaryResponse {
  idCustomer: number;
  customerName: string;
  totalCredit: number;
  totalPaid: number;
  totalBalance: number;
  overdue: boolean;
}

/**
 * Servicio de ventas con reglas transaccionales de negocio.
 */
@Injectable()
export class SalesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly permissionsService: PermissionsService,
    private readonly inventoryService: InventoryService,
  ) {}

  /**
   * Lista ventas recientes ordenadas por fecha de creación.
   */
  async findAll(actor: AuthUser): Promise<SaleResponse[]> {
    await this.permissionsService.assertModulePermission(actor.idUser, "sales", "read");
    const rows = await this.prismaService.sale.findMany({
      where: actor.role === "ADMIN" ? undefined : { idUser: actor.idUser },
      include: {
        user: true,
        customer: {
          include: {
            placeItem: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return rows.map((row) => this.toSaleResponse(row));
  }

  /**
   * Lista cuentas de crédito para panel de abonos.
   */
  async findCreditAccounts(actor: AuthUser): Promise<CreditAccountResponse[]> {
    await this.permissionsService.assertModulePermission(actor.idUser, "sales", "read");
    const rows = await this.prismaService.creditSale.findMany({
      include: {
        customer: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return rows.map((row) => ({
      idCreditAccount: Number(row.idCreditSale),
      idSale: Number(row.idSale),
      customerName: row.customer.customerName,
      creditTotal: Number(row.creditTotal),
      paidTotal: Number(row.paidTotal),
      balanceTotal: Number(row.balanceTotal),
      status: row.status as CreditAccountResponse["status"],
      createdAt: row.createdAt.toISOString(),
    }));
  }

  /**
   * Asigna inventario del almacén principal al inventario del vendedor.
   */
  async assignInventoryToSeller(
    actor: AuthUser,
    input: AssignInventoryDto,
  ): Promise<{ message: string }> {
    await this.permissionsService.assertModulePermission(actor.idUser, "inventory", "create");
    return this.inventoryService.assignFromWarehouseToSeller(input, actor.idUser);
  }

  /**
   * Crea una venta con cálculo de impuestos y control fiscal.
   */
  async create(input: CreateSaleDto, actor: AuthUser): Promise<SaleResponse> {
    await this.permissionsService.assertModulePermission(actor.idUser, "sales", "create");
    const normalized = this.normalizeSaleInputForActor(input, actor);
    this.validateCreatePayload(normalized);

    const created = await this.prismaService.$transaction(async (tx) => {
      const quantityBaseByProduct = this.groupQuantityBaseByProduct(normalized);
      await this.decreaseInventoryStock(
        tx,
        normalized,
        quantityBaseByProduct,
        actor.idUser,
      );

      const saleSubtotal = normalized.items.reduce(
        (accumulator, item) => accumulator + item.quantitySale * item.unitPrice,
        0,
      );

      const isvRate = normalized.applyIsv
        ? await this.getRequiredNumberSetting(tx, "billing_isv_rate_percent")
        : 0;
      const ivaRate = normalized.applyIva
        ? await this.getRequiredNumberSetting(tx, "billing_iva_rate_percent")
        : 0;

      const taxIsv = this.roundTo2(saleSubtotal * (isvRate / 100));
      const taxIva = this.roundTo2(saleSubtotal * (ivaRate / 100));
      const total = this.roundTo2(saleSubtotal + taxIsv + taxIva);

      const invoiceNumber = normalized.hasInvoice
        ? await this.reserveInvoiceNumber(tx)
        : null;

      const idCustomerForSale = this.resolveSaleCustomerId(normalized);

      const sale = await tx.sale.create({
        include: {
          user: true,
          customer: {
            include: {
              placeItem: true,
            },
          },
        },
        data: {
          idUser: normalized.idUser,
          idCustomer: idCustomerForSale,
          subtotal: this.toDecimal(saleSubtotal),
          taxIsv: this.toDecimal(taxIsv),
          taxIva: this.toDecimal(taxIva),
          total: this.toDecimal(total),
          isCredit: normalized.isCredit,
          hasInvoice: normalized.hasInvoice,
          invoiceNumber: invoiceNumber === null ? null : BigInt(invoiceNumber),
          details: {
            create: normalized.items.map((item) => ({
              idProduct: item.idProduct,
              quantitySale: this.toDecimal(item.quantitySale),
              quantityBase: this.toDecimal(item.quantityBase),
              unitLabel: item.unitLabel,
              conversionFactor: this.toDecimal(item.conversionFactor, 4),
              unitPrice: this.toDecimal(item.unitPrice),
              subtotal: this.toDecimal(item.quantitySale * item.unitPrice),
            })),
          },
        },
      });

      if (normalized.isCredit) {
        if (!normalized.idCustomer || !Number.isInteger(normalized.idCustomer) || normalized.idCustomer <= 0) {
          throw new BadRequestException("La venta a crédito requiere cliente válido.");
        }
        const customer = await tx.customer.findUnique({
          where: { idCustomer: normalized.idCustomer },
        });
        if (!customer || !customer.isActive) {
          throw new BadRequestException("Cliente inválido para venta a crédito.");
        }

        await tx.creditSale.create({
          data: {
            idSale: sale.idSale,
            idCustomer: normalized.idCustomer,
            dueDate: normalized.dueDate ? new Date(normalized.dueDate) : null,
            creditTotal: this.toDecimal(total),
            paidTotal: this.toDecimal(0),
            balanceTotal: this.toDecimal(total),
            status: "PENDING",
          },
        });
      }

      return sale;
    });
    return this.toSaleResponse(created);
  }

  /**
   * Vendedor solo vende desde su inventario; admin puede usar almacen o vendedor elegido.
   */
  private normalizeSaleInputForActor(input: CreateSaleDto, actor: AuthUser): CreateSaleDto {
    if (actor.role === "ADMIN") {
      return input;
    }
    return {
      ...input,
      idUser: actor.idUser,
      saleSource: "SELLER",
    };
  }

  /**
   * Cliente en venta: solo registrado lleva id; casual sin fila en catalogo.
   */
  private resolveSaleCustomerId(input: CreateSaleDto): number | null {
    if (input.customerMode === "CASUAL") {
      return null;
    }
    if (input.idCustomer !== null && Number.isInteger(input.idCustomer) && input.idCustomer > 0) {
      return input.idCustomer;
    }
    return null;
  }

  /**
   * Registra abono y recalcula saldo de cuenta de crédito.
   */
  async registerCreditPayment(
    actor: AuthUser,
    input: RegisterCreditPaymentDto,
  ): Promise<CreditAccountResponse> {
    await this.permissionsService.assertModulePermission(actor.idUser, "sales", "update");
    if (!Number.isInteger(input.idCreditAccount) || input.idCreditAccount <= 0) {
      throw new BadRequestException("La cuenta de crédito no es válida.");
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new BadRequestException("El monto de abono debe ser mayor a 0.");
    }

    const updated = await this.prismaService.$transaction(async (tx) => {
      const current = await tx.creditSale.findUnique({
        where: { idCreditSale: BigInt(input.idCreditAccount) },
        include: { customer: true },
      });
      if (!current) {
        throw new BadRequestException("No se encontró la cuenta de crédito.");
      }
      const currentBalance = Number(current.balanceTotal);
      if (input.amount > currentBalance) {
        throw new BadRequestException(
          `El abono excede saldo pendiente (${currentBalance.toFixed(2)}).`,
        );
      }

      await tx.creditPayment.create({
        data: {
          idCreditSale: current.idCreditSale,
          amount: this.toDecimal(input.amount),
          paymentDate: new Date(),
          note: null,
        },
      });

      const paidTotal = this.roundTo2(Number(current.paidTotal) + input.amount);
      const balanceTotal = this.roundTo2(Number(current.creditTotal) - paidTotal);
      const status: CreditAccountResponse["status"] =
        balanceTotal <= 0 ? "PAID" : paidTotal > 0 ? "PARTIAL" : "PENDING";

      return tx.creditSale.update({
        where: { idCreditSale: current.idCreditSale },
        data: {
          paidTotal: this.toDecimal(paidTotal),
          balanceTotal: this.toDecimal(balanceTotal),
          status,
        },
        include: { customer: true },
      });
    });

    return {
      idCreditAccount: Number(updated.idCreditSale),
      idSale: Number(updated.idSale),
      customerName: updated.customer.customerName,
      creditTotal: Number(updated.creditTotal),
      paidTotal: Number(updated.paidTotal),
      balanceTotal: Number(updated.balanceTotal),
      status: updated.status as CreditAccountResponse["status"],
      createdAt: updated.createdAt.toISOString(),
    };
  }

  /**
   * Resumen por cliente: saldo total y si hay lineas vencidas.
   */
  async findCustomerCreditSummaries(actor: AuthUser): Promise<CustomerCreditSummaryResponse[]> {
    await this.permissionsService.assertModulePermission(actor.idUser, "sales", "read");
    return this.buildCustomerCreditSummaries();
  }

  /**
   * Calcula resumenes de cartera (sin validar permiso; uso interno tras abonos).
   */
  private async buildCustomerCreditSummaries(): Promise<CustomerCreditSummaryResponse[]> {
    const graceDays = await this.getGraceDays();
    const customers = await this.prismaService.customer.findMany({
      where: { isActive: true },
      include: {
        creditSales: {
          include: { sale: true },
        },
      },
    });
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const rows: CustomerCreditSummaryResponse[] = [];
    for (const customer of customers) {
      let totalCredit = 0;
      let totalPaid = 0;
      let totalBalance = 0;
      let overdue = false;
      for (const creditRow of customer.creditSales) {
        totalCredit += Number(creditRow.creditTotal);
        totalPaid += Number(creditRow.paidTotal);
        totalBalance += Number(creditRow.balanceTotal);
        if (Number(creditRow.balanceTotal) > 0.009) {
          const saleDate = creditRow.sale.createdAt;
          const effectiveDue =
            creditRow.dueDate ?? new Date(saleDate.getTime() + graceDays * 86400000);
          if (effectiveDue < startToday) {
            overdue = true;
          }
        }
      }
      if (totalCredit > 0.009) {
        rows.push({
          idCustomer: customer.idCustomer,
          customerName: customer.customerName,
          totalCredit: this.roundTo2(totalCredit),
          totalPaid: this.roundTo2(totalPaid),
          totalBalance: this.roundTo2(totalBalance),
          overdue,
        });
      }
    }
    return rows.sort((left, right) => right.totalBalance - left.totalBalance);
  }

  /**
   * Abono al saldo general del cliente (FIFO por antiguedad de ventas a credito).
   */
  async registerCustomerBalancePayment(
    actor: AuthUser,
    input: RegisterCustomerBalancePaymentDto,
  ): Promise<CustomerCreditSummaryResponse> {
    await this.permissionsService.assertModulePermission(actor.idUser, "sales", "update");
    if (!Number.isInteger(input.idCustomer) || input.idCustomer <= 0) {
      throw new BadRequestException("Cliente inválido.");
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new BadRequestException("El monto de abono debe ser mayor a 0.");
    }

    await this.prismaService.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { idCustomer: input.idCustomer },
      });
      if (!customer || !customer.isActive) {
        throw new BadRequestException("Cliente no encontrado o inactivo.");
      }

      const openSales = await tx.creditSale.findMany({
        where: { idCustomer: input.idCustomer, balanceTotal: { gt: 0 } },
        orderBy: { createdAt: "asc" },
      });
      const totalOpen = openSales.reduce((sum, row) => sum + Number(row.balanceTotal), 0);
      const amountRounded = this.roundTo2(input.amount);
      if (amountRounded > totalOpen + 0.009) {
        throw new BadRequestException(
          `El abono excede el saldo total pendiente (${totalOpen.toFixed(2)}).`,
        );
      }

      let remaining = amountRounded;
      for (const creditSaleRow of openSales) {
        if (remaining <= 0) {
          break;
        }
        const balance = Number(creditSaleRow.balanceTotal);
        if (balance <= 0) {
          continue;
        }
        const payAmount = Math.min(remaining, balance);
        await tx.creditPayment.create({
          data: {
            idCreditSale: creditSaleRow.idCreditSale,
            amount: this.toDecimal(payAmount),
            paymentDate: new Date(),
            note: "Abono saldo general (FIFO)",
          },
        });
        const paidTotal = this.roundTo2(Number(creditSaleRow.paidTotal) + payAmount);
        const balanceTotal = this.roundTo2(Number(creditSaleRow.creditTotal) - paidTotal);
        const status: CreditAccountResponse["status"] =
          balanceTotal <= 0 ? "PAID" : paidTotal > 0 ? "PARTIAL" : "PENDING";
        await tx.creditSale.update({
          where: { idCreditSale: creditSaleRow.idCreditSale },
          data: {
            paidTotal: this.toDecimal(paidTotal),
            balanceTotal: this.toDecimal(balanceTotal),
            status,
          },
        });
        remaining = this.roundTo2(remaining - payAmount);
      }
    });

    const summaries = await this.buildCustomerCreditSummaries();
    const match = summaries.find((row) => row.idCustomer === input.idCustomer);
    if (!match) {
      throw new BadRequestException("No se pudo recalcular el resumen del cliente.");
    }
    return match;
  }

  /**
   * Agrupa la cantidad base requerida por producto para validar y descontar stock.
   */
  private groupQuantityBaseByProduct(input: CreateSaleDto): Map<number, number> {
    const quantityMap = new Map<number, number>();
    for (const item of input.items) {
      const current = quantityMap.get(item.idProduct) ?? 0;
      quantityMap.set(item.idProduct, current + item.quantityBase);
    }
    return quantityMap;
  }

  /**
   * Descuenta stock de inventario según origen de venta.
   */
  private async decreaseInventoryStock(
    tx: Prisma.TransactionClient,
    input: CreateSaleDto,
    quantityBaseByProduct: Map<number, number>,
    performedByUserId: number,
  ): Promise<void> {
    for (const [idProduct, requiredBase] of quantityBaseByProduct.entries()) {
      const normalizedLocationType = input.saleSource === "SELLER" ? "USER" : "WAREHOUSE";
      const inventoryWhere: Prisma.InventoryWhereInput = {
        idProduct,
        locationType: normalizedLocationType,
        idUser: input.saleSource === "SELLER" ? input.idUser : null,
      };

      const inventoryRow = await tx.inventory.findFirst({
        where: inventoryWhere,
      });
      if (!inventoryRow) {
        throw new BadRequestException(
          `No existe inventario para producto ${idProduct} en origen ${normalizedLocationType}.`,
        );
      }
      if (inventoryRow.stock < requiredBase) {
        throw new BadRequestException(
          `Stock insuficiente para producto ${idProduct}. Disponible: ${inventoryRow.stock}.`,
        );
      }

      const updated = await tx.inventory.updateMany({
        where: {
          idInventory: inventoryRow.idInventory,
          stock: {
            gte: requiredBase,
          },
        },
        data: {
          stock: {
            decrement: requiredBase,
          },
        },
      });
      if (updated.count !== 1) {
        throw new BadRequestException(
          `No se pudo descontar stock para producto ${idProduct}. Reintenta la operación.`,
        );
      }

      const product = await tx.product.findUnique({
        where: { idProduct },
      });
      const fromLocation =
        input.saleSource === "SELLER" ? `Vendedor #${String(input.idUser)}` : "Almacén principal";
      await tx.inventoryMovement.create({
        data: {
          movementType: "SALE",
          idProduct,
          quantity: requiredBase,
          fromLocation,
          toLocation: "Venta",
          reason: `Salida por venta de ${product?.productName ?? `ID ${String(idProduct)}`}`,
          idPerformedBy: performedByUserId,
        },
      });
    }
  }

  /**
   * Valida estructura y reglas mínimas de creación.
   */
  private validateCreatePayload(input: CreateSaleDto): void {
    if (!Number.isInteger(input.idUser) || input.idUser <= 0) {
      throw new BadRequestException("El usuario de la venta no es válido.");
    }
    if (input.saleSource !== "WAREHOUSE" && input.saleSource !== "SELLER") {
      throw new BadRequestException("El origen de venta no es válido.");
    }
    if (input.customerMode !== "REGISTERED" && input.customerMode !== "CASUAL") {
      throw new BadRequestException("Modo de cliente inválido.");
    }
    if (input.customerMode === "CASUAL" && input.isCredit) {
      throw new BadRequestException("La venta a crédito solo aplica a cliente registrado.");
    }
    if (input.items.length === 0) {
      throw new BadRequestException("La venta debe incluir al menos un detalle.");
    }
    if (input.isCredit) {
      if (!input.idCustomer || input.idCustomer <= 0) {
        throw new BadRequestException("La venta a crédito requiere cliente registrado.");
      }
      if (input.customerMode !== "REGISTERED") {
        throw new BadRequestException("La venta a crédito requiere cliente registrado.");
      }
    }
    if (!input.hasInvoice && (input.applyIsv || input.applyIva)) {
      throw new BadRequestException(
        "No puedes aplicar impuestos si la venta no emite factura.",
      );
    }

    for (const item of input.items) {
      if (!Number.isInteger(item.idProduct) || item.idProduct <= 0) {
        throw new BadRequestException("Detalle con producto inválido.");
      }
      if (!Number.isFinite(item.quantitySale) || item.quantitySale <= 0) {
        throw new BadRequestException("Detalle con cantidad de venta inválida.");
      }
      if (!Number.isInteger(item.quantitySale)) {
        throw new BadRequestException("La cantidad de venta debe ser un número entero.");
      }
      if (!Number.isFinite(item.quantityBase) || item.quantityBase <= 0) {
        throw new BadRequestException("Detalle con cantidad base inválida.");
      }
      if (!Number.isInteger(item.quantityBase)) {
        throw new BadRequestException(
          "La cantidad base debe ser entera porque el stock se maneja en enteros.",
        );
      }
      if (item.unitLabel.trim().length < 1) {
        throw new BadRequestException("Detalle con unidad inválida.");
      }
      if (!Number.isFinite(item.conversionFactor) || item.conversionFactor <= 0) {
        throw new BadRequestException("Detalle con factor de conversión inválido.");
      }
      if (!Number.isInteger(item.conversionFactor)) {
        throw new BadRequestException("El factor de conversión debe ser un número entero.");
      }
      if (!Number.isFinite(item.unitPrice) || item.unitPrice <= 0) {
        throw new BadRequestException("Detalle con precio unitario inválido.");
      }
    }
  }

  /**
   * Dias de gracia para marcar credito vencido si no hay fecha de vencimiento por venta.
   */
  private async getGraceDays(): Promise<number> {
    const row = await this.prismaService.systemSetting.findUnique({
      where: { settingKey: "credit_grace_days" },
    });
    if (!row) {
      return 30;
    }
    const parsed = Number(row.settingValue);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 30;
    }
    return Math.floor(parsed);
  }

  /**
   * Recupera un setting numérico y obliga existencia.
   */
  private async getRequiredNumberSetting(
    tx: Prisma.TransactionClient,
    settingKey: string,
  ): Promise<number> {
    const row = await tx.systemSetting.findUnique({
      where: { settingKey },
    });
    if (!row) {
      throw new BadRequestException(`Falta parámetro requerido: ${settingKey}.`);
    }
    const parsed = Number(row.settingValue);
    if (!Number.isFinite(parsed)) {
      throw new BadRequestException(`El parámetro ${settingKey} no es numérico.`);
    }
    return parsed;
  }

  /**
   * Reserva correlativo fiscal y avanza al siguiente.
   */
  private async reserveInvoiceNumber(tx: Prisma.TransactionClient): Promise<number> {
    const start = await this.getRequiredNumberSetting(tx, "billing_invoice_range_start");
    const end = await this.getRequiredNumberSetting(tx, "billing_invoice_range_end");
    const current = await this.getRequiredNumberSetting(tx, "billing_invoice_range_current");

    if (!Number.isInteger(start) || !Number.isInteger(end) || !Number.isInteger(current)) {
      throw new BadRequestException("Los correlativos fiscales deben ser enteros.");
    }
    if (start > end) {
      throw new BadRequestException("El rango fiscal está mal configurado.");
    }
    if (current < start || current > end) {
      throw new BadRequestException("El correlativo fiscal actual está fuera de rango.");
    }

    await tx.systemSetting.update({
      where: { settingKey: "billing_invoice_range_current" },
      data: { settingValue: String(current + 1) },
    });

    return current;
  }

  /**
   * Convierte valor numérico a Decimal de Prisma.
   */
  private toDecimal(value: number, precision = 2): Prisma.Decimal {
    return new Prisma.Decimal(value.toFixed(precision));
  }

  /**
   * Redondea a 2 decimales para montos monetarios.
   */
  private roundTo2(value: number): number {
    return Number(value.toFixed(2));
  }

  /**
   * Mapea entidad Prisma a respuesta frontend segura (sin Decimal/BigInt).
   */
  private toSaleResponse(
    sale: Sale & {
      user?: {
        idUser: number;
        fullName: string;
      };
      customer?: {
        idCustomer: number;
        customerName: string;
        placeItem: {
          itemName: string;
        } | null;
      } | null;
    },
  ): SaleResponse {
    return {
      idSale: Number(sale.idSale),
      idSeller: sale.idUser,
      sellerName: sale.user?.fullName ?? `Usuario ${sale.idUser}`,
      idCustomer: sale.customer?.idCustomer ?? null,
      customerName: sale.customer?.customerName ?? null,
      customerPlace: sale.customer?.placeItem?.itemName ?? null,
      subtotal: Number(sale.subtotal),
      taxIsv: Number(sale.taxIsv),
      taxIva: Number(sale.taxIva),
      total: Number(sale.total),
      isCredit: sale.isCredit,
      hasInvoice: sale.hasInvoice,
      invoiceNumber: sale.invoiceNumber === null ? null : Number(sale.invoiceNumber),
      createdAt: sale.createdAt.toISOString(),
    };
  }
}
