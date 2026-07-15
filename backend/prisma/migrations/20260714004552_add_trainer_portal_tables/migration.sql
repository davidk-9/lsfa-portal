-- CreateTable
CREATE TABLE "WorkshopProgress" (
    "id" SERIAL NOT NULL,
    "instanceId" INTEGER NOT NULL,
    "trainerContactId" INTEGER NOT NULL DEFAULT 0,
    "completedSteps" INTEGER NOT NULL DEFAULT 0,
    "totalSteps" INTEGER NOT NULL DEFAULT 3,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "statusPayload" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentChecklist" (
    "id" SERIAL NOT NULL,
    "instanceId" INTEGER NOT NULL,
    "contactId" INTEGER NOT NULL,
    "courseCode" TEXT NOT NULL DEFAULT '',
    "data" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopSnapshot" (
    "id" SERIAL NOT NULL,
    "instanceId" INTEGER NOT NULL,
    "courseCode" TEXT NOT NULL,
    "snapshotData" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkshopSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopUpload" (
    "id" SERIAL NOT NULL,
    "instanceId" INTEGER NOT NULL,
    "contactId" INTEGER,
    "portfolioTypeId" INTEGER,
    "blobPath" TEXT NOT NULL DEFAULT '',
    "blobUrl" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT '',
    "filename" TEXT NOT NULL DEFAULT '',
    "mimeType" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "proxyKey" TEXT,
    "axceleratePortfolioId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopProgress_instanceId_key" ON "WorkshopProgress"("instanceId");

-- CreateIndex
CREATE INDEX "WorkshopProgress_isComplete_idx" ON "WorkshopProgress"("isComplete");

-- CreateIndex
CREATE INDEX "WorkshopProgress_trainerContactId_idx" ON "WorkshopProgress"("trainerContactId");

-- CreateIndex
CREATE INDEX "StudentChecklist_instanceId_idx" ON "StudentChecklist"("instanceId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentChecklist_instanceId_contactId_key" ON "StudentChecklist"("instanceId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopSnapshot_instanceId_courseCode_key" ON "WorkshopSnapshot"("instanceId", "courseCode");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopUpload_proxyKey_key" ON "WorkshopUpload"("proxyKey");

-- CreateIndex
CREATE INDEX "WorkshopUpload_instanceId_idx" ON "WorkshopUpload"("instanceId");

-- CreateIndex
CREATE INDEX "WorkshopUpload_instanceId_contactId_idx" ON "WorkshopUpload"("instanceId", "contactId");
