import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type PermissionAction = "create" | "read" | "update" | "delete" | "export";

/**
 * Valida permisos RBAC por modulo segun rol del usuario.
 */
@Injectable()
export class PermissionsService {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Lanza si el usuario no tiene el permiso solicitado en el modulo.
   */
  async assertModulePermission(
    idUser: number,
    moduleCode: string,
    action: PermissionAction,
  ): Promise<void> {
    const user = await this.prismaService.user.findUnique({
      where: { idUser },
      include: {
        role: {
          include: {
            modulePermissions: {
              include: {
                module: true,
              },
            },
          },
        },
      },
    });
    if (!user || !user.isActive) {
      throw new ForbiddenException("Usuario no autorizado.");
    }
    const row = user.role.modulePermissions.find(
      (permission) => permission.module.moduleCode === moduleCode,
    );
    if (!row) {
      throw new ForbiddenException(`Sin acceso al modulo ${moduleCode}.`);
    }
    const allowed =
      (action === "create" && row.canCreate) ||
      (action === "read" && row.canRead) ||
      (action === "update" && row.canUpdate) ||
      (action === "delete" && row.canDelete) ||
      (action === "export" && row.canExport);
    if (!allowed) {
      throw new ForbiddenException("Permiso insuficiente para esta operacion.");
    }
  }
}
