-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "proprietor_name" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "ca_firm_name" TEXT,
ADD COLUMN     "ca_place" TEXT,
ADD COLUMN     "ca_registration_number" TEXT,
ALTER COLUMN "password_hash" DROP DEFAULT;
