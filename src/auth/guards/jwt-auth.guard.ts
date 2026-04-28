import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Guard de autenticación JWT para rutas protegidas.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}
