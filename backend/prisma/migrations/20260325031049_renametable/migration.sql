/*
  Warnings:

  - You are about to drop the `Demo_Table` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "Demo_Table";

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
