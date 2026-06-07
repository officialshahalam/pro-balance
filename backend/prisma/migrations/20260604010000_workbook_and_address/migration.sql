-- Split address into multiple fields
ALTER TABLE "Client" ADD COLUMN "address_line" TEXT;
ALTER TABLE "Client" ADD COLUMN "village" TEXT;
ALTER TABLE "Client" ADD COLUMN "post_office" TEXT;
ALTER TABLE "Client" ADD COLUMN "city" TEXT;
ALTER TABLE "Client" ADD COLUMN "state" TEXT;
ALTER TABLE "Client" ADD COLUMN "pin_code" TEXT;

-- Migrate existing address data to address_line
UPDATE "Client" SET "address_line" = "address" WHERE "address" IS NOT NULL;

-- Drop old address column
ALTER TABLE "Client" DROP COLUMN IF EXISTS "address";

-- Create WorkbookData table
CREATE TABLE "WorkbookData" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkbookData_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkbookData_client_id_key" ON "WorkbookData"("client_id");
ALTER TABLE "WorkbookData" ADD CONSTRAINT "WorkbookData_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
