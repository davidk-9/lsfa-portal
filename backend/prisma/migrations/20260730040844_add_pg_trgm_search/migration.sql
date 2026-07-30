-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateIndex
CREATE INDEX "GNAFAddress_addressLabel_idx" ON "GNAFAddress" USING GIN ("addressLabel" gin_trgm_ops);
