import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { hash } from "bcryptjs";
import type { User, Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateUserDto } from "./dto/create-user.dto";
import type { UpdateUserDto } from "./dto/update-user.dto";

const PASSWORD_MIN_LENGTH = 8;
const BCRYPT_ROUNDS = 10;

export interface UserAdminResponse {
  idUser: number;
  fullName: string;
  email: string;
  idRole: number;
  roleName: string;
  isActive: boolean;
  mustChangePass: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface RoleOptionResponse {
  idRole: number;
  roleName: string;
  isActive: boolean;
}

type UserWithRole = User & { role: Role };

/**
 * Administracion de usuarios (solo permisos modulo settings).
 */
@Injectable()
export class UsersService {
  constructor(private readonly prismaService: PrismaService) {}

  async listRoles(): Promise<RoleOptionResponse[]> {
    const rows = await this.prismaService.role.findMany({
      where: { isActive: true },
      orderBy: { roleName: "asc" },
    });
    return rows.map((r) => ({
      idRole: r.idRole,
      roleName: r.roleName,
      isActive: r.isActive,
    }));
  }

  async findAll(): Promise<UserAdminResponse[]> {
    const rows = await this.prismaService.user.findMany({
      include: { role: true },
      orderBy: { fullName: "asc" },
    });
    return rows.map((row) => this.mapUser(row));
  }

  async create(input: CreateUserDto): Promise<UserAdminResponse> {
    const email = input.email.trim().toLowerCase();
    const fullName = input.fullName.trim();
    if (fullName.length < 2) {
      throw new BadRequestException("El nombre debe tener al menos 2 caracteres.");
    }
    if (email.length < 5 || !email.includes("@")) {
      throw new BadRequestException("Email invalido.");
    }
    if (input.password.length < PASSWORD_MIN_LENGTH) {
      throw new BadRequestException(
        `La contrasena debe tener al menos ${String(PASSWORD_MIN_LENGTH)} caracteres.`,
      );
    }

    const role = await this.prismaService.role.findFirst({
      where: { idRole: input.idRole, isActive: true },
    });
    if (!role) {
      throw new BadRequestException("Rol invalido.");
    }

    const exists = await this.prismaService.user.findUnique({ where: { email } });
    if (exists) {
      throw new ConflictException("Ya existe un usuario con ese email.");
    }

    const passwordHash = await hash(input.password, BCRYPT_ROUNDS);
    const row = await this.prismaService.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        idRole: input.idRole,
        isActive: true,
        mustChangePass: input.mustChangePass ?? true,
      },
      include: { role: true },
    });
    return this.mapUser(row);
  }

  async update(
    idUser: number,
    input: UpdateUserDto,
    actorIdUser: number,
  ): Promise<UserAdminResponse> {
    const existing = await this.prismaService.user.findUnique({
      where: { idUser },
      include: { role: true },
    });
    if (!existing) {
      throw new NotFoundException("Usuario no encontrado.");
    }

    let fullName = existing.fullName;
    if (input.fullName !== undefined) {
      fullName = input.fullName.trim();
      if (fullName.length < 2) {
        throw new BadRequestException("El nombre debe tener al menos 2 caracteres.");
      }
    }

    let email = existing.email;
    if (input.email !== undefined) {
      email = input.email.trim().toLowerCase();
      if (email.length < 5 || !email.includes("@")) {
        throw new BadRequestException("Email invalido.");
      }
      if (email !== existing.email) {
        const taken = await this.prismaService.user.findUnique({ where: { email } });
        if (taken) {
          throw new ConflictException("Ya existe un usuario con ese email.");
        }
      }
    }

    let idRole = existing.idRole;
    if (input.idRole !== undefined) {
      const role = await this.prismaService.role.findFirst({
        where: { idRole: input.idRole, isActive: true },
      });
      if (!role) {
        throw new BadRequestException("Rol invalido.");
      }
      idRole = input.idRole;
    }

    let passwordHash = existing.passwordHash;
    if (input.password !== undefined && input.password.trim().length > 0) {
      if (input.password.length < PASSWORD_MIN_LENGTH) {
        throw new BadRequestException(
          `La contrasena debe tener al menos ${String(PASSWORD_MIN_LENGTH)} caracteres.`,
        );
      }
      passwordHash = await hash(input.password, BCRYPT_ROUNDS);
    }

    let isActive = existing.isActive;
    if (input.isActive !== undefined) {
      if (input.isActive === false && idUser === actorIdUser) {
        throw new BadRequestException("No puedes desactivar tu propia cuenta desde aqui.");
      }
      isActive = input.isActive;
    }

    const sessionRevokedAt =
      input.isActive === false
        ? new Date()
        : input.isActive === true
          ? null
          : undefined;

    const row = await this.prismaService.user.update({
      where: { idUser },
      data: {
        fullName,
        email,
        idRole,
        passwordHash,
        isActive,
        ...(sessionRevokedAt !== undefined ? { sessionRevokedAt } : {}),
      },
      include: { role: true },
    });
    return this.mapUser(row);
  }

  private mapUser(row: UserWithRole): UserAdminResponse {
    return {
      idUser: row.idUser,
      fullName: row.fullName,
      email: row.email,
      idRole: row.idRole,
      roleName: row.role.roleName,
      isActive: row.isActive,
      mustChangePass: row.mustChangePass,
      lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
