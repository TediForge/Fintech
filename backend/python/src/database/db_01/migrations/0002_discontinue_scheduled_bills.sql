-- Scheduled bill purchases have been discontinued.
-- This removes schedules and their pending run history; immediate bill
-- purchases remain supported.
DROP TABLE IF EXISTS "scheduledBills" CASCADE;
