/*
  Warnings:

  - You are about to drop the column `userId` on the `Contact` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[contactId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Contact" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "contactId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "User_contactId_key" ON "User"("contactId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
