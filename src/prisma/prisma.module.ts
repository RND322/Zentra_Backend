import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

/**
 * Módulo global para inyección del cliente Prisma.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
