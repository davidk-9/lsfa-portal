-- Standardize the trainer Axcelerate contact id on a string type.
-- WorkshopProgress.trainerContactId changes from INTEGER to TEXT so it matches
-- User.axcelerateContactId (String) and the JWT impersonatingAxcelerateContactId (string).
ALTER TABLE "WorkshopProgress"
    ALTER COLUMN "trainerContactId" DROP DEFAULT,
    ALTER COLUMN "trainerContactId" SET DATA TYPE TEXT USING "trainerContactId"::text,
    ALTER COLUMN "trainerContactId" SET DEFAULT '';
