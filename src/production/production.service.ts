import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateProductionDto } from "./dto/create-production.dto";

export interface ProductionResponse {
  idProduction: number;
  productName: string;
  quantityBase: number;
  baseUnitLabel: string;
  climate: string;
  productionDate: string;
}

/**
 * Servicio de producción con persistencia real e impacto en inventario.
 */
@Injectable()
export class ProductionService {
  constructor(private readonly prismaService: PrismaService) {}

  async findAll(): Promise<ProductionResponse[]> {
    const rows = await this.prismaService.productionRecord.findMany({
      include: { product: true },
      orderBy: [{ productionDate: "desc" }, { idProduction: "desc" }],
    });
    return rows.map((row) => ({
      idProduction: row.idProduction,
      productName: row.product.productName,
      quantityBase: row.quantityBase,
      baseUnitLabel: row.product.baseUnit,
      climate: row.climate,
      productionDate: row.productionDate.toISOString(),
    }));
  }

  async create(input: CreateProductionDto): Promise<ProductionResponse> {
    this.validatePayload(input);
    const created = await this.prismaService.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { idProduct: input.idProduct },
      });
      if (!product || !product.isActive) {
        throw new BadRequestException("El producto seleccionado no existe o está inactivo.");
      }

      const climateExists = await tx.catalogItem.findFirst({
        where: {
          catalogType: "climate_conditions",
          itemName: input.climate.trim(),
          isActive: true,
        },
      });
      if (!climateExists) {
        throw new BadRequestException(
          "La condición climática seleccionada no existe o está inactiva.",
        );
      }

      const production = await tx.productionRecord.create({
        data: {
          idProduct: input.idProduct,
          quantityBase: input.quantityBase,
          climate: input.climate.trim(),
          productionDate: new Date(input.productionDate),
        },
        include: { product: true },
      });

      const warehouse = await tx.inventory.findFirst({
        where: {
          idProduct: input.idProduct,
          locationType: "WAREHOUSE",
          idUser: null,
        },
      });

      if (warehouse) {
        await tx.inventory.update({
          where: { idInventory: warehouse.idInventory },
          data: { stock: { increment: input.quantityBase } },
        });
      } else {
        await tx.inventory.create({
          data: {
            idProduct: input.idProduct,
            locationType: "WAREHOUSE",
            idUser: null,
            stock: input.quantityBase,
          },
        });
      }

      await tx.inventoryMovement.create({
        data: {
          movementType: "IN",
          idProduct: input.idProduct,
          quantity: input.quantityBase,
          fromLocation: "Producción",
          toLocation: "Almacén principal",
          reason: `Registro de producción ${input.productionDate}`,
        },
      });

      return production;
    });

    return {
      idProduction: created.idProduction,
      productName: created.product.productName,
      quantityBase: created.quantityBase,
      baseUnitLabel: created.product.baseUnit,
      climate: created.climate,
      productionDate: created.productionDate.toISOString(),
    };
  }

  private validatePayload(input: CreateProductionDto): void {
    if (!Number.isInteger(input.idProduct) || input.idProduct <= 0) {
      throw new BadRequestException("El producto de producción no es válido.");
    }
    if (!Number.isInteger(input.quantityBase) || input.quantityBase <= 0) {
      throw new BadRequestException("La cantidad base producida debe ser entero mayor a 0.");
    }
    if (input.climate.trim().length < 3) {
      throw new BadRequestException("La condición climática no es válida.");
    }
    if (input.productionDate.trim().length !== 10) {
      throw new BadRequestException("La fecha de producción no tiene formato válido.");
    }
  }
}
