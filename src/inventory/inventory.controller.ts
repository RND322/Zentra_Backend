import { Body, Controller, ForbiddenException, Get, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthUser } from "../auth/types/auth-user.type";
import { PermissionsService } from "../auth/permissions.service";
import type { TransferToWarehouseDto, TransferUserToUserDto } from "./dto/transfer-inventory.dto";
import {
  type InventoryMovementResponse,
  type InventoryRowResponse,
  InventoryService,
  type SellerResponse,
} from "./inventory.service";

/**
 * Controlador de inventario para vistas de operación.
 */
@Controller("inventory")
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get()
  async findAll(@CurrentUser() user: AuthUser): Promise<InventoryRowResponse[]> {
    await this.permissionsService.assertModulePermission(user.idUser, "inventory", "read");
    return this.inventoryService.findAll(user);
  }

  @Get("sellers")
  async findSellers(@CurrentUser() user: AuthUser): Promise<SellerResponse[]> {
    await this.permissionsService.assertModulePermission(user.idUser, "inventory", "read");
    return this.inventoryService.findSellers(user);
  }

  /**
   * Actores para ventas (vendedores y administradores con inventario propio opcional).
   */
  @Get("sales-actors")
  async findSalesActors(@CurrentUser() user: AuthUser): Promise<SellerResponse[]> {
    await this.permissionsService.assertModulePermission(user.idUser, "inventory", "read");
    return this.inventoryService.findSalesActors(user);
  }

  @Get("movements")
  async findMovements(@CurrentUser() user: AuthUser): Promise<InventoryMovementResponse[]> {
    await this.permissionsService.assertModulePermission(user.idUser, "inventory", "read");
    return this.inventoryService.findMovements(user);
  }

  @Post("transfer/to-warehouse")
  async transferToWarehouse(
    @Body() payload: TransferToWarehouseDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string }> {
    await this.permissionsService.assertModulePermission(user.idUser, "inventory", "update");
    if (user.role !== "ADMIN" && payload.idUser !== user.idUser) {
      throw new ForbiddenException("Solo puedes devolver tu propio inventario.");
    }
    return this.inventoryService.transferUserStockToWarehouse(payload, user.idUser);
  }

  @Post("transfer/between-users")
  async transferBetweenUsers(
    @Body() payload: TransferUserToUserDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string }> {
    await this.permissionsService.assertModulePermission(user.idUser, "inventory", "update");
    if (user.role !== "ADMIN" && payload.fromUserId !== user.idUser) {
      throw new ForbiddenException("Solo puedes transferir desde tu propio inventario.");
    }
    return this.inventoryService.transferBetweenUsers(payload, user.idUser);
  }
}
