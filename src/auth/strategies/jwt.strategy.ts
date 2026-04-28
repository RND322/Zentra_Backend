import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../types/auth-user.type";
import type { JwtPayload } from "../types/jwt-payload.type";

/**
 * Estrategia JWT para validar token Bearer.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prismaService: PrismaService) {
    const jwtSecret = process.env["JWT_SECRET"] ?? "zentra_dev_jwt_secret";
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prismaService.user.findUnique({
      where: { idUser: payload.sub },
      select: {
        idUser: true,
        email: true,
        isActive: true,
        sessionRevokedAt: true,
      },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Sesión inválida.");
    }
    if (user.sessionRevokedAt && payload.iat) {
      const tokenIssuedAtMs = payload.iat * 1000;
      if (tokenIssuedAtMs <= user.sessionRevokedAt.getTime()) {
        throw new UnauthorizedException("Sesión cerrada, vuelve a iniciar sesión.");
      }
    }
    return {
      idUser: user.idUser,
      email: user.email,
      role: payload.role,
    };
  }
}
