/**
 * Usuario autenticado extraído del JWT.
 */
export interface AuthUser {
  idUser: number;
  email: string;
  role: string;
}
