import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsService } from "../auth/permissions.service";
import type { AuthUser } from "../auth/types/auth-user.type";
import { CustomersService, type CustomerResponse } from "./customers.service";
import type { CreateCustomerDto } from "./dto/create-customer.dto";

/**
 * Controlador de clientes.
 */
@Controller("customers")
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get()
  async findAll(@CurrentUser() user: AuthUser): Promise<CustomerResponse[]> {
    await this.permissionsService.assertModulePermission(user.idUser, "sales", "read");
    return this.customersService.findAll();
  }

  @Post()
  async create(
    @Body() payload: CreateCustomerDto,
    @CurrentUser() user: AuthUser,
  ): Promise<CustomerResponse> {
    await this.permissionsService.assertModulePermission(user.idUser, "sales", "create");
    return this.customersService.create(payload);
  }
}
