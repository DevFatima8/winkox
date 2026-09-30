import { sql } from "drizzle-orm";
/**
 * Ridexd.com — Drizzle MySQL schema (for Hostinger deployment)
 * ------------------------------------------------------------------
 * This is a 1:1 drop-in replacement for `src/db/schema.ts`.
 *
 * To switch the app from PostgreSQL (sandbox preview) to MySQL:
 *
 *   1. npm install mysql2
 *   2. copy this file over src/db/schema.ts
 *   3. replace src/db/index.ts with:
 *
 *        import { drizzle } from "drizzle-orm/mysql2";
 *        import mysql from "mysql2/promise";
 *
 *        const pool = mysql.createPool(process.env.DATABASE_URL!);
 *        export const db = drizzle(pool);
 *
 *   4. set DATABASE_URL in .env, e.g.
 *        mysql://u123456789_user:Password@127.0.0.1:3306/u123456789_ridexd
 *   5. npx drizzle-kit push   (or import mysql/schema.sql in phpMyAdmin)
 *
 * Everything else in the app (queries, admin CRUD, storefront) stays the same.
 */
import {
  boolean,
  datetime,
  index,
  int,
  json,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const categories = mysqlTable(
  "categories",
  {
  id: int("id").autoincrement().primaryKey(),
  groupSlug: varchar("group_slug", { length: 40 }).notNull(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  tagline: varchar("tagline", { length: 200 }).notNull().default(""),
  description: text("description").notNull().default(""),
  imageUrl: text("image_url").notNull().default(""),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: datetime("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("uniq_categories_group_slug").on(table.groupSlug, table.slug)],
);

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 140 }).notNull().unique(),
  title: varchar("title", { length: 200 }).notNull(),
  subtitle: varchar("subtitle", { length: 200 }).notNull().default(""),
  description: text("description").notNull().default(""),
  groupSlug: varchar("group_slug", { length: 40 }).notNull(),
  categorySlug: varchar("category_slug", { length: 80 }).notNull(),
  price: int("price").notNull().default(0),
  compareAtPrice: int("compare_at_price").notNull().default(0),
  cost: int("cost").notNull().default(0),
  sku: varchar("sku", { length: 60 }).notNull().default(""),
  barcode: varchar("barcode", { length: 60 }).notNull().default(""),
  stock: int("stock").notNull().default(0),
  sizes: json("sizes").$type<string[]>().notNull(),
  images: json("images").$type<string[]>().notNull(),
  fabric: varchar("fabric", { length: 120 }).notNull().default(""),
  colorFamily: varchar("color_family", { length: 60 }).notNull().default(""),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  featured: boolean("featured").notNull().default(false),
  vendor: varchar("vendor", { length: 80 }).notNull().default("Ridexd"),
  createdAt: datetime("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  orderNumber: varchar("order_number", { length: 40 }).notNull().unique(),
  customerName: varchar("customer_name", { length: 140 }).notNull(),
  email: varchar("email", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull().default(""),
  address: text("address").notNull().default(""),
  city: varchar("city", { length: 80 }).notNull().default(""),
  postalCode: varchar("postal_code", { length: 30 }).notNull().default(""),
  notes: text("notes").notNull().default(""),
  paymentMethod: varchar("payment_method", { length: 40 }).notNull().default("cod"),
  subtotal: int("subtotal").notNull().default(0),
  shipping: int("shipping").notNull().default(0),
  total: int("total").notNull().default(0),
  status: varchar("status", { length: 24 }).notNull().default("pending"),
  createdAt: datetime("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("order_id").notNull(),
  productId: int("product_id").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  variant: varchar("variant", { length: 60 }).notNull().default(""),
  imageUrl: text("image_url").notNull().default(""),
  unitPrice: int("unit_price").notNull().default(0),
  quantity: int("quantity").notNull().default(1),
  lineTotal: int("line_total").notNull().default(0),
});
