-- CreateTable
CREATE TABLE `roles` (
    `id_role` INTEGER NOT NULL AUTO_INCREMENT,
    `role_name` VARCHAR(100) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `roles_role_name_key`(`role_name`),
    PRIMARY KEY (`id_role`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `modules` (
    `id_module` INTEGER NOT NULL AUTO_INCREMENT,
    `module_code` VARCHAR(60) NOT NULL,
    `module_name` VARCHAR(100) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `modules_module_code_key`(`module_code`),
    PRIMARY KEY (`id_module`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_module_permissions` (
    `id_role` INTEGER NOT NULL,
    `id_module` INTEGER NOT NULL,
    `can_create` BOOLEAN NOT NULL DEFAULT false,
    `can_read` BOOLEAN NOT NULL DEFAULT false,
    `can_update` BOOLEAN NOT NULL DEFAULT false,
    `can_delete` BOOLEAN NOT NULL DEFAULT false,
    `can_export` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id_role`, `id_module`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `catalog_currencies` (
    `id_currency` INTEGER NOT NULL AUTO_INCREMENT,
    `currency_code` VARCHAR(10) NOT NULL,
    `currency_name` VARCHAR(120) NOT NULL,
    `currency_symbol` VARCHAR(10) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `catalog_currencies_currency_code_key`(`currency_code`),
    PRIMARY KEY (`id_currency`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `catalog_items` (
    `id_item` INTEGER NOT NULL AUTO_INCREMENT,
    `catalog_type` VARCHAR(60) NOT NULL,
    `item_name` VARCHAR(150) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_catalog_items_type`(`catalog_type`),
    UNIQUE INDEX `uq_catalog_type_name`(`catalog_type`, `item_name`),
    PRIMARY KEY (`id_item`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expense_records` (
    `id_expense` INTEGER NOT NULL AUTO_INCREMENT,
    `expense_number` VARCHAR(30) NOT NULL,
    `expense_date` DATETIME(3) NOT NULL,
    `vendor_name` VARCHAR(180) NOT NULL,
    `id_payment_type` INTEGER NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `id_business_line` INTEGER NOT NULL,
    `id_sub_line` INTEGER NULL,
    `observations` VARCHAR(400) NULL,
    `evidence_image_path` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `expense_records_expense_number_key`(`expense_number`),
    INDEX `idx_expenses_date`(`expense_date`),
    INDEX `idx_expenses_payment_type`(`id_payment_type`),
    INDEX `idx_expenses_business_line`(`id_business_line`),
    PRIMARY KEY (`id_expense`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id_user` INTEGER NOT NULL AUTO_INCREMENT,
    `full_name` VARCHAR(150) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `id_role` INTEGER NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `must_change_pass` BOOLEAN NOT NULL DEFAULT false,
    `session_revoked_at` DATETIME(3) NULL,
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id_user`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id_product` INTEGER NOT NULL AUTO_INCREMENT,
    `product_name` VARCHAR(100) NOT NULL,
    `base_unit` VARCHAR(20) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id_product`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `production_records` (
    `id_production` INTEGER NOT NULL AUTO_INCREMENT,
    `id_product` INTEGER NOT NULL,
    `quantity_base` INTEGER NOT NULL,
    `climate` VARCHAR(120) NOT NULL,
    `production_date` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_production_product`(`id_product`),
    INDEX `idx_production_date`(`production_date`),
    PRIMARY KEY (`id_production`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_prices` (
    `id_price` INTEGER NOT NULL AUTO_INCREMENT,
    `id_product` INTEGER NOT NULL,
    `unit_label` VARCHAR(30) NOT NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `valid_from` DATETIME(3) NOT NULL,
    `valid_to` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_product_prices_product`(`id_product`),
    PRIMARY KEY (`id_price`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory` (
    `id_inventory` INTEGER NOT NULL AUTO_INCREMENT,
    `id_product` INTEGER NOT NULL,
    `location_type` VARCHAR(20) NOT NULL,
    `id_user` INTEGER NULL,
    `stock` INTEGER NOT NULL DEFAULT 0,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_inventory_product_location`(`id_product`, `location_type`, `id_user`),
    PRIMARY KEY (`id_inventory`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_movements` (
    `id_movement` BIGINT NOT NULL AUTO_INCREMENT,
    `movement_type` VARCHAR(30) NOT NULL,
    `id_product` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `from_location` VARCHAR(120) NOT NULL,
    `to_location` VARCHAR(120) NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `id_performed_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_inventory_movements_product`(`id_product`),
    INDEX `idx_inventory_movements_created_at`(`created_at`),
    INDEX `idx_inventory_movements_performed_by`(`id_performed_by`),
    PRIMARY KEY (`id_movement`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales` (
    `id_sale` BIGINT NOT NULL AUTO_INCREMENT,
    `id_user` INTEGER NOT NULL,
    `id_customer` INTEGER NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `tax_isv` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `tax_iva` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(12, 2) NOT NULL,
    `is_credit` BOOLEAN NOT NULL DEFAULT false,
    `has_invoice` BOOLEAN NOT NULL DEFAULT false,
    `invoice_number` BIGINT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_sale_user`(`id_user`),
    INDEX `idx_sale_customer`(`id_customer`),
    PRIMARY KEY (`id_sale`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sale_details` (
    `id_sale_detail` BIGINT NOT NULL AUTO_INCREMENT,
    `id_sale` BIGINT NOT NULL,
    `id_product` INTEGER NOT NULL,
    `quantity_sale` DECIMAL(12, 2) NOT NULL,
    `quantity_base` DECIMAL(12, 2) NOT NULL,
    `unit_label` VARCHAR(30) NOT NULL,
    `conversion_factor` DECIMAL(12, 4) NOT NULL,
    `unit_price` DECIMAL(12, 2) NOT NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_sale_detail_sale`(`id_sale`),
    PRIMARY KEY (`id_sale_detail`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_settings` (
    `id_setting` INTEGER NOT NULL AUTO_INCREMENT,
    `setting_key` VARCHAR(120) NOT NULL,
    `setting_value` VARCHAR(600) NOT NULL,
    `value_type` VARCHAR(20) NOT NULL,
    `category` VARCHAR(100) NULL,
    `description` VARCHAR(255) NULL,
    `updated_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `system_settings_setting_key_key`(`setting_key`),
    PRIMARY KEY (`id_setting`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `smtp_settings` (
    `id_smtp_setting` INTEGER NOT NULL AUTO_INCREMENT,
    `smtp_host` VARCHAR(150) NOT NULL,
    `smtp_port` INTEGER NOT NULL DEFAULT 587,
    `smtp_user` VARCHAR(150) NOT NULL,
    `smtp_password_enc` TEXT NOT NULL,
    `smtp_encryption` VARCHAR(20) NOT NULL,
    `from_email` VARCHAR(150) NOT NULL,
    `from_name` VARCHAR(150) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `updated_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id_smtp_setting`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
    `id_customer` INTEGER NOT NULL AUTO_INCREMENT,
    `customer_name` VARCHAR(150) NOT NULL,
    `phone` VARCHAR(30) NULL,
    `email` VARCHAR(150) NULL,
    `address` VARCHAR(255) NULL,
    `id_place` INTEGER NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_customers_place`(`id_place`),
    PRIMARY KEY (`id_customer`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `credit_sales` (
    `id_credit_sale` BIGINT NOT NULL AUTO_INCREMENT,
    `id_sale` BIGINT NOT NULL,
    `id_customer` INTEGER NOT NULL,
    `due_date` DATETIME(3) NULL,
    `credit_total` DECIMAL(12, 2) NOT NULL,
    `paid_total` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `balance_total` DECIMAL(12, 2) NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `credit_sales_id_sale_key`(`id_sale`),
    PRIMARY KEY (`id_credit_sale`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `credit_payments` (
    `id_credit_payment` BIGINT NOT NULL AUTO_INCREMENT,
    `id_credit_sale` BIGINT NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `payment_date` DATETIME(3) NOT NULL,
    `note` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_credit_payments_credit_sale`(`id_credit_sale`),
    PRIMARY KEY (`id_credit_payment`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `role_module_permissions` ADD CONSTRAINT `role_module_permissions_id_role_fkey` FOREIGN KEY (`id_role`) REFERENCES `roles`(`id_role`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_module_permissions` ADD CONSTRAINT `role_module_permissions_id_module_fkey` FOREIGN KEY (`id_module`) REFERENCES `modules`(`id_module`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expense_records` ADD CONSTRAINT `expense_records_id_payment_type_fkey` FOREIGN KEY (`id_payment_type`) REFERENCES `catalog_items`(`id_item`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expense_records` ADD CONSTRAINT `expense_records_id_business_line_fkey` FOREIGN KEY (`id_business_line`) REFERENCES `catalog_items`(`id_item`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expense_records` ADD CONSTRAINT `expense_records_id_sub_line_fkey` FOREIGN KEY (`id_sub_line`) REFERENCES `catalog_items`(`id_item`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_id_role_fkey` FOREIGN KEY (`id_role`) REFERENCES `roles`(`id_role`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_records` ADD CONSTRAINT `production_records_id_product_fkey` FOREIGN KEY (`id_product`) REFERENCES `products`(`id_product`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_prices` ADD CONSTRAINT `product_prices_id_product_fkey` FOREIGN KEY (`id_product`) REFERENCES `products`(`id_product`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory` ADD CONSTRAINT `inventory_id_product_fkey` FOREIGN KEY (`id_product`) REFERENCES `products`(`id_product`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory` ADD CONSTRAINT `inventory_id_user_fkey` FOREIGN KEY (`id_user`) REFERENCES `users`(`id_user`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_id_product_fkey` FOREIGN KEY (`id_product`) REFERENCES `products`(`id_product`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_id_performed_by_fkey` FOREIGN KEY (`id_performed_by`) REFERENCES `users`(`id_user`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_id_user_fkey` FOREIGN KEY (`id_user`) REFERENCES `users`(`id_user`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_id_customer_fkey` FOREIGN KEY (`id_customer`) REFERENCES `customers`(`id_customer`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_details` ADD CONSTRAINT `sale_details_id_sale_fkey` FOREIGN KEY (`id_sale`) REFERENCES `sales`(`id_sale`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_details` ADD CONSTRAINT `sale_details_id_product_fkey` FOREIGN KEY (`id_product`) REFERENCES `products`(`id_product`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_settings` ADD CONSTRAINT `system_settings_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id_user`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `customers_id_place_fkey` FOREIGN KEY (`id_place`) REFERENCES `catalog_items`(`id_item`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `credit_sales` ADD CONSTRAINT `credit_sales_id_sale_fkey` FOREIGN KEY (`id_sale`) REFERENCES `sales`(`id_sale`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `credit_sales` ADD CONSTRAINT `credit_sales_id_customer_fkey` FOREIGN KEY (`id_customer`) REFERENCES `customers`(`id_customer`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `credit_payments` ADD CONSTRAINT `credit_payments_id_credit_sale_fkey` FOREIGN KEY (`id_credit_sale`) REFERENCES `credit_sales`(`id_credit_sale`) ON DELETE RESTRICT ON UPDATE CASCADE;
