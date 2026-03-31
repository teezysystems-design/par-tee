-- Add created_by_user_id to courses so analytics and availability routes
-- can enforce that only the course owner can access sensitive data.
-- Nullable so existing seeded courses are not broken.

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_courses_created_by ON courses(created_by_user_id);
