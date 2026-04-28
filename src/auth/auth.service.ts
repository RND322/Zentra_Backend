import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare } from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import type { LoginDto } from "./dto/login.dto";
import type { JwtPayload } from "./types/jwt-payload.type";

export interface AuthSessionResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresInSeconds: number;
  user: {
    idUser: number;
    fullName: string;
    email: string;
    role: string;
  };
  permissions: Array<{
    moduleCode: string;
    canCreate: boolean;
    canRead: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canExport: boolean;
  }>;
}

const DEFAULT_JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "2h";
const INVALID_CREDENTIALS_MESSAGE = "Usuario o contraseña incorrecto.";
const INACTIVE_ACCOUNT_MESSAGE = "Cuenta inactiva. Contacte al administrador.";

/**
 * Convierte formato JWT_EXPIRES_IN (ej 2h, 30m, 900) a segundos.
 */
const toExpiresInSeconds = (value: string): number => {
  const normalized = value.trim().toLowerCase();
  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }
  const match = normalized.match(/^(\d+)\s*([smhd])$/);
  if (!match) {
    return 60 * 60 * 8;
  }
  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === "s") {
    return amount;
  }
  if (unit === "m") {
    return amount * 60;
  }
  if (unit === "h") {
    return amount * 60 * 60;
  }
  return amount * 60 * 60 * 24;
};

/**
 * Servicio de autenticación JWT.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private getJwtExpiresConfig(): { raw: string; seconds: number } {
    const raw = (process.env["JWT_EXPIRES_IN"] ?? DEFAULT_JWT_EXPIRES_IN).trim();
    return {
      raw,
      seconds: toExpiresInSeconds(raw),
    };
  }

  /**
   * Valida credenciales y retorna sesión JWT.
   */
  async login(input: LoginDto): Promise<AuthSessionResponse> {
    const email = input.email.trim().toLowerCase();
    const password = input.password;
    if (email.length < 5 || password.length < 8) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const user = await this.prismaService.user.findUnique({
      where: { email },
      include: { role: true },
    });
    if (!user) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }
    if (!user.isActive) {
      throw new UnauthorizedException(INACTIVE_ACCOUNT_MESSAGE);
    }

    const passwordMatches = await compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    await this.prismaService.user.update({
      where: { idUser: user.idUser },
      data: { lastLoginAt: new Date() },
    });

    const payload: JwtPayload = {
      sub: user.idUser,
      email: user.email,
      role: user.role.roleName,
    };
    const jwtExpires = this.getJwtExpiresConfig();
    const expiresInSeconds = jwtExpires.seconds;
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: expiresInSeconds,
    });

    const permissions = await this.getPermissionsByRole(user.idRole);
    return {
      accessToken,
      tokenType: "Bearer",
      expiresInSeconds,
      user: {
        idUser: user.idUser,
        fullName: user.fullName,
        email: user.email,
        role: user.role.roleName,
      },
      permissions,
    };
  }

  /**
   * Resuelve perfil mínimo para endpoint /auth/me.
   */
  async me(idUser: number): Promise<AuthSessionResponse["user"]> {
    const user = await this.prismaService.user.findUnique({
      where: { idUser },
      include: { role: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Sesión inválida.");
    }
    return {
      idUser: user.idUser,
      fullName: user.fullName,
      email: user.email,
      role: user.role.roleName,
    };
  }

  /**
   * Renueva token JWT para sesión vigente.
   */
  async renew(idUser: number): Promise<AuthSessionResponse> {
    const user = await this.prismaService.user.findUnique({
      where: { idUser },
      include: { role: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Sesión inválida.");
    }

    const payload: JwtPayload = {
      sub: user.idUser,
      email: user.email,
      role: user.role.roleName,
    };
    const jwtExpires = this.getJwtExpiresConfig();
    const expiresInSeconds = jwtExpires.seconds;
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: expiresInSeconds,
    });

    const permissions = await this.getPermissionsByRole(user.idRole);
    return {
      accessToken,
      tokenType: "Bearer",
      expiresInSeconds,
      user: {
        idUser: user.idUser,
        fullName: user.fullName,
        email: user.email,
        role: user.role.roleName,
      },
      permissions,
    };
  }

  /**
   * Cierra sesión revocando tokens emitidos hasta este momento.
   */
  async logout(idUser: number): Promise<void> {
    await this.prismaService.user.update({
      where: { idUser },
      data: { sessionRevokedAt: new Date() },
    });
  }

  private async getPermissionsByRole(idRole: number): Promise<AuthSessionResponse["permissions"]> {
    const rows = await this.prismaService.roleModulePermission.findMany({
      where: { idRole },
      include: { module: true },
      orderBy: { module: { moduleCode: "asc" } },
    });
    return rows.map((row) => ({
      moduleCode: row.module.moduleCode,
      canCreate: row.canCreate,
      canRead: row.canRead,
      canUpdate: row.canUpdate,
      canDelete: row.canDelete,
      canExport: row.canExport,
    }));
  }
}
