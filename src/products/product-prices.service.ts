import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { UpsertProductPriceDto } from "./dto/upsert-product-price.dto";

export interface ProductPriceResponse {
  idPrice: number;
  idProduct: number;
  unitLabel: string;
  price: number;
  validFrom: string;
  validTo: string | null;
}

/**
 * Servicio de consulta de precios fijos.
 */
@Injectable()
export class ProductPricesService {
  constructor(private readonly prismaService: PrismaService) {}

  async findAll(): Promise<ProductPriceResponse[]> {
    const rows = await this.prismaService.productPrice.findMany({
      orderBy: [{ idProduct: "asc" }, { validFrom: "desc" }],
    });
    return rows.map((row) => ({
      idPrice: row.idPrice,
      idProduct: row.idProduct,
      unitLabel: row.unitLabel,
      price: Number(row.price),
      validFrom: row.validFrom.toISOString().slice(0, 10),
      validTo: row.validTo ? row.validTo.toISOString().slice(0, 10) : null,
    }));
  }

  /**
   * Crea o actualiza precio activo por producto/unidad.
   */
  async upsert(input: UpsertProductPriceDto): Promise<ProductPriceResponse> {
    if (!Number.isInteger(input.idProduct) || input.idProduct <= 0) {
      throw new BadRequestException("El producto del precio no es válido.");
    }
    if (input.unitLabel.trim().length < 2) {
      throw new BadRequestException("La unidad del precio no es válida.");
    }
    if (!Number.isFinite(input.price) || input.price <= 0) {
      throw new BadRequestException("El precio fijo debe ser mayor a 0.");
    }

    const product = await this.prismaService.product.findUnique({
      where: { idProduct: input.idProduct },
    });
    if (!product || !product.isActive) {
      throw new BadRequestException("No existe el producto seleccionado para precio.");
    }

    const normalizedUnit = input.unitLabel.trim().toLowerCase();
    const existing = await this.prismaService.productPrice.findFirst({
      where: {
        idProduct: input.idProduct,
        unitLabel: normalizedUnit,
        validTo: null,
      },
    });

    const saved = existing
      ? await this.prismaService.productPrice.update({
          where: { idPrice: existing.idPrice },
          data: {
            price: input.price,
          },
        })
      : await this.prismaService.productPrice.create({
          data: {
            idProduct: input.idProduct,
            unitLabel: normalizedUnit,
            price: input.price,
            validFrom: new Date(),
            validTo: null,
          },
        });

    return {
      idPrice: saved.idPrice,
      idProduct: saved.idProduct,
      unitLabel: saved.unitLabel,
      price: Number(saved.price),
      validFrom: saved.validFrom.toISOString().slice(0, 10),
      validTo: saved.validTo ? saved.validTo.toISOString().slice(0, 10) : null,
    };
  }
}
