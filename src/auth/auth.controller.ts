import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { AuthService, type AuthSessionResponse } from "./auth.service";
import { CurrentUser } from "./decorators/current-user.decorator";
import type { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import type { AuthUser } from "./types/auth-user.type";

/**
 * Controlador de autenticación.
 */
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  login(@Body() payload: LoginDto): Promise<AuthSessionResponse> {
    return this.authService.login(payload);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async me(
    @CurrentUser() user: AuthUser,
  ): Promise<{ user: AuthSessionResponse["user"] }> {
    const profile = await this.authService.me(user.idUser);
    return { user: profile };
  }

  @UseGuards(JwtAuthGuard)
  @Post("renew")
  renew(@CurrentUser() user: AuthUser): Promise<AuthSessionResponse> {
    return this.authService.renew(user.idUser);
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  async logout(@CurrentUser() user: AuthUser): Promise<{ message: string }> {
    await this.authService.logout(user.idUser);
    return { message: "Sesión cerrada correctamente." };
  }
}
