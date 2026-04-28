import { Body, Controller, Get, Post } from "@nestjs/common";
import type { CreateProductionDto } from "./dto/create-production.dto";
import { ProductionService, type ProductionResponse } from "./production.service";

/**
 * Controlador de operaciones de producción.
 */
@Controller("production")
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  @Get()
  findAll(): Promise<ProductionResponse[]> {
    return this.productionService.findAll();
  }

  @Post()
  create(@Body() payload: CreateProductionDto): Promise<ProductionResponse> {
    return this.productionService.create(payload);
  }
}
