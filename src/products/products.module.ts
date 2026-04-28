import { Module } from "@nestjs/common";
import { ProductPricesController } from "./product-prices.controller";
import { ProductPricesService } from "./product-prices.service";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

/**
 * Módulo de productos.
 */
@Module({
  controllers: [ProductsController, ProductPricesController],
  providers: [ProductsService, ProductPricesService],
})
export class ProductsModule {}
