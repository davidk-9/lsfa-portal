/*
  Warnings:

  - Added the required column `updatedAt` to the `WorkshopSnapshot` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "WorkshopSnapshot" ADD COLUMN "masterFingerprint" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
