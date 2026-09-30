-- =====================================================================
--  Ridexd.com — MySQL schema (Hostinger / cPanel / phpMyAdmin)
--  Import this file in phpMyAdmin (Import tab) to create all tables.
--  Mirrors src/db/schema.ts (PostgreSQL) 1:1.
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `categories` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `group_slug`  VARCHAR(40)  NOT NULL,
  `parent_slug` VARCHAR(80)  NOT NULL DEFAULT '',
  `slug`        VARCHAR(80)  NOT NULL,
  `name`        VARCHAR(120) NOT NULL,
  `tagline`     VARCHAR(200) NOT NULL DEFAULT '',
  `description` TEXT         NULL,
  `image_url`   TEXT         NULL,
  `sort_order`  INT          NOT NULL DEFAULT 0,
  `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_categories_group_slug` (`group_slug`, `slug`),
  KEY `idx_categories_group` (`group_slug`),
  KEY `idx_categories_parent` (`parent_slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `products` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `slug`             VARCHAR(140) NOT NULL UNIQUE,
  `title`            VARCHAR(200) NOT NULL,
  `subtitle`         VARCHAR(200) NOT NULL DEFAULT '',
  `description`      TEXT         NULL,
  `group_slug`       VARCHAR(40)  NOT NULL,
  `category_slug`    VARCHAR(80)  NOT NULL,
  `subcategory_slug` VARCHAR(80)  NOT NULL DEFAULT '',
  `price`            INT          NOT NULL DEFAULT 0,
  `compare_at_price` INT          NOT NULL DEFAULT 0,
  `cost`             INT          NOT NULL DEFAULT 0,
  `sku`              VARCHAR(60)  NOT NULL DEFAULT '',
  `barcode`          VARCHAR(60)  NOT NULL DEFAULT '',
  `stock`            INT          NOT NULL DEFAULT 0,
  `sizes`            JSON         NOT NULL,
  `images`           JSON         NOT NULL,
  `fabric`           VARCHAR(120) NOT NULL DEFAULT '',
  `color_family`     VARCHAR(60)  NOT NULL DEFAULT '',
  `status`           VARCHAR(20)  NOT NULL DEFAULT 'active',
  `featured`         TINYINT(1)   NOT NULL DEFAULT 0,
  `vendor`           VARCHAR(80)  NOT NULL DEFAULT 'Ridexd',
  `created_at`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_products_group` (`group_slug`),
  KEY `idx_products_category` (`category_slug`),
  KEY `idx_products_subcategory` (`subcategory_slug`),
  KEY `idx_products_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `orders` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `order_number`   VARCHAR(40)  NOT NULL UNIQUE,
  `customer_name`  VARCHAR(140) NOT NULL,
  `email`          VARCHAR(160) NOT NULL,
  `phone`          VARCHAR(40)  NOT NULL DEFAULT '',
  `address`        TEXT         NULL,
  `city`           VARCHAR(80)  NOT NULL DEFAULT '',
  `postal_code`    VARCHAR(30)  NOT NULL DEFAULT '',
  `notes`          TEXT         NULL,
  `payment_method` VARCHAR(40)  NOT NULL DEFAULT 'cod',
  `subtotal`       INT          NOT NULL DEFAULT 0,
  `shipping`       INT          NOT NULL DEFAULT 0,
  `total`          INT          NOT NULL DEFAULT 0,
  `status`         VARCHAR(24)  NOT NULL DEFAULT 'pending',
  `created_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_orders_status` (`status`),
  KEY `idx_orders_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `order_items` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `order_id`   INT          NOT NULL,
  `product_id` INT          NOT NULL,
  `title`      VARCHAR(200) NOT NULL,
  `variant`    VARCHAR(60)  NOT NULL DEFAULT '',
  `image_url`  TEXT         NULL,
  `unit_price` INT          NOT NULL DEFAULT 0,
  `quantity`   INT          NOT NULL DEFAULT 1,
  `line_total` INT          NOT NULL DEFAULT 0,
  KEY `idx_items_order` (`order_id`),
  CONSTRAINT `fk_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `contact_messages` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `name`       VARCHAR(140) NOT NULL,
  `email`      VARCHAR(160) NOT NULL,
  `phone`      VARCHAR(40)  NOT NULL,
  `message`    TEXT         NOT NULL,
  `is_read`    TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_contact_messages_read` (`is_read`),
  KEY `idx_contact_messages_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `product_reviews` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `product_id`     INT          NOT NULL,
  `customer_name`  VARCHAR(140) NOT NULL,
  `customer_email` VARCHAR(160) NOT NULL,
  `rating`         INT          NOT NULL,
  `comment`        TEXT         NOT NULL,
  `status`         VARCHAR(20)  NOT NULL DEFAULT 'approved',
  `created_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_product_reviews_product_customer` (`product_id`, `customer_email`),
  KEY `idx_product_reviews_product` (`product_id`),
  KEY `idx_product_reviews_status` (`status`),
  KEY `idx_product_reviews_customer` (`customer_email`),
  CONSTRAINT `fk_reviews_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admin_settings` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `setting_key`   VARCHAR(80)  NOT NULL UNIQUE,
  `setting_value` TEXT         NOT NULL,
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_admin_settings_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;


-- ---------------------------------------------------------------------
--  Handy demo order (optional):
--  INSERT INTO `orders`
--    (`order_number`,`customer_name`,`email`,`phone`,`address`,`city`,`postal_code`,
--     `payment_method`,`subtotal`,`shipping`,`total`,`status`)
--  VALUES
--    ('RDDEMO01','Ayesha Khan','ayesha@example.com','03001234567',
--     'House 12, Street 4, Gulberg III','Lahore','54000','cod',6450,0,6450,'confirmed');
-- ---------------------------------------------------------------------
