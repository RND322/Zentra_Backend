import { Controller, Get } from "@nestjs/common";
import { AuditService, type AuditLogResponse } from "./audit.service";

/**
 * Controlador de bitácora global.
 */
@Controller("audit-logs")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  findAll(): Promise<AuditLogResponse[]> {
    return this.auditService.findAll();
  }
}
