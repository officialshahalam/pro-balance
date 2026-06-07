-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('BALANCE_SHEET', 'PROFIT_AND_LOSS');
CREATE TYPE "ReportStatus" AS ENUM ('PROJECTED', 'ACTUAL');
CREATE TYPE "ExpenseType" AS ENUM ('DIRECT', 'INDIRECT');

-- AlterTable: Add password_hash and unique email to User
ALTER TABLE "User" ADD COLUMN "password_hash" TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateTable: Client
CREATE TABLE "Client" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "firm_type" TEXT,
    "pan" TEXT,
    "gstin" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Client_user_id_idx" ON "Client"("user_id");

-- CreateTable: FinancialYear
CREATE TABLE "FinancialYear" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinancialYear_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FinancialYear_client_id_idx" ON "FinancialYear"("client_id");
CREATE UNIQUE INDEX "FinancialYear_client_id_label_key" ON "FinancialYear"("client_id", "label");

-- CreateTable: RevenueHead
CREATE TABLE "RevenueHead" (
    "id" SERIAL NOT NULL,
    "financial_year_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RevenueHead_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RevenueHead_financial_year_id_idx" ON "RevenueHead"("financial_year_id");

-- CreateTable: PurchaseInventory
CREATE TABLE "PurchaseInventory" (
    "id" SERIAL NOT NULL,
    "financial_year_id" INTEGER NOT NULL,
    "opening_stock" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "purchases" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "closing_stock" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PurchaseInventory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PurchaseInventory_financial_year_id_key" ON "PurchaseInventory"("financial_year_id");

-- CreateTable: ExpenseHead
CREATE TABLE "ExpenseHead" (
    "id" SERIAL NOT NULL,
    "financial_year_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "type" "ExpenseType" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExpenseHead_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ExpenseHead_financial_year_id_idx" ON "ExpenseHead"("financial_year_id");

-- CreateTable: FixedAsset
CREATE TABLE "FixedAsset" (
    "id" SERIAL NOT NULL,
    "financial_year_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "opening_wdv" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "additions" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "deletions" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "depreciation_rate" DECIMAL(5,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FixedAsset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FixedAsset_financial_year_id_idx" ON "FixedAsset"("financial_year_id");

-- CreateTable: CapitalAccount
CREATE TABLE "CapitalAccount" (
    "id" SERIAL NOT NULL,
    "financial_year_id" INTEGER NOT NULL,
    "opening_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "additions" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "drawings" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CapitalAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CapitalAccount_financial_year_id_key" ON "CapitalAccount"("financial_year_id");

-- CreateTable: Loan
CREATE TABLE "Loan" (
    "id" SERIAL NOT NULL,
    "financial_year_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "opening_balance" DECIMAL(15,2) NOT NULL,
    "interest_rate" DECIMAL(5,2) NOT NULL,
    "emi" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tenure_months" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Loan_financial_year_id_idx" ON "Loan"("financial_year_id");

-- CreateTable: CurrentLiability
CREATE TABLE "CurrentLiability" (
    "id" SERIAL NOT NULL,
    "financial_year_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CurrentLiability_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CurrentLiability_financial_year_id_idx" ON "CurrentLiability"("financial_year_id");

-- CreateTable: CurrentAsset
CREATE TABLE "CurrentAsset" (
    "id" SERIAL NOT NULL,
    "financial_year_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CurrentAsset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CurrentAsset_financial_year_id_idx" ON "CurrentAsset"("financial_year_id");

-- CreateTable: Report
CREATE TABLE "Report" (
    "id" SERIAL NOT NULL,
    "financial_year_id" INTEGER NOT NULL,
    "type" "ReportType" NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PROJECTED',
    "snapshot" JSONB NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalized_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Report_financial_year_id_idx" ON "Report"("financial_year_id");
CREATE INDEX "Report_financial_year_id_type_idx" ON "Report"("financial_year_id", "type");

-- AddForeignKeys
ALTER TABLE "Client" ADD CONSTRAINT "Client_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialYear" ADD CONSTRAINT "FinancialYear_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevenueHead" ADD CONSTRAINT "RevenueHead_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "FinancialYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseInventory" ADD CONSTRAINT "PurchaseInventory_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "FinancialYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpenseHead" ADD CONSTRAINT "ExpenseHead_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "FinancialYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "FinancialYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CapitalAccount" ADD CONSTRAINT "CapitalAccount_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "FinancialYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "FinancialYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CurrentLiability" ADD CONSTRAINT "CurrentLiability_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "FinancialYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CurrentAsset" ADD CONSTRAINT "CurrentAsset_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "FinancialYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "FinancialYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
