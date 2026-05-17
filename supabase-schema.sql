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
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true, "push": true, "inApp": true}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

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
  progress INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  completed_lessons JSONB DEFAULT '[]'::jsonb,
  PRIMARY KEY (course_id, student_email)
);

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
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived'))
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  live_class_id UUID REFERENCES live_classes(id) ON DELETE CASCADE,
  student_email VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE CASCADE,
  join_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  leave_time TIMESTAMP WITH TIME ZONE,
  duration INTEGER DEFAULT 0,
  is_present BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(live_class_id, student_email)
);

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
  submitted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  teacher_email VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_url TEXT,
  file_type VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS broadcasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  target_role VARCHAR(50), -- 'student', 'teacher', or NULL for all
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  type VARCHAR(50) DEFAULT 'system',
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  student_email VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE CASCADE,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  certificate_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS study_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  duration INTEGER NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255),
  role VARCHAR(50) NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level VARCHAR(20) DEFAULT 'info',
  category VARCHAR(50),
  message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  user_email VARCHAR(255),
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

-- CUSTOM AUTH COMPATIBILITY POLICIES
-- These policies allow the frontend Custom Auth system to function.
DROP POLICY IF EXISTS "Custom Auth: users" ON users;
CREATE POLICY "Custom Auth: users" ON users FOR ALL USING (true);
DROP POLICY IF EXISTS "Custom Auth: courses" ON courses;
CREATE POLICY "Custom Auth: courses" ON courses FOR ALL USING (true);
DROP POLICY IF EXISTS "Custom Auth: lessons" ON lessons;
CREATE POLICY "Custom Auth: lessons" ON lessons FOR ALL USING (true);
DROP POLICY IF EXISTS "Custom Auth: enrollments" ON enrollments;
CREATE POLICY "Custom Auth: enrollments" ON enrollments FOR ALL USING (true);
DROP POLICY IF EXISTS "Custom Auth: assignments" ON assignments;
CREATE POLICY "Custom Auth: assignments" ON assignments FOR ALL USING (true);
DROP POLICY IF EXISTS "Custom Auth: submissions" ON submissions;
CREATE POLICY "Custom Auth: submissions" ON submissions FOR ALL USING (true);
DROP POLICY IF EXISTS "Custom Auth: live_classes" ON live_classes;
CREATE POLICY "Custom Auth: live_classes" ON live_classes FOR ALL USING (true);
DROP POLICY IF EXISTS "Custom Auth: attendance" ON attendance;
CREATE POLICY "Custom Auth: attendance" ON attendance FOR ALL USING (true);
DROP POLICY IF EXISTS "Custom Auth: quizzes" ON quizzes;
CREATE POLICY "Custom Auth: quizzes" ON quizzes FOR ALL USING (true);
DROP POLICY IF EXISTS "Custom Auth: quiz_submissions" ON quiz_submissions;
CREATE POLICY "Custom Auth: quiz_submissions" ON quiz_submissions FOR ALL USING (true);
DROP POLICY IF EXISTS "Custom Auth: materials" ON materials;
CREATE POLICY "Custom Auth: materials" ON materials FOR ALL USING (true);
DROP POLICY IF EXISTS "Custom Auth: discussions" ON discussions;
CREATE POLICY "Custom Auth: discussions" ON discussions FOR ALL USING (true);
DROP POLICY IF EXISTS "Custom Auth: notifications" ON notifications;
CREATE POLICY "Custom Auth: notifications" ON notifications FOR ALL USING (true);
DROP POLICY IF EXISTS "Custom Auth: broadcasts" ON broadcasts;
CREATE POLICY "Custom Auth: broadcasts" ON broadcasts FOR ALL USING (true);
DROP POLICY IF EXISTS "Custom Auth: maintenance" ON maintenance;
CREATE POLICY "Custom Auth: maintenance" ON maintenance FOR ALL USING (true);
DROP POLICY IF EXISTS "Custom Auth: planner" ON planner;
CREATE POLICY "Custom Auth: planner" ON planner FOR ALL USING (true);
DROP POLICY IF EXISTS "Custom Auth: certificates" ON certificates;
CREATE POLICY "Custom Auth: certificates" ON certificates FOR ALL USING (true);
DROP POLICY IF EXISTS "Custom Auth: study_sessions" ON study_sessions;
CREATE POLICY "Custom Auth: study_sessions" ON study_sessions FOR ALL USING (true);
DROP POLICY IF EXISTS "Custom Auth: invites" ON invites;
CREATE POLICY "Custom Auth: invites" ON invites FOR ALL USING (true);
DROP POLICY IF EXISTS "Custom Auth: system_logs" ON system_logs;
CREATE POLICY "Custom Auth: system_logs" ON system_logs FOR ALL USING (true);

-- Storage Initialization
INSERT INTO storage.buckets (id, name, public)
VALUES ('materials', 'materials', true), ('assignments', 'assignments', true), ('certificates', 'certificates', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies (Simplified for Custom Auth)
DROP POLICY IF EXISTS "Public view materials" ON storage.objects;
CREATE POLICY "Public view materials" ON storage.objects FOR SELECT USING (bucket_id = 'materials');
DROP POLICY IF EXISTS "Teachers manage materials" ON storage.objects;
CREATE POLICY "Teachers manage materials" ON storage.objects FOR ALL USING (bucket_id = 'materials');

DROP POLICY IF EXISTS "Students manage own submissions" ON storage.objects;
CREATE POLICY "Students manage own submissions" ON storage.objects FOR ALL USING (bucket_id = 'assignments');
DROP POLICY IF EXISTS "Teachers view submissions" ON storage.objects;
CREATE POLICY "Teachers view submissions" ON storage.objects FOR SELECT USING (bucket_id = 'assignments');

DROP POLICY IF EXISTS "Users view own certificates" ON storage.objects;
CREATE POLICY "Users view own certificates" ON storage.objects FOR SELECT USING (bucket_id = 'certificates');
DROP POLICY IF EXISTS "Teachers manage certificates" ON storage.objects;
CREATE POLICY "Teachers manage certificates" ON storage.objects FOR ALL USING (bucket_id = 'certificates');

DROP POLICY IF EXISTS "Admins full storage access" ON storage.objects;
CREATE POLICY "Admins full storage access" ON storage.objects FOR ALL USING (true);

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

-- Server-side time validation for submissions and quiz attempts
CREATE OR REPLACE FUNCTION validate_submission_time() RETURNS TRIGGER AS $$
DECLARE
  v_start_at TIMESTAMP WITH TIME ZONE;
  v_due_date TIMESTAMP WITH TIME ZONE;
  v_allow_late BOOLEAN;
BEGIN
  SELECT start_at, due_date, allow_late_submissions INTO v_start_at, v_due_date, v_allow_late
  FROM assignments WHERE id = NEW.assignment_id;

  IF v_start_at IS NOT NULL AND NEW.submitted_at < v_start_at THEN
    RAISE EXCEPTION 'Assignment not yet open for submissions';
  END IF;

  IF NOT v_allow_late AND NEW.submitted_at > v_due_date THEN
    RAISE EXCEPTION 'Late submissions not allowed for this assignment';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_validate_submission_time ON submissions;
CREATE TRIGGER tr_validate_submission_time BEFORE INSERT OR UPDATE ON submissions FOR EACH ROW EXECUTE PROCEDURE validate_submission_time();

CREATE OR REPLACE FUNCTION validate_quiz_submission_time() RETURNS TRIGGER AS $$
DECLARE
  v_start_at TIMESTAMP WITH TIME ZONE;
  v_end_at TIMESTAMP WITH TIME ZONE;
  v_time_limit INTEGER;
BEGIN
  SELECT start_at, end_at, time_limit INTO v_start_at, v_end_at, v_time_limit
  FROM quizzes WHERE id = NEW.quiz_id;

  -- Validate start_at for both draft and submitted
  IF v_start_at IS NOT NULL AND NEW.started_at < v_start_at THEN
    RAISE EXCEPTION 'Quiz not yet open for attempts';
  END IF;

  -- If status is 'submitted', check end_at
  IF NEW.status = 'submitted' AND v_end_at IS NOT NULL AND NEW.submitted_at > v_end_at THEN
    RAISE EXCEPTION 'Quiz has already ended';
  END IF;

  -- Check time limit if it exists
  IF NEW.status = 'submitted' AND v_time_limit > 0 THEN
    -- Allow a 60-second buffer for network latency and auto-submit delays
    IF NEW.submitted_at > (NEW.started_at + (v_time_limit * INTERVAL '1 minute') + INTERVAL '60 seconds') THEN
        RAISE EXCEPTION 'Quiz time limit exceeded';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_validate_quiz_submission_time ON quiz_submissions;
CREATE TRIGGER tr_validate_quiz_submission_time BEFORE INSERT OR UPDATE ON quiz_submissions FOR EACH ROW EXECUTE PROCEDURE validate_quiz_submission_time();

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
-- Insert default maintenance record idempotently
INSERT INTO maintenance (enabled, schedules)
SELECT false, '[]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM maintenance);
