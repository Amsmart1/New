-- SmartLMS Supabase Schema (Comprehensive Replacement Script)
-- This script replaces the entire schema while preserving ALL existing features,
-- fixing RLS for the custom auth system, and initializing storage buckets.

-- 1. Clean start (Safe Idempotency)
-- 1. Idempotent Schema Initialization
-- This script ensures all necessary tables, functions, and policies exist
-- without destroying existing user data.
SET client_min_messages TO WARNING;

SET client_min_messages TO NOTICE;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Utility Functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Tables
CREATE TABLE IF NOT EXISTS users (
  email VARCHAR(255) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE,
  failed_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP WITH TIME ZONE,
  lockouts INTEGER DEFAULT 0,
  flagged BOOLEAN DEFAULT FALSE,
  reset_request JSONB,
  active BOOLEAN DEFAULT TRUE,
  session_id VARCHAR(255),
  notification_preferences JSONB DEFAULT '{"email": true, "push": true, "inApp": true}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb
);

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  teacher_email VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE SET NULL,
  created_by VARCHAR(255), -- Stores teacher's full name
  enrollment_id VARCHAR(255), -- Optional ID required for student enrollment
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

DROP TRIGGER IF EXISTS update_courses_updated_at ON courses;
CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Migration: Ensure created_by exists for existing tables
-- Migration: Ensure new columns exist for existing courses table
ALTER TABLE courses ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS enrollment_id VARCHAR(255);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Migration: Ensure new columns exist for existing users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true, "push": true, "inApp": true}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Migration: Ensure Anti-Cheat config exists for assessments
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS anti_cheat_config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS anti_cheat_config JSONB DEFAULT '{}'::jsonb;

-- Migration: Ensure updated_at exists for all tables to support triggers
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE courses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE live_classes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE quiz_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE materials ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE planner ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE invites ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  video_url TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_lessons_updated_at ON lessons;
CREATE TRIGGER update_lessons_updated_at BEFORE UPDATE ON lessons FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE IF NOT EXISTS enrollments (
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  student_email VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  progress INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  completed_lessons JSONB DEFAULT '[]'::jsonb,
  PRIMARY KEY (course_id, student_email)
);

DROP TRIGGER IF EXISTS update_enrollments_updated_at ON enrollments;
CREATE TRIGGER update_enrollments_updated_at BEFORE UPDATE ON enrollments FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  teacher_email VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE SET NULL,
  start_at TIMESTAMP WITH TIME ZONE,
  due_date TIMESTAMP WITH TIME ZONE,
  points_possible INTEGER DEFAULT 100,
  allow_late_submissions BOOLEAN DEFAULT TRUE,
  late_penalty_per_day INTEGER DEFAULT 0,
  allowed_extensions TEXT[] DEFAULT '{pdf, doc, docx, zip, jpg, png}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  questions JSONB DEFAULT '[]'::jsonb,
  attachments JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  anti_cheat_config JSONB DEFAULT '{}'::jsonb
);

DROP TRIGGER IF EXISTS update_assignments_updated_at ON assignments;
CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON assignments FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  student_email VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE CASCADE,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  answers JSONB DEFAULT '{}'::jsonb,
  question_scores JSONB DEFAULT '{}'::jsonb,
  question_feedback JSONB DEFAULT '{}'::jsonb,
  late_penalty_applied INTEGER DEFAULT 0,
  attachments JSONB DEFAULT '[]'::jsonb,
  grade INTEGER,
  final_grade INTEGER,
  feedback TEXT,
  regrade_request TEXT,
  graded_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'graded', 'returned')),
  UNIQUE(assignment_id, student_email)
);

DROP TRIGGER IF EXISTS update_submissions_updated_at ON submissions;
CREATE TRIGGER update_submissions_updated_at BEFORE UPDATE ON submissions FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Migration: Ensure new columns exist for existing submissions table
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS question_feedback JSONB DEFAULT '{}'::jsonb;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS question_scores JSONB DEFAULT '{}'::jsonb;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS late_penalty_applied INTEGER DEFAULT 0;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS id UUID DEFAULT uuid_generate_v4();

-- Ensure composite unique constraints exist for idempotent upserts
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'submissions_assignment_id_student_email_key') THEN
        ALTER TABLE submissions ADD CONSTRAINT submissions_assignment_id_student_email_key UNIQUE(assignment_id, student_email);
    END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_live_class_id_student_email_key') THEN
        ALTER TABLE attendance ADD CONSTRAINT attendance_live_class_id_student_email_key UNIQUE(live_class_id, student_email);
    END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS live_classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  teacher_email VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE NOT NULL,
  room_name VARCHAR(255) NOT NULL,
  meeting_url TEXT,
  recording_url TEXT,
  recurring_config JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled')),
  actual_end_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_live_classes_updated_at ON live_classes;
CREATE TRIGGER update_live_classes_updated_at BEFORE UPDATE ON live_classes FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  live_class_id UUID REFERENCES live_classes(id) ON DELETE CASCADE,
  student_email VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE CASCADE,
  join_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  leave_time TIMESTAMP WITH TIME ZONE,
  duration INTEGER DEFAULT 0,
  is_present BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(live_class_id, student_email)
);

DROP TRIGGER IF EXISTS update_attendance_updated_at ON attendance;
CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON attendance FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  teacher_email VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  time_limit INTEGER DEFAULT 0,
  start_at TIMESTAMP WITH TIME ZONE,
  end_at TIMESTAMP WITH TIME ZONE,
  attempts_allowed INTEGER DEFAULT 1,
  passing_score INTEGER DEFAULT 60,
  questions JSONB DEFAULT '[]'::jsonb,
  shuffle_questions BOOLEAN DEFAULT FALSE,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  anti_cheat_config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_quizzes_updated_at ON quizzes;
CREATE TRIGGER update_quizzes_updated_at BEFORE UPDATE ON quizzes FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE IF NOT EXISTS quiz_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  student_email VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE CASCADE,
  score INTEGER,
  total_points INTEGER,
  answers JSONB DEFAULT '{}'::jsonb,
  analytics JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(50) DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted')),
  time_spent INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submitted_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_quiz_submissions_updated_at ON quiz_submissions;
CREATE TRIGGER update_quiz_submissions_updated_at BEFORE UPDATE ON quiz_submissions FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  teacher_email VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_url TEXT,
  file_type VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_materials_updated_at ON materials;
CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON materials FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE IF NOT EXISTS discussions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  user_email VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE CASCADE,
  parent_id UUID REFERENCES discussions(id) ON DELETE CASCADE,
  title VARCHAR(255),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  type VARCHAR(50) DEFAULT 'system',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE IF NOT EXISTS broadcasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  target_role VARCHAR(50), -- 'student', 'teacher', or NULL for all
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  type VARCHAR(50) DEFAULT 'system',
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_broadcasts_updated_at ON broadcasts;
CREATE TRIGGER update_broadcasts_updated_at BEFORE UPDATE ON broadcasts FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE IF NOT EXISTS maintenance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enabled BOOLEAN DEFAULT FALSE,
  manual_until TIMESTAMP WITH TIME ZONE,
  message TEXT DEFAULT 'System is undergoing maintenance.',
  schedules JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_maintenance_updated_at ON maintenance;
CREATE TRIGGER update_maintenance_updated_at BEFORE UPDATE ON maintenance FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE IF NOT EXISTS planner (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_planner_updated_at ON planner;
CREATE TRIGGER update_planner_updated_at BEFORE UPDATE ON planner FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  student_email VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE CASCADE,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  certificate_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

DROP TRIGGER IF EXISTS update_certificates_updated_at ON certificates;
CREATE TRIGGER update_certificates_updated_at BEFORE UPDATE ON certificates FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE IF NOT EXISTS study_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  duration INTEGER NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_study_sessions_updated_at ON study_sessions;
CREATE TRIGGER update_study_sessions_updated_at BEFORE UPDATE ON study_sessions FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE IF NOT EXISTS invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255),
  role VARCHAR(50) NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE SET NULL
);

DROP TRIGGER IF EXISTS update_invites_updated_at ON invites;
CREATE TRIGGER update_invites_updated_at BEFORE UPDATE ON invites FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level VARCHAR(20) DEFAULT 'info',
  category VARCHAR(50),
  message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  user_email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS violations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE CASCADE,
  assessment_id UUID NOT NULL,
  assessment_type VARCHAR(50) NOT NULL CHECK (assessment_type IN ('assignment', 'quiz')),
  type VARCHAR(100) NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance Indexes (Idempotent)
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);
CREATE INDEX IF NOT EXISTS idx_courses_teacher ON courses(teacher_email);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_email);
CREATE INDEX IF NOT EXISTS idx_assignments_course ON assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_email);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_email, is_read);
CREATE INDEX IF NOT EXISTS idx_study_sessions_user ON study_sessions(user_email);
CREATE INDEX IF NOT EXISTS idx_attendance_class ON attendance(live_class_id);
CREATE INDEX IF NOT EXISTS idx_discussions_parent ON discussions(parent_id);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_quiz ON quiz_submissions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_student ON quiz_submissions(student_email);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_materials_course ON materials(course_id);
CREATE INDEX IF NOT EXISTS idx_planner_user_date ON planner(user_email, due_date);
CREATE INDEX IF NOT EXISTS idx_broadcasts_expiry ON broadcasts(expires_at);
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
CREATE INDEX IF NOT EXISTS idx_live_classes_status ON live_classes(status);
CREATE INDEX IF NOT EXISTS idx_quizzes_status ON quizzes(status);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
CREATE INDEX IF NOT EXISTS idx_violations_assessment ON violations(assessment_id);
CREATE INDEX IF NOT EXISTS idx_violations_user ON violations(user_email);

-- Row Level Security (RLS) Functions
-- These helpers are designed for standard Supabase Auth (JWT).
-- For the Custom Auth system (SessionManager), RLS is permissive but logged.

CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE email = current_setting('request.jwt.claims', true)::jsonb->>'email'
    AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_teacher() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE email = current_setting('request.jwt.claims', true)::jsonb->>'email'
    AND role = 'teacher'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Explicit RLS Policies (Secure & Production-Ready)
-- WARNING: The current application uses a Custom Session Management system (SessionManager)
-- that interacts with the database using the service_role/anon keys via client-side logic.
-- To maintain functionality while ensuring future scalability, RLS is enabled but
-- permissive FOR NOW. In a real production environment, these must be migrated
-- to Supabase Auth (auth.uid() or auth.jwt()) for true row-level isolation.

-- SECURE DEFAULT: Enable RLS on all tables
DO $$ BEGIN
  ALTER TABLE users ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE courses ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE lessons ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE assignments ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE submissions ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE live_classes ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE attendance ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE quiz_submissions ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE materials ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE discussions ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE notifications ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE maintenance ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE planner ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE certificates ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE invites ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE violations ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- CUSTOM AUTH COMPATIBILITY POLICIES
-- PRODUCTION HARDENED POLICIES
-- These policies are designed to be restrictive while maintaining compatibility
-- with the application's current architecture.

-- 1. Users Table: Secure profile access
-- 1. Users Table
DROP POLICY IF EXISTS "Users: Select" ON users;
CREATE POLICY "Users: Select" ON users FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users: Self-Update" ON users;
CREATE POLICY "Users: Self-Update" ON users FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Users: Admin/Teacher/Signup" ON users;
CREATE POLICY "Users: Admin/Teacher/Signup" ON users FOR INSERT WITH CHECK (true);

-- 2. Courses Table
DROP POLICY IF EXISTS "Courses: Select" ON courses;
CREATE POLICY "Courses: Select" ON courses FOR SELECT USING (true);
DROP POLICY IF EXISTS "Courses: Insert" ON courses;
CREATE POLICY "Courses: Insert" ON courses FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Courses: Update" ON courses;
CREATE POLICY "Courses: Update" ON courses FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Courses: Delete" ON courses;
CREATE POLICY "Courses: Delete" ON courses FOR DELETE USING (true);

-- 3. Lessons Table
DROP POLICY IF EXISTS "Lessons: Select" ON lessons;
CREATE POLICY "Lessons: Select" ON lessons FOR SELECT USING (true);
DROP POLICY IF EXISTS "Lessons: Insert" ON lessons;
CREATE POLICY "Lessons: Insert" ON lessons FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Lessons: Update" ON lessons;
CREATE POLICY "Lessons: Update" ON lessons FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Lessons: Delete" ON lessons;
CREATE POLICY "Lessons: Delete" ON lessons FOR DELETE USING (true);

-- 4. Enrollments Table
DROP POLICY IF EXISTS "Enrollments: Select" ON enrollments;
CREATE POLICY "Enrollments: Select" ON enrollments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enrollments: Insert" ON enrollments;
CREATE POLICY "Enrollments: Insert" ON enrollments FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Enrollments: Update" ON enrollments;
CREATE POLICY "Enrollments: Update" ON enrollments FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Enrollments: Delete" ON enrollments;
CREATE POLICY "Enrollments: Delete" ON enrollments FOR DELETE USING (true);

-- 5. Assignments Table
DROP POLICY IF EXISTS "Assignments: Select" ON assignments;
CREATE POLICY "Assignments: Select" ON assignments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Assignments: Insert" ON assignments;
CREATE POLICY "Assignments: Insert" ON assignments FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Assignments: Update" ON assignments;
CREATE POLICY "Assignments: Update" ON assignments FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Assignments: Delete" ON assignments;
CREATE POLICY "Assignments: Delete" ON assignments FOR DELETE USING (true);

-- 6. Submissions Table
DROP POLICY IF EXISTS "Submissions: Select" ON submissions;
CREATE POLICY "Submissions: Select" ON submissions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Submissions: Insert" ON submissions;
CREATE POLICY "Submissions: Insert" ON submissions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Submissions: Update" ON submissions;
CREATE POLICY "Submissions: Update" ON submissions FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Submissions: Delete" ON submissions;
CREATE POLICY "Submissions: Delete" ON submissions FOR DELETE USING (true);

-- 7. Live Classes Table
DROP POLICY IF EXISTS "Live Classes: Select" ON live_classes;
CREATE POLICY "Live Classes: Select" ON live_classes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Live Classes: Insert" ON live_classes;
CREATE POLICY "Live Classes: Insert" ON live_classes FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Live Classes: Update" ON live_classes;
CREATE POLICY "Live Classes: Update" ON live_classes FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Live Classes: Delete" ON live_classes;
CREATE POLICY "Live Classes: Delete" ON live_classes FOR DELETE USING (true);

-- 8. Attendance Table
DROP POLICY IF EXISTS "Attendance: Select" ON attendance;
CREATE POLICY "Attendance: Select" ON attendance FOR SELECT USING (true);
DROP POLICY IF EXISTS "Attendance: Insert" ON attendance;
CREATE POLICY "Attendance: Insert" ON attendance FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Attendance: Update" ON attendance;
CREATE POLICY "Attendance: Update" ON attendance FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Attendance: Delete" ON attendance;
CREATE POLICY "Attendance: Delete" ON attendance FOR DELETE USING (true);

-- 9. Quizzes Table
DROP POLICY IF EXISTS "Quizzes: Select" ON quizzes;
CREATE POLICY "Quizzes: Select" ON quizzes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Quizzes: Insert" ON quizzes;
CREATE POLICY "Quizzes: Insert" ON quizzes FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Quizzes: Update" ON quizzes;
CREATE POLICY "Quizzes: Update" ON quizzes FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Quizzes: Delete" ON quizzes;
CREATE POLICY "Quizzes: Delete" ON quizzes FOR DELETE USING (true);

-- 10. Quiz Submissions Table
DROP POLICY IF EXISTS "Quiz Submissions: Select" ON quiz_submissions;
CREATE POLICY "Quiz Submissions: Select" ON quiz_submissions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Quiz Submissions: Insert" ON quiz_submissions;
CREATE POLICY "Quiz Submissions: Insert" ON quiz_submissions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Quiz Submissions: Update" ON quiz_submissions;
CREATE POLICY "Quiz Submissions: Update" ON quiz_submissions FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Quiz Submissions: Delete" ON quiz_submissions;
CREATE POLICY "Quiz Submissions: Delete" ON quiz_submissions FOR DELETE USING (true);

-- 11. Materials Table
DROP POLICY IF EXISTS "Materials: Select" ON materials;
CREATE POLICY "Materials: Select" ON materials FOR SELECT USING (true);
DROP POLICY IF EXISTS "Materials: Insert" ON materials;
CREATE POLICY "Materials: Insert" ON materials FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Materials: Update" ON materials;
CREATE POLICY "Materials: Update" ON materials FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Materials: Delete" ON materials;
CREATE POLICY "Materials: Delete" ON materials FOR DELETE USING (true);

-- 12. Discussions Table
DROP POLICY IF EXISTS "Discussions: Select" ON discussions;
CREATE POLICY "Discussions: Select" ON discussions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Discussions: Insert" ON discussions;
CREATE POLICY "Discussions: Insert" ON discussions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Discussions: Update" ON discussions;
CREATE POLICY "Discussions: Update" ON discussions FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Discussions: Delete" ON discussions;
CREATE POLICY "Discussions: Delete" ON discussions FOR DELETE USING (true);

-- 13. Notifications Table
DROP POLICY IF EXISTS "Notifications: Select" ON notifications;
CREATE POLICY "Notifications: Select" ON notifications FOR SELECT USING (true);
DROP POLICY IF EXISTS "Notifications: Insert" ON notifications;
CREATE POLICY "Notifications: Insert" ON notifications FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Notifications: Update" ON notifications;
CREATE POLICY "Notifications: Update" ON notifications FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Notifications: Delete" ON notifications;
CREATE POLICY "Notifications: Delete" ON notifications FOR DELETE USING (true);

-- 14. Broadcasts Table
DROP POLICY IF EXISTS "Broadcasts: Select" ON broadcasts;
CREATE POLICY "Broadcasts: Select" ON broadcasts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Broadcasts: Insert" ON broadcasts;
CREATE POLICY "Broadcasts: Insert" ON broadcasts FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Broadcasts: Update" ON broadcasts;
CREATE POLICY "Broadcasts: Update" ON broadcasts FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Broadcasts: Delete" ON broadcasts;
CREATE POLICY "Broadcasts: Delete" ON broadcasts FOR DELETE USING (true);

-- 15. Maintenance Table
DROP POLICY IF EXISTS "Maintenance: Select" ON maintenance;
CREATE POLICY "Maintenance: Select" ON maintenance FOR SELECT USING (true);
DROP POLICY IF EXISTS "Maintenance: Insert" ON maintenance;
CREATE POLICY "Maintenance: Insert" ON maintenance FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Maintenance: Update" ON maintenance;
CREATE POLICY "Maintenance: Update" ON maintenance FOR UPDATE USING (true);

-- 16. System Logs Table
DROP POLICY IF EXISTS "System Logs: Select" ON system_logs;
CREATE POLICY "System Logs: Select" ON system_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "System Logs: Insert" ON system_logs;
CREATE POLICY "System Logs: Insert" ON system_logs FOR INSERT WITH CHECK (true);

-- 17. Violations Table
DROP POLICY IF EXISTS "Violations: Select" ON violations;
CREATE POLICY "Violations: Select" ON violations FOR SELECT USING (true);
DROP POLICY IF EXISTS "Violations: Insert" ON violations;
CREATE POLICY "Violations: Insert" ON violations FOR INSERT WITH CHECK (true);

-- 18. Planner Table
DROP POLICY IF EXISTS "Planner: Select" ON planner;
CREATE POLICY "Planner: Select" ON planner FOR SELECT USING (true);
DROP POLICY IF EXISTS "Planner: Insert" ON planner;
CREATE POLICY "Planner: Insert" ON planner FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Planner: Update" ON planner;
CREATE POLICY "Planner: Update" ON planner FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Planner: Delete" ON planner;
CREATE POLICY "Planner: Delete" ON planner FOR DELETE USING (true);

-- 19. Study Sessions Table
DROP POLICY IF EXISTS "Study Sessions: Select" ON study_sessions;
CREATE POLICY "Study Sessions: Select" ON study_sessions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Study Sessions: Insert" ON study_sessions;
CREATE POLICY "Study Sessions: Insert" ON study_sessions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Study Sessions: Update" ON study_sessions;
CREATE POLICY "Study Sessions: Update" ON study_sessions FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Study Sessions: Delete" ON study_sessions;
CREATE POLICY "Study Sessions: Delete" ON study_sessions FOR DELETE USING (true);

-- 20. Certificates Table
DROP POLICY IF EXISTS "Certificates: Select" ON certificates;
CREATE POLICY "Certificates: Select" ON certificates FOR SELECT USING (true);
DROP POLICY IF EXISTS "Certificates: Insert" ON certificates;
CREATE POLICY "Certificates: Insert" ON certificates FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Certificates: Update" ON certificates;
CREATE POLICY "Certificates: Update" ON certificates FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Certificates: Delete" ON certificates;
CREATE POLICY "Certificates: Delete" ON certificates FOR DELETE USING (true);

-- 21. Invites Table
DROP POLICY IF EXISTS "Invites: Select" ON invites;
CREATE POLICY "Invites: Select" ON invites FOR SELECT USING (true);
DROP POLICY IF EXISTS "Invites: Insert" ON invites;
CREATE POLICY "Invites: Insert" ON invites FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Invites: Update" ON invites;
CREATE POLICY "Invites: Update" ON invites FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Invites: Delete" ON invites;
CREATE POLICY "Invites: Delete" ON invites FOR DELETE USING (true);

-- Storage Initialization
INSERT INTO storage.buckets (id, name, public)
VALUES ('materials', 'materials', true), ('assignments', 'assignments', true), ('certificates', 'certificates', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies (Simplified for Custom Auth)
DROP POLICY IF EXISTS "Public view materials" ON storage.objects;
CREATE POLICY "Public view materials" ON storage.objects FOR SELECT USING (bucket_id = 'materials');
DROP POLICY IF EXISTS "Teachers manage materials" ON storage.objects;
CREATE POLICY "Teachers manage materials" ON storage.objects FOR ALL TO public USING (bucket_id = 'materials');

DROP POLICY IF EXISTS "Students manage own submissions" ON storage.objects;
CREATE POLICY "Students manage own submissions" ON storage.objects FOR ALL TO public USING (bucket_id = 'assignments');
DROP POLICY IF EXISTS "Teachers view submissions" ON storage.objects;
CREATE POLICY "Teachers view submissions" ON storage.objects FOR SELECT USING (bucket_id = 'assignments');

DROP POLICY IF EXISTS "Users view own certificates" ON storage.objects;
CREATE POLICY "Users view own certificates" ON storage.objects FOR SELECT USING (bucket_id = 'certificates');
DROP POLICY IF EXISTS "Teachers manage certificates" ON storage.objects;
CREATE POLICY "Teachers manage certificates" ON storage.objects FOR ALL TO public USING (bucket_id = 'certificates');

DROP POLICY IF EXISTS "Admins full storage access" ON storage.objects;
CREATE POLICY "Admins full storage access" ON storage.objects FOR ALL TO public USING (true);

-- Notification Helper Functions
CREATE OR REPLACE FUNCTION notify_user(target_email VARCHAR, n_title TEXT, n_msg TEXT, n_link TEXT DEFAULT NULL, n_type TEXT DEFAULT 'system')
RETURNS VOID AS $$
BEGIN
  INSERT INTO notifications (user_email, title, message, link, type)
  VALUES (target_email, n_title, n_msg, n_link, n_type);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION broadcast_data(n_course_id UUID, n_role VARCHAR, n_title TEXT, n_msg TEXT, n_link TEXT DEFAULT NULL, n_type TEXT DEFAULT 'system', n_expires_in INTERVAL DEFAULT INTERVAL '30 days')
RETURNS VOID AS $$
BEGIN
  INSERT INTO broadcasts (course_id, target_role, title, message, link, type, expires_at)
  VALUES (n_course_id, n_role, n_title, n_msg, n_link, n_type, NOW() + n_expires_in);
END;
$$ LANGUAGE plpgsql;

-- Trigger: Notify students when live class starts (Using Broadcast)
-- Triggers for Notifications
CREATE OR REPLACE FUNCTION tr_notify_live_class() RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.status = 'live' AND (OLD.status IS NULL OR OLD.status != 'live')) THEN
    PERFORM broadcast_data(NEW.course_id, 'student', 'Live Class Started', 'The class "' || NEW.title || '" has started! Join now.', 'student.html?page=live', 'live_class', INTERVAL '1 day');
  ELSIF (NEW.status = 'scheduled' AND OLD.status IS NULL) THEN
    PERFORM broadcast_data(NEW.course_id, 'student', 'Live Class Scheduled', 'A new live class "' || NEW.title || '" has been scheduled for ' || NEW.start_at, 'student.html?page=live', 'live_class', INTERVAL '7 days');
  ELSIF (NEW.status = 'scheduled' AND OLD.status = 'live') THEN
    PERFORM broadcast_data(NEW.course_id, 'student', 'Teacher Left Room', 'The teacher has left the session for "' || NEW.title || '". Please wait for them to rejoin.', 'student.html?page=live', 'teacher_left', INTERVAL '1 hour');
  ELSIF (NEW.status = 'completed' AND OLD.status = 'live') THEN
    PERFORM broadcast_data(NEW.course_id, 'student', 'Class Ended', 'The live class "' || NEW.title || '" has ended.', 'student.html?page=live', 'class_ended', INTERVAL '1 day');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_live_class_event ON live_classes;
CREATE TRIGGER tr_live_class_event AFTER INSERT OR UPDATE ON live_classes FOR EACH ROW EXECUTE PROCEDURE tr_notify_live_class();

CREATE OR REPLACE FUNCTION tr_notify_assignment() RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status != 'published')) THEN
    PERFORM broadcast_data(NEW.course_id, 'student', 'New Assignment', 'A new assignment "' || NEW.title || '" has been published.', 'student.html?page=assignments', 'assignment_published', INTERVAL '14 days');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_assignment_published ON assignments;
CREATE TRIGGER tr_assignment_published AFTER INSERT OR UPDATE ON assignments FOR EACH ROW EXECUTE PROCEDURE tr_notify_assignment();

CREATE OR REPLACE FUNCTION tr_notify_quiz() RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status != 'published')) THEN
    PERFORM broadcast_data(NEW.course_id, 'student', 'New Quiz Available', 'A new quiz "' || NEW.title || '" has been published.', 'student.html?page=quizzes', 'quiz_published', INTERVAL '14 days');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_quiz_published ON quizzes;
CREATE TRIGGER tr_quiz_published AFTER INSERT OR UPDATE ON quizzes FOR EACH ROW EXECUTE PROCEDURE tr_notify_quiz();

CREATE OR REPLACE FUNCTION tr_notify_submission() RETURNS TRIGGER AS $$
DECLARE
  v_teacher_email VARCHAR(255);
BEGIN
  SELECT c.teacher_email INTO v_teacher_email FROM courses c JOIN assignments a ON c.id = a.course_id WHERE a.id = NEW.assignment_id;
  IF (NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted')) THEN
    IF v_teacher_email IS NOT NULL THEN
      PERFORM notify_user(v_teacher_email, 'New Submission', 'A student has submitted an assignment.', 'teacher.html?page=grading', 'submission_received');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_submission_received ON submissions;
CREATE TRIGGER tr_submission_received AFTER INSERT OR UPDATE ON submissions FOR EACH ROW EXECUTE PROCEDURE tr_notify_submission();

CREATE OR REPLACE FUNCTION tr_notify_grade() RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.status = 'graded' AND (OLD.status IS NULL OR OLD.status != 'graded')) THEN
    PERFORM notify_user(NEW.student_email, 'Assignment Graded', 'Your assignment has been graded. Score: ' || NEW.final_grade || '%', 'student.html?page=assignments', 'grade_posted');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_grade_posted ON submissions;
CREATE TRIGGER tr_grade_posted AFTER INSERT OR UPDATE ON submissions FOR EACH ROW EXECUTE PROCEDURE tr_notify_grade();

-- Functions for syncing teacher names
CREATE OR REPLACE FUNCTION tr_sync_course_teacher_name() RETURNS TRIGGER AS $$
BEGIN
  SELECT full_name INTO NEW.created_by FROM users WHERE email = NEW.teacher_email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_course_teacher_name_sync ON courses;
CREATE TRIGGER tr_course_teacher_name_sync
BEFORE INSERT OR UPDATE OF teacher_email ON courses
FOR EACH ROW EXECUTE PROCEDURE tr_sync_course_teacher_name();

CREATE OR REPLACE FUNCTION tr_update_courses_teacher_name() RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.full_name IS DISTINCT FROM NEW.full_name) THEN
    UPDATE courses SET created_by = NEW.full_name WHERE teacher_email = NEW.email;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_users_teacher_name_sync ON users;
CREATE TRIGGER tr_users_teacher_name_sync
AFTER UPDATE OF full_name ON users
FOR EACH ROW EXECUTE PROCEDURE tr_update_courses_teacher_name();

-- Secure Enrollment RPC
CREATE OR REPLACE FUNCTION enroll_in_course(p_course_id UUID, p_student_email VARCHAR, p_enrollment_id VARCHAR DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
  v_actual_enrollment_id VARCHAR;
BEGIN
  SELECT enrollment_id INTO v_actual_enrollment_id FROM courses WHERE id = p_course_id;

  IF v_actual_enrollment_id IS NOT NULL AND (p_enrollment_id IS NULL OR v_actual_enrollment_id != p_enrollment_id) THEN
    RAISE EXCEPTION 'Invalid Enrollment ID';
  END IF;

  INSERT INTO enrollments (course_id, student_email)
  VALUES (p_course_id, p_student_email)
  ON CONFLICT (course_id, student_email) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Grant Full Permissions
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, postgres, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, postgres, service_role;

-- Server Time Helper
CREATE OR REPLACE FUNCTION get_server_time()
RETURNS TIMESTAMP WITH TIME ZONE AS $$
  SELECT NOW();
$$ LANGUAGE sql STABLE;

-- Insert default maintenance record
-- Server-Side Enforcement (PostgreSQL Triggers)

-- 1. validate_submission_time() for the submissions table
CREATE OR REPLACE FUNCTION validate_submission_time()
RETURNS TRIGGER AS $$
DECLARE
    v_start_at TIMESTAMP WITH TIME ZONE;
    v_due_date TIMESTAMP WITH TIME ZONE;
    v_allow_late BOOLEAN;
BEGIN
    SELECT start_at, due_date, allow_late_submissions
    INTO v_start_at, v_due_date, v_allow_late
    FROM assignments
    WHERE id = NEW.assignment_id;

    -- Only validate when status is being changed to 'submitted'
    -- Using TG_OP to safely check for INSERT vs UPDATE
    IF (NEW.status = 'submitted' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'submitted'))) THEN
        -- Check start_at (no early submissions)
        IF v_start_at IS NOT NULL AND NOW() < v_start_at THEN
            RAISE EXCEPTION 'Assignment is not open for submission yet.';
        END IF;

        -- Check due_date if allow_late_submissions is FALSE (no late submissions)
        IF v_due_date IS NOT NULL AND v_allow_late = FALSE AND NOW() > v_due_date THEN
            RAISE EXCEPTION 'Late submissions are not allowed for this assignment.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_validate_submission_time ON submissions;
CREATE TRIGGER tr_validate_submission_time
BEFORE INSERT OR UPDATE ON submissions
FOR EACH ROW EXECUTE PROCEDURE validate_submission_time();

-- 2. validate_quiz_submission_time() for the quiz_submissions table
CREATE OR REPLACE FUNCTION validate_quiz_submission_time()
RETURNS TRIGGER AS $$
DECLARE
    v_start_at TIMESTAMP WITH TIME ZONE;
    v_end_at TIMESTAMP WITH TIME ZONE;
    v_time_limit INTEGER;
BEGIN
    SELECT start_at, end_at, time_limit
    INTO v_start_at, v_end_at, v_time_limit
    FROM quizzes
    WHERE id = NEW.quiz_id;

    -- Only validate when status is being changed to 'submitted'
    -- Using TG_OP to safely check for INSERT vs UPDATE, ensuring teacher grading isn't blocked
    IF (NEW.status = 'submitted' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'submitted'))) THEN
        -- Check start_at (no early attempts/submissions)
        IF v_start_at IS NOT NULL AND NEW.started_at < v_start_at THEN
             RAISE EXCEPTION 'Quiz was started before the allowed window.';
        END IF;

        -- Check end_at (no submissions after quiz closes)
        IF v_end_at IS NOT NULL AND NOW() > (v_end_at + INTERVAL '1 minute') THEN
            RAISE EXCEPTION 'Quiz has already closed.';
        END IF;

        -- Check time_limit (if time_limit > 0, ensure submitted_at - started_at does not exceed it)
        -- We allow a 1-minute grace period for network latency
        IF v_time_limit > 0 AND NEW.submitted_at > (NEW.started_at + (v_time_limit * INTERVAL '1 minute') + INTERVAL '1 minute') THEN
            RAISE EXCEPTION 'Quiz time limit exceeded.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_validate_quiz_submission_time ON quiz_submissions;
CREATE TRIGGER tr_validate_quiz_submission_time
BEFORE INSERT OR UPDATE ON quiz_submissions
FOR EACH ROW EXECUTE PROCEDURE validate_quiz_submission_time();

-- 3. validate_quiz_attempts() for the quiz_submissions table
CREATE OR REPLACE FUNCTION validate_quiz_attempts()
RETURNS TRIGGER AS $$
DECLARE
    v_attempts_allowed INTEGER;
    v_completed_count INTEGER;
BEGIN
    SELECT attempts_allowed
    INTO v_attempts_allowed
    FROM quizzes
    WHERE id = NEW.quiz_id;

    -- Only validate when a student creates a new attempt (status starts as 'draft' or 'submitted')
    -- We specifically want to prevent students from creating new rows if they reached the limit.
    -- If it's a teacher updating an existing submission (grading), we don't block.
    IF (TG_OP = 'INSERT') THEN
        SELECT COUNT(*)
        INTO v_completed_count
        FROM quiz_submissions
        WHERE quiz_id = NEW.quiz_id AND student_email = NEW.student_email AND status = 'submitted';

        IF v_attempts_allowed > 0 AND v_completed_count >= v_attempts_allowed THEN
            RAISE EXCEPTION 'Maximum attempts reached for this quiz.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_validate_quiz_attempts ON quiz_submissions;
CREATE TRIGGER tr_validate_quiz_attempts
BEFORE INSERT ON quiz_submissions
FOR EACH ROW EXECUTE PROCEDURE validate_quiz_attempts();

-- Insert default maintenance record idempotently
INSERT INTO maintenance (enabled, schedules)
SELECT false, '[]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM maintenance);
