-- Role links are removed by the cascade.
DELETE FROM "permissions" WHERE "name" = 'analytics.view';
