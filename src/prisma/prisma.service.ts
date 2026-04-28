import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

/**
 * Servicio único para acceso a Prisma en toda la app.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const databaseUrl = process.env["DATABASE_URL"];
    if (!databaseUrl || databaseUrl.trim().length === 0) {
      throw new Error("DATABASE_URL no está definida para PrismaService.");
    }
    const adapter = new PrismaMariaDb(databaseUrl);
    super({
      adapter,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
