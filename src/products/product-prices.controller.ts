import { Body, Controller, Get, Post } from "@nestjs/common";
import type { UpsertProductPriceDto } from "./dto/upsert-product-price.dto";
import { ProductPricesService, type ProductPriceResponse } from "./product-prices.service";

/**
 * Controlador de precios fijos por producto.
 */
@Controller("product-prices")
export class ProductPricesController {
  constructor(private readonly productPricesService: ProductPricesService) {}

  @Get()
  findAll(): Promise<ProductPriceResponse[]> {
    return this.productPricesService.findAll();
  }

  @Post()
  upsert(@Body() payload: UpsertProductPriceDto): Promise<ProductPriceResponse> {
    return this.productPricesService.upsert(payload);
  }
}
