/**
 * Actualizacion parcial de usuario.
 */
export interface UpdateUserDto {
  fullName?: string;
  email?: string;
  idRole?: number;
  /** Si viene no vacio, reemplaza password. */
  password?: string;
  isActive?: boolean;
}
