import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthUser } from "../auth/types/auth-user.type";
import type { AssignInventoryDto } from "./dto/assign-inventory.dto";
import type { CreateSaleDto } from "./dto/create-sale.dto";
import type { RegisterCreditPaymentDto } from "./dto/register-credit-payment.dto";
import type { RegisterCustomerBalancePaymentDto } from "./dto/register-customer-balance-payment.dto";
import {
  type CreditAccountResponse,
  type CustomerCreditSummaryResponse,
  type SaleResponse,
  SalesService,
} from "./sales.service";

/**
 * Controlador HTTP para operaciones de ventas.
 */
@Controller("sales")
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser): Promise<SaleResponse[]> {
    return this.salesService.findAll(user);
  }

  @Post()
  create(
    @Body() payload: CreateSaleDto,
    @CurrentUser() user: AuthUser,
  ): Promise<SaleResponse> {
    return this.salesService.create(payload, user);
  }

  @Get("credit-accounts")
  findCreditAccounts(@CurrentUser() user: AuthUser): Promise<CreditAccountResponse[]> {
    return this.salesService.findCreditAccounts(user);
  }

  @Get("customer-credit-summaries")
  findCustomerCreditSummaries(
    @CurrentUser() user: AuthUser,
  ): Promise<CustomerCreditSummaryResponse[]> {
    return this.salesService.findCustomerCreditSummaries(user);
  }

  @Post("credit-payments")
  registerCreditPayment(
    @Body() payload: RegisterCreditPaymentDto,
    @CurrentUser() user: AuthUser,
  ): Promise<CreditAccountResponse> {
    return this.salesService.registerCreditPayment(user, payload);
  }

  @Post("customer-balance-payments")
  registerCustomerBalancePayment(
    @Body() payload: RegisterCustomerBalancePaymentDto,
    @CurrentUser() user: AuthUser,
  ): Promise<CustomerCreditSummaryResponse> {
    return this.salesService.registerCustomerBalancePayment(user, payload);
  }

  @Post("assign-inventory")
  assignInventory(
    @Body() payload: AssignInventoryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string }> {
    return this.salesService.assignInventoryToSeller(user, payload);
  }
}
