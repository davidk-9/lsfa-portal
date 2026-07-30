-- CreateTable
CREATE TABLE "GNAFAddress" (
    "id" SERIAL NOT NULL,
    "addressDetailPid" TEXT NOT NULL,
    "addressLabel" TEXT NOT NULL,
    "streetName" TEXT,
    "streetType" TEXT,
    "localityName" TEXT,
    "state" TEXT,
    "postcode" TEXT,
    "longitude" DOUBLE PRECISION,
    "latitude" DOUBLE PRECISION,

    CONSTRAINT "GNAFAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GNAFAddress_addressDetailPid_key" ON "GNAFAddress"("addressDetailPid");

-- CreateIndex
CREATE INDEX "GNAFAddress_postcode_idx" ON "GNAFAddress"("postcode");

-- CreateIndex
CREATE INDEX "GNAFAddress_state_idx" ON "GNAFAddress"("state");
