-- CreateTable
CREATE TABLE "BulkSchedulerSchedule" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulkSchedulerSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkSchedulerScheduleItem" (
    "id" SERIAL NOT NULL,
    "scheduleId" INTEGER NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "locationId" TEXT,
    "locationName" TEXT,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "maxParticipants" INTEGER NOT NULL DEFAULT 0,
    "courseCode" TEXT NOT NULL,
    "trainerId" TEXT,
    "trainerName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulkSchedulerScheduleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkSchedulerRun" (
    "id" SERIAL NOT NULL,
    "scheduleId" INTEGER NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "totalExpected" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulkSchedulerRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BulkSchedulerScheduleItem_scheduleId_idx" ON "BulkSchedulerScheduleItem"("scheduleId");

-- CreateIndex
CREATE INDEX "BulkSchedulerScheduleItem_dayOfWeek_idx" ON "BulkSchedulerScheduleItem"("dayOfWeek");

-- CreateIndex
CREATE INDEX "BulkSchedulerRun_scheduleId_idx" ON "BulkSchedulerRun"("scheduleId");

-- CreateIndex
CREATE INDEX "BulkSchedulerRun_status_idx" ON "BulkSchedulerRun"("status");

-- AddForeignKey
ALTER TABLE "BulkSchedulerScheduleItem" ADD CONSTRAINT "BulkSchedulerScheduleItem_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "BulkSchedulerSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkSchedulerRun" ADD CONSTRAINT "BulkSchedulerRun_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "BulkSchedulerSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
