-- Allow greeting_standard to be null during setup (greeting is set in assistant step, not business step)
ALTER TABLE tenants ALTER COLUMN greeting_standard DROP NOT NULL;
