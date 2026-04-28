import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PermissionsService } from "./permissions.service";
import { JwtStrategy } from "./strategies/jwt.strategy";

/**
 * Módulo de autenticación y sesión JWT.
 */
@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.register({
      secret: process.env["JWT_SECRET"] ?? "zentra_dev_jwt_secret",
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, PermissionsService],
  exports: [AuthService, JwtModule, PassportModule, PermissionsService, JwtStrategy],
})
export class AuthModule {}
