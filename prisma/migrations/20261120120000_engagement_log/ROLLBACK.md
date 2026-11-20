# Rollback: 20261120120000_engagement_log

The repo has no down-migrations (Prisma does not run them), so this is the manual reverse.
The migration only ADDS one table; nothing else depends on it, so rolling back loses only
the hand-typed engagement log (export it first if you want it: `/admin/dashboard/engagement?format=json`).

1. Deploy the previous app build first (the new admin page is the only code that reads the table).
2. Run against the database (after a backup), in one transaction:

```sql
BEGIN;
DROP TABLE "EngagementLog";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20261120120000_engagement_log';
COMMIT;
```

Never edit this folder's `migration.sql` after it has been applied anywhere.
