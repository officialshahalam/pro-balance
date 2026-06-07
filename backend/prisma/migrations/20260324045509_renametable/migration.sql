/*
  Warnings:

  - You are about to drop the `Demo` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "Demo";

-- CreateTable
CREATE TABLE "Demo_Table" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Demo_Table_pkey" PRIMARY KEY ("id")
);
