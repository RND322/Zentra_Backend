/**
 * Carga útil para actualizar permisos RBAC por rol/módulo.
 */
export interface UpdateRoleModulePermissionDto {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canExport: boolean;
}
