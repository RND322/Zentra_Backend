import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { existsSync, mkdirSync } from "node:fs";
import { extname, join } from "node:path";
import type { Express } from "express";
import type { Request } from "express";
import type { CreateExpenseDto } from "./dto/create-expense.dto";
import {
  type CatalogRowResponse,
  type ExpenseResponse,
  ExpensesService,
} from "./expenses.service";

/**
 * Controlador de gastos operativos.
 */
@Controller("expenses")
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  findAll(): Promise<ExpenseResponse[]> {
    return this.expensesService.findAll();
  }

  @Get("payment-types")
  listPaymentTypes(): Promise<CatalogRowResponse[]> {
    return this.expensesService.listPaymentTypes();
  }

  @Get("business-lines")
  listBusinessLines(): Promise<CatalogRowResponse[]> {
    return this.expensesService.listBusinessLines();
  }

  @Get("business-lines/:idBusinessLine/sub-lines")
  listSubLinesByBusinessLine(
    @Param("idBusinessLine") idBusinessLine: string,
  ): Promise<CatalogRowResponse[]> {
    return this.expensesService.listSubLinesByBusinessLine(Number(idBusinessLine));
  }

  @Post()
  @UseInterceptors(
    FileInterceptor("evidenceImage", {
      storage: diskStorage({
        destination: (
          _req: Request,
          _file: Express.Multer.File,
          callback: (error: Error | null, destination: string) => void,
        ) => {
          const targetDir = join(process.cwd(), "uploads", "expenses");
          if (!existsSync(targetDir)) {
            mkdirSync(targetDir, { recursive: true });
          }
          callback(null, targetDir);
        },
        filename: (
          _req: Request,
          file: Express.Multer.File,
          callback: (error: Error | null, filename: string) => void,
        ) => {
          const safeExt = extname(file.originalname).toLowerCase();
          const timestamp = Date.now();
          const randomSuffix = Math.round(Math.random() * 1_000_000);
          callback(null, `expense-${String(timestamp)}-${String(randomSuffix)}${safeExt}`);
        },
      }),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.startsWith("image/")) {
          callback(new Error("Solo se permiten imágenes como evidencia."), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  create(
    @Body() payload: CreateExpenseDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<ExpenseResponse> {
    const evidenceImagePath = file ? `/uploads/expenses/${file.filename}` : null;
    return this.expensesService.create(payload, evidenceImagePath);
  }
}
