import { Body, Controller, Get, Param, Patch, Post, Put } from "@nestjs/common";
import type { CreateCatalogItemDto } from "./dto/create-catalog-item.dto";
import type { CreateCurrencyCatalogDto } from "./dto/create-currency-catalog.dto";
import type { UpdateRoleModulePermissionDto } from "./dto/update-role-module-permission.dto";
import type { UpdateCatalogItemDto } from "./dto/update-catalog-item.dto";
import type { UpdateCurrencyCatalogDto } from "./dto/update-currency-catalog.dto";
import type { UpdateSmtpSettingDto } from "./dto/update-smtp-setting.dto";
import type { UpdateSystemSettingDto } from "./dto/update-system-setting.dto";
import {
  SettingsService,
  type CatalogItemResponse,
  type CurrencyCatalogResponse,
  type SmtpSettingResponse,
  type SystemSettingResponse,
} from "./settings.service";

/**
 * Controlador de parámetros del sistema.
 */
@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  findAll(): Promise<SystemSettingResponse[]> {
    return this.settingsService.findAll();
  }

  @Get("smtp")
  getSmtp(): Promise<SmtpSettingResponse> {
    return this.settingsService.getSmtp();
  }

  @Put("smtp")
  updateSmtp(@Body() payload: UpdateSmtpSettingDto): Promise<SmtpSettingResponse> {
    return this.settingsService.updateSmtp(payload);
  }

  @Get("rbac/roles")
  listRoles() {
    return this.settingsService.listRoles();
  }

  @Get("catalogs/currencies")
  listCurrencies(): Promise<CurrencyCatalogResponse[]> {
    return this.settingsService.listCurrencies(true);
  }

  @Get("catalog-items/:catalogType")
  listCatalogItems(@Param("catalogType") catalogType: string): Promise<CatalogItemResponse[]> {
    return this.settingsService.listCatalogItems(catalogType);
  }

  @Post("catalog-items/:catalogType")
  createCatalogItem(
    @Param("catalogType") catalogType: string,
    @Body() payload: CreateCatalogItemDto,
  ): Promise<CatalogItemResponse> {
    return this.settingsService.createCatalogItem(catalogType, payload);
  }

  @Put("catalog-items/:catalogType/:idItem")
  updateCatalogItem(
    @Param("catalogType") catalogType: string,
    @Param("idItem") idItem: string,
    @Body() payload: UpdateCatalogItemDto,
  ): Promise<CatalogItemResponse> {
    return this.settingsService.updateCatalogItem(catalogType, Number(idItem), payload);
  }

  @Patch("catalog-items/:catalogType/:idItem/toggle")
  toggleCatalogItem(
    @Param("catalogType") catalogType: string,
    @Param("idItem") idItem: string,
  ): Promise<CatalogItemResponse> {
    return this.settingsService.toggleCatalogItem(catalogType, Number(idItem));
  }

  @Post("catalogs/currencies")
  createCurrency(@Body() payload: CreateCurrencyCatalogDto): Promise<CurrencyCatalogResponse> {
    return this.settingsService.createCurrency(payload);
  }

  @Put("catalogs/currencies/:idCurrency")
  updateCurrency(
    @Param("idCurrency") idCurrency: string,
    @Body() payload: UpdateCurrencyCatalogDto,
  ): Promise<CurrencyCatalogResponse> {
    return this.settingsService.updateCurrency(Number(idCurrency), payload);
  }

  @Patch("catalogs/currencies/:idCurrency/toggle")
  toggleCurrency(@Param("idCurrency") idCurrency: string): Promise<CurrencyCatalogResponse> {
    return this.settingsService.toggleCurrency(Number(idCurrency));
  }

  @Get("rbac/roles/:idRole/permissions")
  listPermissionsByRole(@Param("idRole") idRole: string) {
    return this.settingsService.listPermissionsByRole(Number(idRole));
  }

  @Put("rbac/roles/:idRole/modules/:moduleCode")
  updateRoleModulePermission(
    @Param("idRole") idRole: string,
    @Param("moduleCode") moduleCode: string,
    @Body() payload: UpdateRoleModulePermissionDto,
  ) {
    return this.settingsService.updateRoleModulePermission(Number(idRole), moduleCode, payload);
  }

  @Put(":settingKey")
  updateByKey(
    @Param("settingKey") settingKey: string,
    @Body() payload: UpdateSystemSettingDto,
  ): Promise<SystemSettingResponse> {
    return this.settingsService.updateByKey(settingKey, payload);
  }
}
