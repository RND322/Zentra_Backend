import { Controller, Get } from "@nestjs/common";
import type { Product } from "@prisma/client";
import { ProductsService } from "./products.service";

/**
 * Controlador de productos para catálogos operativos.
 */
@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(): Promise<Product[]> {
    return this.productsService.findAll();
  }
}
