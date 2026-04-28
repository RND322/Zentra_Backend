import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import * as express from "express";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const normalizeOrigin = (origin: string) => origin.trim().replace(/\/+$/, "");
  const allowedOrigins = (process.env.FRONTEND_URL ?? process.env.CORS_ORIGIN ?? "")
    .split(",")
    .map(normalizeOrigin)
    .filter((origin) => origin.length > 0);

  app.enableCors({
    origin:
      allowedOrigins.length > 0
        ? (
            requestOrigin: string | undefined,
            callback: (err: Error | null, allow?: boolean) => void,
          ) => {
            // Browser sends origin without trailing slash; normalize both sides.
            if (!requestOrigin) {
              callback(null, true);
              return;
            }

            const isAllowed = allowedOrigins.includes(normalizeOrigin(requestOrigin));
            callback(isAllowed ? null : new Error("Not allowed by CORS"), isAllowed);
          }
        : true,
    credentials: true,
  });

  const uploadsDir = join(process.cwd(), "uploads");
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }
  app.use("/uploads", express.static(uploadsDir));
  await app.listen(process.env.PORT ?? 3000, "0.0.0.0");
}
bootstrap();
