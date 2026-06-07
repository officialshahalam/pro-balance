-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "StatementType" AS ENUM ('BALANCE_SHEET', 'PROFIT_LOSS');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "FinancialStatement" (
    "id" SERIAL NOT NULL,
    "financial_year_id" INTEGER NOT NULL,
    "type" "StatementType" NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinancialStatement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FinancialStatement_financial_year_id_type_key" ON "FinancialStatement"("financial_year_id", "type");
ALTER TABLE "FinancialStatement" ADD CONSTRAINT "FinancialStatement_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "FinancialYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Annexure" (
    "id" SERIAL NOT NULL,
    "financial_year_id" INTEGER NOT NULL,
    "ref_code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ann_type" TEXT NOT NULL DEFAULT 'key_value',
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Annexure_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Annexure_financial_year_id_ref_code_key" ON "Annexure"("financial_year_id", "ref_code");
CREATE INDEX IF NOT EXISTS "Annexure_financial_year_id_idx" ON "Annexure"("financial_year_id");
ALTER TABLE "Annexure" ADD CONSTRAINT "Annexure_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "FinancialYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
