import { Injectable } from "@nestjs/common";
import type { Product } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Servicio de lectura de productos.
 */
@Injectable()
export class ProductsService {
  constructor(private readonly prismaService: PrismaService) {}

  async findAll(): Promise<Product[]> {
    return this.prismaService.product.findMany({
      where: { isActive: true },
      orderBy: { productName: "asc" },
    });
  }
}
