import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateCatalogItemDto } from "./dto/create-catalog-item.dto";
import type { CreateCurrencyCatalogDto } from "./dto/create-currency-catalog.dto";
import type { UpdateRoleModulePermissionDto } from "./dto/update-role-module-permission.dto";
import type { UpdateCatalogItemDto } from "./dto/update-catalog-item.dto";
import type { UpdateCurrencyCatalogDto } from "./dto/update-currency-catalog.dto";
import type { UpdateSmtpSettingDto } from "./dto/update-smtp-setting.dto";
import type { UpdateSystemSettingDto } from "./dto/update-system-setting.dto";

export interface SystemSettingResponse {
  settingKey: string;
  settingValue: string;
  valueType: "string" | "number" | "boolean" | "json";
  category: string;
  description: string;
}

export interface SmtpSettingResponse {
  host: string;
  port: number;
  username: string;
  encryptedPassword: string;
  encryption: "TLS" | "SSL" | "NONE";
  senderEmail: string;
  senderName: string;
  isActive: boolean;
}

export interface RoleSummaryResponse {
  idRole: number;
  roleName: string;
  isActive: boolean;
}

export interface RolePermissionRowResponse {
  moduleCode: string;
  moduleName: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canExport: boolean;
}

export interface CurrencyCatalogResponse {
  idCurrency: number;
  currencyCode: string;
  currencyName: string;
  currencySymbol: string;
  isActive: boolean;
}

export interface CatalogItemResponse {
  idItem: number;
  catalogType: string;
  itemName: string;
  isActive: boolean;
}

/**
 * Servicio de parámetros globales del sistema.
 */
@Injectable()
export class SettingsService {
  private readonly allowedCatalogTypes = new Set<string>([
    "products",
    "climate_conditions",
    "roles",
    "payment_types",
    "business_lines",
    "sub_lines",
    "units",
    "production_subtypes",
    "customer_places",
  ]);

  private ensureAllowedCatalogType(catalogType: string): string {
    const normalized = catalogType.trim().toLowerCase();
    if (!this.allowedCatalogTypes.has(normalized)) {
      throw new BadRequestException("Tipo de catálogo no permitido.");
    }
    return normalized;
  }

  constructor(private readonly prismaService: PrismaService) {}

  async findAll(): Promise<SystemSettingResponse[]> {
    const rows = await this.prismaService.systemSetting.findMany({
      orderBy: [{ category: "asc" }, { settingKey: "asc" }],
    });
    return rows.map((row) => ({
      settingKey: row.settingKey,
      settingValue: row.settingValue,
      valueType: row.valueType as SystemSettingResponse["valueType"],
      category: row.category ?? "",
      description: row.description ?? "",
    }));
  }

  async updateByKey(
    settingKey: string,
    input: UpdateSystemSettingDto,
  ): Promise<SystemSettingResponse> {
    if (settingKey === "billing_invoice_range_current") {
      throw new BadRequestException(
        "El correlativo actual de factura es de solo lectura.",
      );
    }
    const normalizedValue = input.settingValue.trim();
    if (normalizedValue.length === 0) {
      throw new BadRequestException("El valor del parámetro no puede estar vacío.");
    }

    const current = await this.prismaService.systemSetting.findUnique({
      where: { settingKey },
    });
    if (!current) {
      throw new BadRequestException("No existe el parámetro solicitado.");
    }

    if (current.valueType === "number" && Number.isNaN(Number(normalizedValue))) {
      throw new BadRequestException("El parámetro requiere un valor numérico.");
    }

    if (
      current.valueType === "boolean" &&
      normalizedValue !== "true" &&
      normalizedValue !== "false"
    ) {
      throw new BadRequestException("El parámetro booleano solo acepta true o false.");
    }
    if (settingKey === "system_currency_code") {
      const activeCurrency = await this.prismaService.currencyCatalog.findFirst({
        where: {
          currencyCode: normalizedValue.toUpperCase(),
          isActive: true,
        },
      });
      if (!activeCurrency) {
        throw new BadRequestException(
          "La moneda seleccionada no existe en el catálogo activo.",
        );
      }
    }

    const updated = await this.prismaService.systemSetting.update({
      where: { settingKey },
      data: {
        settingValue:
          settingKey === "system_currency_code" ? normalizedValue.toUpperCase() : normalizedValue,
      },
    });
    return {
      settingKey: updated.settingKey,
      settingValue: updated.settingValue,
      valueType: updated.valueType as SystemSettingResponse["valueType"],
      category: updated.category ?? "",
      description: updated.description ?? "",
    };
  }

  async getSmtp(): Promise<SmtpSettingResponse> {
    const row = await this.prismaService.smtpSetting.findFirst({
      orderBy: { idSmtpSetting: "asc" },
    });
    if (!row) {
      return {
        host: "",
        port: 587,
        username: "",
        encryptedPassword: "",
        encryption: "TLS",
        senderEmail: "",
        senderName: "",
        isActive: false,
      };
    }
    return {
      host: row.smtpHost,
      port: row.smtpPort,
      username: row.smtpUser,
      encryptedPassword: row.smtpPasswordEnc,
      encryption: row.smtpEncryption as SmtpSettingResponse["encryption"],
      senderEmail: row.fromEmail,
      senderName: row.fromName ?? "",
      isActive: row.isActive,
    };
  }

  async updateSmtp(input: UpdateSmtpSettingDto): Promise<SmtpSettingResponse> {
    if (input.host.trim().length === 0 || input.username.trim().length === 0) {
      throw new BadRequestException("Host y usuario SMTP son obligatorios.");
    }
    if (!Number.isInteger(input.port) || input.port <= 0) {
      throw new BadRequestException("Puerto SMTP inválido.");
    }
    const row = await this.prismaService.smtpSetting.findFirst({
      orderBy: { idSmtpSetting: "asc" },
    });
    const saved = row
      ? await this.prismaService.smtpSetting.update({
          where: { idSmtpSetting: row.idSmtpSetting },
          data: {
            smtpHost: input.host.trim(),
            smtpPort: input.port,
            smtpUser: input.username.trim(),
            smtpPasswordEnc: input.encryptedPassword,
            smtpEncryption: input.encryption,
            fromEmail: input.senderEmail.trim(),
            fromName: input.senderName.trim().length > 0 ? input.senderName.trim() : null,
            isActive: input.isActive,
          },
        })
      : await this.prismaService.smtpSetting.create({
          data: {
            smtpHost: input.host.trim(),
            smtpPort: input.port,
            smtpUser: input.username.trim(),
            smtpPasswordEnc: input.encryptedPassword,
            smtpEncryption: input.encryption,
            fromEmail: input.senderEmail.trim(),
            fromName: input.senderName.trim().length > 0 ? input.senderName.trim() : null,
            isActive: input.isActive,
          },
        });

    return {
      host: saved.smtpHost,
      port: saved.smtpPort,
      username: saved.smtpUser,
      encryptedPassword: saved.smtpPasswordEnc,
      encryption: saved.smtpEncryption as SmtpSettingResponse["encryption"],
      senderEmail: saved.fromEmail,
      senderName: saved.fromName ?? "",
      isActive: saved.isActive,
    };
  }

  async listRoles(): Promise<RoleSummaryResponse[]> {
    const rows = await this.prismaService.role.findMany({
      where: { isActive: true },
      orderBy: { roleName: "asc" },
    });
    return rows.map((row) => ({
      idRole: row.idRole,
      roleName: row.roleName,
      isActive: row.isActive,
    }));
  }

  async listCatalogItems(catalogType: string): Promise<CatalogItemResponse[]> {
    const normalizedType = this.ensureAllowedCatalogType(catalogType);
    const rows = await this.prismaService.catalogItem.findMany({
      where: { catalogType: normalizedType },
      orderBy: [{ isActive: "desc" }, { itemName: "asc" }],
    });
    return rows.map((row) => ({
      idItem: row.idItem,
      catalogType: row.catalogType,
      itemName: row.itemName,
      isActive: row.isActive,
    }));
  }

  async createCatalogItem(
    catalogType: string,
    input: CreateCatalogItemDto,
  ): Promise<CatalogItemResponse> {
    const normalizedType = this.ensureAllowedCatalogType(catalogType);
    const itemName = input.itemName.trim();
    if (itemName.length < 2) {
      throw new BadRequestException("El nombre del catálogo no es válido.");
    }
    const created = await this.prismaService.catalogItem.create({
      data: {
        catalogType: normalizedType,
        itemName,
        isActive: true,
      },
    });
    return {
      idItem: created.idItem,
      catalogType: created.catalogType,
      itemName: created.itemName,
      isActive: created.isActive,
    };
  }

  async updateCatalogItem(
    catalogType: string,
    idItem: number,
    input: UpdateCatalogItemDto,
  ): Promise<CatalogItemResponse> {
    const normalizedType = this.ensureAllowedCatalogType(catalogType);
    if (!Number.isInteger(idItem) || idItem <= 0) {
      throw new BadRequestException("El item de catálogo no es válido.");
    }
    const itemName = input.itemName.trim();
    if (itemName.length < 2) {
      throw new BadRequestException("El nombre actualizado no es válido.");
    }
    const updated = await this.prismaService.catalogItem.updateMany({
      where: {
        idItem,
        catalogType: normalizedType,
      },
      data: { itemName },
    });
    if (updated.count !== 1) {
      throw new BadRequestException("No se encontró el item de catálogo a actualizar.");
    }
    const row = await this.prismaService.catalogItem.findUnique({
      where: { idItem },
    });
    if (!row) {
      throw new BadRequestException("No se pudo recuperar el item actualizado.");
    }
    return {
      idItem: row.idItem,
      catalogType: row.catalogType,
      itemName: row.itemName,
      isActive: row.isActive,
    };
  }

  async toggleCatalogItem(catalogType: string, idItem: number): Promise<CatalogItemResponse> {
    const normalizedType = this.ensureAllowedCatalogType(catalogType);
    if (!Number.isInteger(idItem) || idItem <= 0) {
      throw new BadRequestException("El item de catálogo no es válido.");
    }
    const current = await this.prismaService.catalogItem.findFirst({
      where: {
        idItem,
        catalogType: normalizedType,
      },
    });
    if (!current) {
      throw new BadRequestException("No se encontró el item de catálogo.");
    }
    const updated = await this.prismaService.catalogItem.update({
      where: { idItem },
      data: { isActive: !current.isActive },
    });
    return {
      idItem: updated.idItem,
      catalogType: updated.catalogType,
      itemName: updated.itemName,
      isActive: updated.isActive,
    };
  }

  async listCurrencies(includeInactive = false): Promise<CurrencyCatalogResponse[]> {
    const rows = await this.prismaService.currencyCatalog.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { currencyCode: "asc" },
    });
    return rows.map((row) => ({
      idCurrency: row.idCurrency,
      currencyCode: row.currencyCode,
      currencyName: row.currencyName,
      currencySymbol: row.currencySymbol,
      isActive: row.isActive,
    }));
  }

  async createCurrency(input: CreateCurrencyCatalogDto): Promise<CurrencyCatalogResponse> {
    const currencyCode = input.currencyCode.trim().toUpperCase();
    const currencyName = input.currencyName.trim();
    const currencySymbol = input.currencySymbol.trim();
    if (currencyCode.length < 3 || currencyCode.length > 10) {
      throw new BadRequestException("El código de moneda no es válido.");
    }
    if (currencyName.length < 2) {
      throw new BadRequestException("El nombre de moneda no es válido.");
    }
    if (currencySymbol.length < 1 || currencySymbol.length > 10) {
      throw new BadRequestException("El símbolo de moneda no es válido.");
    }
    const created = await this.prismaService.currencyCatalog.create({
      data: {
        currencyCode,
        currencyName,
        currencySymbol,
        isActive: true,
      },
    });
    return {
      idCurrency: created.idCurrency,
      currencyCode: created.currencyCode,
      currencyName: created.currencyName,
      currencySymbol: created.currencySymbol,
      isActive: created.isActive,
    };
  }

  async updateCurrency(
    idCurrency: number,
    input: UpdateCurrencyCatalogDto,
  ): Promise<CurrencyCatalogResponse> {
    if (!Number.isInteger(idCurrency) || idCurrency <= 0) {
      throw new BadRequestException("La moneda no es válida.");
    }
    const currencyName = input.currencyName.trim();
    const currencySymbol = input.currencySymbol.trim();
    if (currencyName.length < 2) {
      throw new BadRequestException("El nombre de moneda no es válido.");
    }
    if (currencySymbol.length < 1 || currencySymbol.length > 10) {
      throw new BadRequestException("El símbolo de moneda no es válido.");
    }
    const updated = await this.prismaService.currencyCatalog.update({
      where: { idCurrency },
      data: {
        currencyName,
        currencySymbol,
      },
    });
    return {
      idCurrency: updated.idCurrency,
      currencyCode: updated.currencyCode,
      currencyName: updated.currencyName,
      currencySymbol: updated.currencySymbol,
      isActive: updated.isActive,
    };
  }

  async toggleCurrency(idCurrency: number): Promise<CurrencyCatalogResponse> {
    if (!Number.isInteger(idCurrency) || idCurrency <= 0) {
      throw new BadRequestException("La moneda no es válida.");
    }
    const current = await this.prismaService.currencyCatalog.findUnique({
      where: { idCurrency },
    });
    if (!current) {
      throw new BadRequestException("La moneda no existe.");
    }
    const updated = await this.prismaService.currencyCatalog.update({
      where: { idCurrency },
      data: { isActive: !current.isActive },
    });
    return {
      idCurrency: updated.idCurrency,
      currencyCode: updated.currencyCode,
      currencyName: updated.currencyName,
      currencySymbol: updated.currencySymbol,
      isActive: updated.isActive,
    };
  }

  async listPermissionsByRole(idRole: number): Promise<RolePermissionRowResponse[]> {
    if (!Number.isInteger(idRole) || idRole <= 0) {
      throw new BadRequestException("El rol no es válido.");
    }
    const role = await this.prismaService.role.findUnique({ where: { idRole } });
    if (!role || !role.isActive) {
      throw new BadRequestException("El rol no existe o está inactivo.");
    }

    const rows = await this.prismaService.roleModulePermission.findMany({
      where: { idRole },
      include: { module: true },
      orderBy: { module: { moduleName: "asc" } },
    });
    return rows.map((row) => ({
      moduleCode: row.module.moduleCode,
      moduleName: row.module.moduleName,
      canCreate: row.canCreate,
      canRead: row.canRead,
      canUpdate: row.canUpdate,
      canDelete: row.canDelete,
      canExport: row.canExport,
    }));
  }

  async updateRoleModulePermission(
    idRole: number,
    moduleCode: string,
    input: UpdateRoleModulePermissionDto,
  ): Promise<RolePermissionRowResponse> {
    if (!Number.isInteger(idRole) || idRole <= 0) {
      throw new BadRequestException("El rol no es válido.");
    }
    const module = await this.prismaService.module.findUnique({
      where: { moduleCode },
    });
    if (!module || !module.isActive) {
      throw new BadRequestException("El módulo no existe o está inactivo.");
    }
    const row = await this.prismaService.roleModulePermission.upsert({
      where: {
        idRole_idModule: {
          idRole,
          idModule: module.idModule,
        },
      },
      create: {
        idRole,
        idModule: module.idModule,
        canCreate: input.canCreate,
        canRead: input.canRead,
        canUpdate: input.canUpdate,
        canDelete: input.canDelete,
        canExport: input.canExport,
      },
      update: {
        canCreate: input.canCreate,
        canRead: input.canRead,
        canUpdate: input.canUpdate,
        canDelete: input.canDelete,
        canExport: input.canExport,
      },
      include: { module: true },
    });
    return {
      moduleCode: row.module.moduleCode,
      moduleName: row.module.moduleName,
      canCreate: row.canCreate,
      canRead: row.canRead,
      canUpdate: row.canUpdate,
      canDelete: row.canDelete,
      canExport: row.canExport,
    };
  }
}
