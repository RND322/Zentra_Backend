/**
 * Alta de usuario (panel administracion).
 */
export interface CreateUserDto {
  fullName: string;
  email: string;
  password: string;
  idRole: number;
  /** Si true, el usuario debe cambiar password al primer login. */
  mustChangePass?: boolean;
}
