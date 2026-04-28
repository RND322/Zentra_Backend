import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface AuditLogResponse {
  idAuditLog: number;
  action: string;
  description: string;
  projectName: string;
  actorName: string;
  createdAt: string;
}

/**
 * Servicio de bitácora global construida desde eventos reales.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prismaService: PrismaService) {}

  async findAll(): Promise<AuditLogResponse[]> {
    const [movements, sales, expenses, production] = await Promise.all([
      this.prismaService.inventoryMovement.findMany({
        include: { product: true, performedBy: true },
        take: 200,
        orderBy: { createdAt: "desc" },
      }),
      this.prismaService.sale.findMany({
        include: { user: true },
        take: 150,
        orderBy: { createdAt: "desc" },
      }),
      this.prismaService.expenseRecord.findMany({
        take: 150,
        orderBy: { createdAt: "desc" },
      }),
      this.prismaService.productionRecord.findMany({
        include: { product: true },
        take: 150,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const rows: AuditLogResponse[] = [];
    let idCounter = 1;

    for (const row of movements) {
      rows.push({
        idAuditLog: idCounter++,
        action: `INV_${row.movementType}`,
        description: `${row.reason} | ${row.quantity} ${row.product.productName}`,
        projectName: "Inventario",
        actorName: row.performedBy?.fullName ?? "Sistema",
        createdAt: row.createdAt.toISOString(),
      });
    }
    for (const row of sales) {
      rows.push({
        idAuditLog: idCounter++,
        action: "SALE_CREATED",
        description: `Venta #${String(row.idSale)} por ${Number(row.total).toFixed(2)}`,
        projectName: "Ventas",
        actorName: row.user.fullName,
        createdAt: row.createdAt.toISOString(),
      });
    }
    for (const row of expenses) {
      rows.push({
        idAuditLog: idCounter++,
        action: "EXPENSE_CREATED",
        description: `Gasto ${row.expenseNumber} por ${Number(row.amount).toFixed(2)}`,
        projectName: "Gastos",
        actorName: "Sistema",
        createdAt: row.createdAt.toISOString(),
      });
    }
    for (const row of production) {
      rows.push({
        idAuditLog: idCounter++,
        action: "PRODUCTION_CREATED",
        description: `Producción de ${row.quantityBase} ${row.product.baseUnit}`,
        projectName: "Producción",
        actorName: "Sistema",
        createdAt: row.createdAt.toISOString(),
      });
    }

    return rows
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 400);
  }
}
