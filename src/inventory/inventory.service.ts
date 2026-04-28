import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../auth/types/auth-user.type";
import type { AssignInventoryDto } from "../sales/dto/assign-inventory.dto";
import type { TransferToWarehouseDto, TransferUserToUserDto } from "./dto/transfer-inventory.dto";

export interface InventoryRowResponse {
  idProduct: number;
  productName: string;
  locationType: "WAREHOUSE" | "USER";
  idUser: number | null;
  locationLabel: string;
  stock: number;
  baseUnit: string;
}

export interface SellerResponse {
  idUser: number;
  fullName: string;
  isActive: boolean;
}

export interface InventoryMovementResponse {
  idMovement: number;
  movementType: string;
  idProduct: number;
  productName: string;
  quantity: number;
  fromLocation: string;
  toLocation: string;
  reason: string;
  performedByName: string | null;
  createdAt: string;
}

/**
 * Servicio de inventario: consultas y movimientos de stock.
 */
@Injectable()
export class InventoryService {
  constructor(private readonly prismaService: PrismaService) {}

  async findAll(actor: AuthUser): Promise<InventoryRowResponse[]> {
    const rows = await this.prismaService.inventory.findMany({
      where: actor.role === "ADMIN" ? undefined : { locationType: "USER", idUser: actor.idUser },
      include: {
        product: true,
        user: true,
      },
      orderBy: [{ locationType: "asc" }, { idProduct: "asc" }],
    });

    return rows.map((row) => ({
      idProduct: row.idProduct,
      productName: row.product.productName,
      locationType: row.locationType as "WAREHOUSE" | "USER",
      idUser: row.idUser,
      locationLabel:
        row.locationType === "WAREHOUSE"
          ? "Almacén principal"
          : `Vendedor - ${row.user?.fullName ?? `ID ${row.idUser ?? 0}`}`,
      stock: row.stock,
      baseUnit: row.product.baseUnit,
    }));
  }

  async findSellers(actor: AuthUser): Promise<SellerResponse[]> {
    if (actor.role !== "ADMIN") {
      const currentUser = await this.prismaService.user.findUnique({
        where: { idUser: actor.idUser },
      });
      return [
        {
          idUser: actor.idUser,
          fullName: currentUser?.fullName ?? actor.email,
          isActive: true,
        },
      ];
    }
    const rows = await this.prismaService.user.findMany({
      where: {
        isActive: true,
        role: {
          roleName: { in: ["SELLER", "ADMIN"] },
        },
      },
      orderBy: {
        fullName: "asc",
      },
    });

    return rows.map((row) => ({
      idUser: row.idUser,
      fullName: row.fullName,
      isActive: row.isActive,
    }));
  }

  /**
   * Lista usuarios activos con rol SELLER o ADMIN (para ventas desde inventario propio).
   */
  async findSalesActors(actor: AuthUser): Promise<SellerResponse[]> {
    if (actor.role !== "ADMIN") {
      const currentUser = await this.prismaService.user.findUnique({
        where: { idUser: actor.idUser },
      });
      return [
        {
          idUser: actor.idUser,
          fullName: currentUser?.fullName ?? actor.email,
          isActive: true,
        },
      ];
    }
    const rows = await this.prismaService.user.findMany({
      where: {
        isActive: true,
        role: {
          roleName: { in: ["SELLER", "ADMIN"] },
        },
      },
      orderBy: {
        fullName: "asc",
      },
    });
    return rows.map((row) => ({
      idUser: row.idUser,
      fullName: row.fullName,
      isActive: row.isActive,
    }));
  }

  async findMovements(actor: AuthUser): Promise<InventoryMovementResponse[]> {
    const rows = await this.prismaService.inventoryMovement.findMany({
      where: actor.role === "ADMIN" ? undefined : { idPerformedBy: actor.idUser },
      include: { product: true, performedBy: true },
      orderBy: { createdAt: "desc" },
      take: 400,
    });
    return rows.map((row) => ({
      idMovement: Number(row.idMovement),
      movementType: row.movementType,
      idProduct: row.idProduct,
      productName: row.product.productName,
      quantity: row.quantity,
      fromLocation: row.fromLocation,
      toLocation: row.toLocation,
      reason: row.reason,
      performedByName: row.performedBy?.fullName ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  /**
   * Asigna stock del almacen al vendedor (mismo flujo que antes en ventas).
   */
  async assignFromWarehouseToSeller(
    input: AssignInventoryDto,
    performedByUserId: number,
  ): Promise<{ message: string }> {
    this.validateAssignPayload(input);

    await this.prismaService.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { idUser: input.idUser },
        include: {
          role: true,
        },
      });
      if (!user || !user.isActive || user.role.roleName !== "SELLER") {
        throw new BadRequestException("El vendedor seleccionado no existe, está inactivo o no es vendedor.");
      }

      const product = await tx.product.findUnique({
        where: { idProduct: input.idProduct },
      });
      if (!product || !product.isActive) {
        throw new BadRequestException("El producto seleccionado no existe o está inactivo.");
      }

      const warehouseRow = await tx.inventory.findFirst({
        where: {
          idProduct: input.idProduct,
          locationType: "WAREHOUSE",
          idUser: null,
        },
      });
      if (!warehouseRow) {
        throw new BadRequestException("No hay inventario en almacén para este producto.");
      }
      if (warehouseRow.stock < input.quantityBase) {
        throw new BadRequestException(
          `Stock insuficiente en almacén. Disponible: ${warehouseRow.stock}.`,
        );
      }

      const updatedWarehouse = await tx.inventory.updateMany({
        where: {
          idInventory: warehouseRow.idInventory,
          stock: {
            gte: input.quantityBase,
          },
        },
        data: {
          stock: {
            decrement: input.quantityBase,
          },
        },
      });
      if (updatedWarehouse.count !== 1) {
        throw new BadRequestException(
          "No se pudo descontar inventario de almacén. Reintenta la operación.",
        );
      }

      const sellerInventoryRow = await tx.inventory.findFirst({
        where: {
          idProduct: input.idProduct,
          locationType: "USER",
          idUser: input.idUser,
        },
      });

      if (sellerInventoryRow) {
        await tx.inventory.update({
          where: { idInventory: sellerInventoryRow.idInventory },
          data: {
            stock: {
              increment: input.quantityBase,
            },
          },
        });
      } else {
        await tx.inventory.create({
          data: {
            idProduct: input.idProduct,
            locationType: "USER",
            idUser: input.idUser,
            stock: input.quantityBase,
          },
        });
      }

      await tx.inventoryMovement.create({
        data: {
          movementType: "ASSIGN",
          idProduct: input.idProduct,
          quantity: input.quantityBase,
          fromLocation: "Almacén principal",
          toLocation: `Vendedor - ${user.fullName}`,
          reason: "Asignación manual de inventario",
          idPerformedBy: performedByUserId,
        },
      });
    });

    return {
      message: "Inventario asignado correctamente al vendedor.",
    };
  }

  /**
   * Devuelve stock del vendedor al almacen.
   */
  async transferUserStockToWarehouse(
    input: TransferToWarehouseDto,
    performedByUserId: number,
  ): Promise<{ message: string }> {
    if (!Number.isInteger(input.idProduct) || input.idProduct <= 0) {
      throw new BadRequestException("Producto inválido.");
    }
    if (!Number.isInteger(input.idUser) || input.idUser <= 0) {
      throw new BadRequestException("Usuario inválido.");
    }
    if (!Number.isInteger(input.quantityBase) || input.quantityBase <= 0) {
      throw new BadRequestException("La cantidad debe ser entera mayor a 0.");
    }
    if (input.reason.trim().length < 2) {
      throw new BadRequestException("Indica un motivo (al menos 2 caracteres).");
    }

    await this.prismaService.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { idUser: input.idUser },
        include: { role: true },
      });
      if (!user || !user.isActive || user.role.roleName !== "SELLER") {
        throw new BadRequestException("El vendedor origen no existe, está inactivo o no es vendedor.");
      }
      const product = await tx.product.findUnique({ where: { idProduct: input.idProduct } });
      if (!product || !product.isActive) {
        throw new BadRequestException("Producto inválido.");
      }

      const sellerRow = await tx.inventory.findFirst({
        where: {
          idProduct: input.idProduct,
          locationType: "USER",
          idUser: input.idUser,
        },
      });
      if (!sellerRow || sellerRow.stock < input.quantityBase) {
        throw new BadRequestException(
          `Stock insuficiente en vendedor. Disponible: ${sellerRow?.stock ?? 0}.`,
        );
      }

      const dec = await tx.inventory.updateMany({
        where: {
          idInventory: sellerRow.idInventory,
          stock: { gte: input.quantityBase },
        },
        data: { stock: { decrement: input.quantityBase } },
      });
      if (dec.count !== 1) {
        throw new BadRequestException("No se pudo descontar stock del vendedor.");
      }

      const wh = await tx.inventory.findFirst({
        where: { idProduct: input.idProduct, locationType: "WAREHOUSE", idUser: null },
      });
      if (wh) {
        await tx.inventory.update({
          where: { idInventory: wh.idInventory },
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
          movementType: "RETURN_TO_WAREHOUSE",
          idProduct: input.idProduct,
          quantity: input.quantityBase,
          fromLocation: `Vendedor - ${user.fullName}`,
          toLocation: "Almacén principal",
          reason: input.reason.trim(),
          idPerformedBy: performedByUserId,
        },
      });
    });

    return { message: "Transferencia a almacén registrada." };
  }

  /**
   * Transfiere stock entre dos vendedores.
   */
  async transferBetweenUsers(
    input: TransferUserToUserDto,
    performedByUserId: number,
  ): Promise<{ message: string }> {
    if (!Number.isInteger(input.idProduct) || input.idProduct <= 0) {
      throw new BadRequestException("Producto inválido.");
    }
    if (!Number.isInteger(input.fromUserId) || !Number.isInteger(input.toUserId)) {
      throw new BadRequestException("Usuarios inválidos.");
    }
    if (input.fromUserId === input.toUserId) {
      throw new BadRequestException("Origen y destino deben ser distintos.");
    }
    if (!Number.isInteger(input.quantityBase) || input.quantityBase <= 0) {
      throw new BadRequestException("La cantidad debe ser entera mayor a 0.");
    }
    if (input.reason.trim().length < 2) {
      throw new BadRequestException("Indica un motivo (al menos 2 caracteres).");
    }

    await this.prismaService.$transaction(async (tx) => {
      const fromUser = await tx.user.findUnique({
        where: { idUser: input.fromUserId },
        include: { role: true },
      });
      const toUser = await tx.user.findUnique({
        where: { idUser: input.toUserId },
        include: { role: true },
      });
      if (
        !fromUser ||
        !fromUser.isActive ||
        fromUser.role.roleName !== "SELLER" ||
        !toUser ||
        !toUser.isActive ||
        toUser.role.roleName !== "SELLER"
      ) {
        throw new BadRequestException("Vendedor origen o destino inválido o inactivo.");
      }
      const product = await tx.product.findUnique({ where: { idProduct: input.idProduct } });
      if (!product || !product.isActive) {
        throw new BadRequestException("Producto inválido.");
      }

      const fromRow = await tx.inventory.findFirst({
        where: {
          idProduct: input.idProduct,
          locationType: "USER",
          idUser: input.fromUserId,
        },
      });
      if (!fromRow || fromRow.stock < input.quantityBase) {
        throw new BadRequestException(
          `Stock insuficiente en origen. Disponible: ${fromRow?.stock ?? 0}.`,
        );
      }

      const dec = await tx.inventory.updateMany({
        where: {
          idInventory: fromRow.idInventory,
          stock: { gte: input.quantityBase },
        },
        data: { stock: { decrement: input.quantityBase } },
      });
      if (dec.count !== 1) {
        throw new BadRequestException("No se pudo descontar stock del origen.");
      }

      const toRow = await tx.inventory.findFirst({
        where: {
          idProduct: input.idProduct,
          locationType: "USER",
          idUser: input.toUserId,
        },
      });
      if (toRow) {
        await tx.inventory.update({
          where: { idInventory: toRow.idInventory },
          data: { stock: { increment: input.quantityBase } },
        });
      } else {
        await tx.inventory.create({
          data: {
            idProduct: input.idProduct,
            locationType: "USER",
            idUser: input.toUserId,
            stock: input.quantityBase,
          },
        });
      }

      await tx.inventoryMovement.create({
        data: {
          movementType: "TRANSFER_USER",
          idProduct: input.idProduct,
          quantity: input.quantityBase,
          fromLocation: `Vendedor - ${fromUser.fullName}`,
          toLocation: `Vendedor - ${toUser.fullName}`,
          reason: input.reason.trim(),
          idPerformedBy: performedByUserId,
        },
      });
    });

    return { message: "Transferencia entre vendedores registrada." };
  }

  private validateAssignPayload(input: AssignInventoryDto): void {
    if (!Number.isInteger(input.idUser) || input.idUser <= 0) {
      throw new BadRequestException("El vendedor no es válido.");
    }
    if (!Number.isInteger(input.idProduct) || input.idProduct <= 0) {
      throw new BadRequestException("El producto no es válido.");
    }
    if (!Number.isInteger(input.quantityBase) || input.quantityBase <= 0) {
      throw new BadRequestException("La cantidad base a asignar debe ser entero mayor a 0.");
    }
  }
}
