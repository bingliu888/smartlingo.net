-- The 21-day campaign was simplified before day one to one Chinese-interface
-- learner. This deletes only the never-used, system-managed `.invalid` QA
-- identity; foreign-key cascades remove its synthetic memberships and trials.
DELETE FROM users WHERE id='smartlingo-qa-21d-en'
  AND email='smartlingo-qa-21d-en@smartlingo.invalid'
  AND password_hash='system-managed-disabled';

