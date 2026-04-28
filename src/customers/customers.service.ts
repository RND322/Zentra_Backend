import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateCustomerDto } from "./dto/create-customer.dto";

/** Longitud minima razonable para telefono al registrar. */
const MIN_PHONE_LENGTH = 6;
/** Longitud minima para direccion al registrar. */
const MIN_ADDRESS_LENGTH = 5;

export interface CustomerResponse {
  idCustomer: number;
  customerName: string;
  phone: string;
  address: string;
  idPlace: number | null;
  placeName: string | null;
  isActive: boolean;
  createdAt: string;
}

/**
 * Servicio de catálogo de clientes.
 */
@Injectable()
export class CustomersService {
  constructor(private readonly prismaService: PrismaService) {}

  async findAll(): Promise<CustomerResponse[]> {
    const rows = await this.prismaService.customer.findMany({
      where: {
        isActive: true,
      },
      include: {
        placeItem: true,
      },
      orderBy: {
        customerName: "asc",
      },
    });
    return rows.map((row) => ({
      idCustomer: row.idCustomer,
      customerName: row.customerName,
      phone: row.phone ?? "",
      address: row.address ?? "",
      idPlace: row.idPlace,
      placeName: row.placeItem?.itemName ?? null,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  /**
   * Registra un cliente para ventas a credito o contado identificado.
   * Exige nombre, telefono, direccion y lugar de catalogo (no opcionales en alta).
   */
  async create(input: CreateCustomerDto): Promise<CustomerResponse> {
    const name = input.customerName.trim();
    if (name.length < 2) {
      throw new BadRequestException("El nombre del cliente debe tener al menos 2 caracteres.");
    }
    const phone = input.phone.trim();
    if (phone.length < MIN_PHONE_LENGTH) {
      throw new BadRequestException(
        `El telefono es obligatorio (minimo ${String(MIN_PHONE_LENGTH)} caracteres).`,
      );
    }
    const address = input.address.trim();
    if (address.length < MIN_ADDRESS_LENGTH) {
      throw new BadRequestException(
        `La direccion es obligatoria (minimo ${String(MIN_ADDRESS_LENGTH)} caracteres).`,
      );
    }
    if (!Number.isInteger(input.idPlace) || input.idPlace <= 0) {
      throw new BadRequestException("Debes elegir un lugar valido del catalogo.");
    }
    const placeRow = await this.prismaService.catalogItem.findFirst({
      where: {
        idItem: input.idPlace,
        catalogType: "customer_places",
        isActive: true,
      },
    });
    if (!placeRow) {
      throw new BadRequestException("El lugar seleccionado no es valido o esta inactivo.");
    }
    const idPlace = placeRow.idItem;

    const row = await this.prismaService.customer.create({
      data: {
        customerName: name,
        phone,
        address,
        idPlace,
        isActive: true,
      },
      include: { placeItem: true },
    });
    return {
      idCustomer: row.idCustomer,
      customerName: row.customerName,
      phone: row.phone ?? "",
      address: row.address ?? "",
      idPlace: row.idPlace,
      placeName: row.placeItem?.itemName ?? null,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
