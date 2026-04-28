import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { CustomersModule } from "./customers/customers.module";
import { ExpensesModule } from "./expenses/expenses.module";
import { InventoryModule } from "./inventory/inventory.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProductsModule } from "./products/products.module";
import { ProductionModule } from "./production/production.module";
import { SalesModule } from "./sales/sales.module";
import { SettingsModule } from "./settings/settings.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    AuthModule,
    AuditModule,
    PrismaModule,
    SalesModule,
    ProductsModule,
    InventoryModule,
    CustomersModule,
    ExpensesModule,
    SettingsModule,
    ProductionModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
