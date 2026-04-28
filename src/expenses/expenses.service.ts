import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateExpenseDto } from "./dto/create-expense.dto";

export interface ExpenseResponse {
  idExpense: number;
  expenseNumber: string;
  vendorName: string;
  amount: number;
  expenseDate: string;
  paymentType: string;
  businessLine: string;
  subLine: string | null;
  evidenceImageUrl: string | null;
}

export interface CatalogRowResponse {
  idItem: number;
  itemName: string;
  isActive: boolean;
}

/**
 * Servicio de gastos operativos.
 */
@Injectable()
export class ExpensesService {
  constructor(private readonly prismaService: PrismaService) {}

  async findAll(): Promise<ExpenseResponse[]> {
    const rows = await this.prismaService.expenseRecord.findMany({
      include: {
        paymentType: true,
        businessLine: true,
        subLine: true,
      },
      orderBy: [{ expenseDate: "desc" }, { idExpense: "desc" }],
    });
    return rows.map((row) => ({
      idExpense: row.idExpense,
      expenseNumber: row.expenseNumber,
      vendorName: row.vendorName,
      amount: Number(row.amount),
      expenseDate: row.expenseDate.toISOString(),
      paymentType: row.paymentType.itemName,
      businessLine: row.businessLine.itemName,
      subLine: row.subLine?.itemName ?? null,
      evidenceImageUrl: row.evidenceImagePath,
    }));
  }

  async listPaymentTypes(): Promise<CatalogRowResponse[]> {
    return this.listCatalogByType("payment_types");
  }

  async listBusinessLines(): Promise<CatalogRowResponse[]> {
    return this.listCatalogByType("business_lines");
  }

  async listSubLinesByBusinessLine(idBusinessLine: number): Promise<CatalogRowResponse[]> {
    if (!Number.isInteger(idBusinessLine) || idBusinessLine <= 0) {
      return [];
    }
    const businessLine = await this.prismaService.catalogItem.findFirst({
      where: {
        idItem: idBusinessLine,
        catalogType: "business_lines",
        isActive: true,
      },
    });
    if (!businessLine) {
      return [];
    }
    const rows = await this.prismaService.catalogItem.findMany({
      where: {
        catalogType: "sub_lines",
        isActive: true,
      },
      orderBy: { itemName: "asc" },
    });
    return rows.map((row) => ({
      idItem: row.idItem,
      itemName: row.itemName,
      isActive: row.isActive,
    }));
  }

  async create(input: CreateExpenseDto, evidenceImagePath: string | null): Promise<ExpenseResponse> {
    const normalizedInput = this.normalizePayload(input);
    this.validatePayload(normalizedInput);
    const created = await this.prismaService.$transaction(async (tx) => {
      const paymentType = await tx.catalogItem.findFirst({
        where: {
          idItem: normalizedInput.idPaymentType,
          catalogType: "payment_types",
          isActive: true,
        },
      });
      if (!paymentType) {
        throw new BadRequestException("Tipo de pago inválido.");
      }
      const businessLine = await tx.catalogItem.findFirst({
        where: {
          idItem: normalizedInput.idBusinessLine,
          catalogType: "business_lines",
          isActive: true,
        },
      });
      if (!businessLine) {
        throw new BadRequestException("Línea de negocio inválida.");
      }
      let subLineId: number | null = null;
      if (normalizedInput.idSubLine !== null) {
        const subLine = await tx.catalogItem.findFirst({
          where: {
            idItem: normalizedInput.idSubLine,
            catalogType: "sub_lines",
            isActive: true,
          },
        });
        if (!subLine) {
          throw new BadRequestException("Sublínea inválida.");
        }
        subLineId = subLine.idItem;
      }

      const currentCount = await tx.expenseRecord.count();
      const expenseNumber = `G-${String(currentCount + 1).padStart(4, "0")}`;
      return tx.expenseRecord.create({
        data: {
          expenseNumber,
          expenseDate: new Date(normalizedInput.expenseDate),
          vendorName: normalizedInput.vendorName.trim(),
          idPaymentType: paymentType.idItem,
          amount: normalizedInput.amount,
          idBusinessLine: businessLine.idItem,
          idSubLine: subLineId,
          observations:
            normalizedInput.observations.trim().length > 0
              ? normalizedInput.observations.trim()
              : null,
          evidenceImagePath,
        },
        include: {
          paymentType: true,
          businessLine: true,
          subLine: true,
        },
      });
    });

    return {
      idExpense: created.idExpense,
      expenseNumber: created.expenseNumber,
      vendorName: created.vendorName,
      amount: Number(created.amount),
      expenseDate: created.expenseDate.toISOString(),
      paymentType: created.paymentType.itemName,
      businessLine: created.businessLine.itemName,
      subLine: created.subLine?.itemName ?? null,
      evidenceImageUrl: created.evidenceImagePath,
    };
  }

  private async listCatalogByType(catalogType: string): Promise<CatalogRowResponse[]> {
    const rows = await this.prismaService.catalogItem.findMany({
      where: {
        catalogType,
        isActive: true,
      },
      orderBy: { itemName: "asc" },
    });
    return rows.map((row) => ({
      idItem: row.idItem,
      itemName: row.itemName,
      isActive: row.isActive,
    }));
  }

  private normalizePayload(input: CreateExpenseDto): CreateExpenseDto {
    return {
      expenseDate: String(input.expenseDate ?? ""),
      vendorName: String(input.vendorName ?? ""),
      idPaymentType: Number(input.idPaymentType),
      amount: Number(input.amount),
      idBusinessLine: Number(input.idBusinessLine),
      idSubLine:
        input.idSubLine === null || String(input.idSubLine).trim().length === 0
          ? null
          : Number(input.idSubLine),
      observations: String(input.observations ?? ""),
    };
  }

  private validatePayload(input: CreateExpenseDto): void {
    if (input.expenseDate.trim().length !== 10) {
      throw new BadRequestException("La fecha del gasto no es válida.");
    }
    if (input.vendorName.trim().length < 3) {
      throw new BadRequestException("El proveedor no es válido.");
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new BadRequestException("El monto del gasto debe ser mayor a 0.");
    }
    if (!Number.isInteger(input.idPaymentType) || input.idPaymentType <= 0) {
      throw new BadRequestException("Tipo de pago inválido.");
    }
    if (!Number.isInteger(input.idBusinessLine) || input.idBusinessLine <= 0) {
      throw new BadRequestException("Línea de negocio inválida.");
    }
    if (input.idSubLine !== null && (!Number.isInteger(input.idSubLine) || input.idSubLine <= 0)) {
      throw new BadRequestException("Sublínea inválida.");
    }
  }
}
