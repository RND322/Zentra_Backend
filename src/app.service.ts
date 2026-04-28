import { Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";

export interface HealthResponse {
  status: "ok" | "degraded";
  service: string;
  database: "up" | "down";
  timestamp: string;
}

@Injectable()
export class AppService {
  constructor(private readonly prismaService: PrismaService) {}

  async getHealth(): Promise<HealthResponse> {
    try {
      await this.prismaService.$queryRaw`SELECT 1`;
      return {
        status: "ok",
        service: "zentra-backend",
        database: "up",
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        status: "degraded",
        service: "zentra-backend",
        database: "down",
        timestamp: new Date().toISOString(),
      };
    }
  }
}
