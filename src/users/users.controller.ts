import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsService } from "../auth/permissions.service";
import type { AuthUser } from "../auth/types/auth-user.type";
import type { CreateUserDto } from "./dto/create-user.dto";
import type { UpdateUserDto } from "./dto/update-user.dto";
import {
  UsersService,
  type RoleOptionResponse,
  type UserAdminResponse,
} from "./users.service";

/**
 * CRUD usuarios del sistema (permisos modulo users).
 */
@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get("roles")
  async listRoles(@CurrentUser() user: AuthUser): Promise<RoleOptionResponse[]> {
    await this.permissionsService.assertModulePermission(user.idUser, "users", "read");
    return this.usersService.listRoles();
  }

  @Get()
  async findAll(@CurrentUser() user: AuthUser): Promise<UserAdminResponse[]> {
    await this.permissionsService.assertModulePermission(user.idUser, "users", "read");
    return this.usersService.findAll();
  }

  @Post()
  async create(
    @Body() payload: CreateUserDto,
    @CurrentUser() user: AuthUser,
  ): Promise<UserAdminResponse> {
    await this.permissionsService.assertModulePermission(user.idUser, "users", "create");
    return this.usersService.create(payload);
  }

  @Patch(":idUser")
  async update(
    @Param("idUser", ParseIntPipe) idUser: number,
    @Body() payload: UpdateUserDto,
    @CurrentUser() user: AuthUser,
  ): Promise<UserAdminResponse> {
    await this.permissionsService.assertModulePermission(user.idUser, "users", "update");
    return this.usersService.update(idUser, payload, user.idUser);
  }
}
