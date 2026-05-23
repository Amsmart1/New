-- SmartLMS Supabase Schema (Comprehensive Replacement Script)
-- This script replaces the entire schema while preserving ALL existing features,
-- fixing RLS for the custom auth system, and initializing storage buckets.

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

-- 1. Tables Creation (With all columns integrated)

CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT uuid_generate_v4() UNIQUE,
  email VARCHAR(255) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  role VARCHAR(50) NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE,
  failed_attempts INTEGER DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until TIMESTAMP WITH TIME ZONE,
  lockouts INTEGER DEFAULT 0 CHECK (lockouts >= 0),
  flagged BOOLEAN DEFAULT FALSE,
  reset_request JSONB,
  active BOOLEAN DEFAULT TRUE,
  notification_preferences JSONB DEFAULT '{"email": true, "push": true, "inApp": true}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Table for sensitive authentication data (Hidden from public SELECT)
CREATE TABLE IF NOT EXISTS user_secrets (
  email VARCHAR(255) PRIMARY KEY REFERENCES users(email) ON UPDATE CASCADE ON DELETE CASCADE,
  password_hash VARCHAR(255) NOT NULL,
  session_id VARCHAR(255),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS enrollments (
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  student_email VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
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
  points_possible INTEGER DEFAULT 100 CHECK (points_possible > 0),
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
  grade INTEGER CHECK (grade >= 0),
  final_grade INTEGER CHECK (final_grade >= 0),
  feedback TEXT,
  regrade_request TEXT,
  graded_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'graded', 'returned')),
  UNIQUE(assignment_id, student_email)
);

CREATE TABLE IF NOT EXISTS live_classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  teacher_email VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE NOT NULL CHECK (end_at > start_at),
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

CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  teacher_email VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  time_limit INTEGER DEFAULT 0 CHECK (time_limit >= 0),
  start_at TIMESTAMP WITH TIME ZONE,
  end_at TIMESTAMP WITH TIME ZONE CHECK (end_at > start_at),
  attempts_allowed INTEGER DEFAULT 1 CHECK (attempts_allowed > 0),
  passing_score INTEGER DEFAULT 60 CHECK (passing_score BETWEEN 0 AND 100),
  questions JSONB DEFAULT '[]'::jsonb,
  shuffle_questions BOOLEAN DEFAULT FALSE,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  anti_cheat_config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quiz_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  student_email VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE CASCADE,
  attempt_number INTEGER,
  score INTEGER CHECK (score >= 0),
  total_points INTEGER CHECK (total_points >= 0),
  answers JSONB DEFAULT '{}'::jsonb,
  analytics JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(50) DEFAULT 'in-progress' CHECK (status IN ('in-progress', 'submitted')),
  time_spent INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submitted_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (quiz_id, student_email, attempt_number)
);

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
  type VARCHAR(50) DEFAULT 'system' CHECK (type IN ('system', 'broadcast', 'assignment_published', 'quiz_published', 'submission_received', 'grade_posted', 'live_class', 'teacher_left', 'class_ended')),
  is_read BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '90 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS broadcasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  target_role VARCHAR(50) CHECK (target_role IS NULL OR target_role IN ('student', 'teacher')),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  type VARCHAR(50) DEFAULT 'system',
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maintenance (
  id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000000' CHECK (id = '00000000-0000-0000-0000-000000000000'),
  enabled BOOLEAN DEFAULT FALSE,
  manual_until TIMESTAMP WITH TIME ZONE,
  message TEXT DEFAULT 'System is undergoing maintenance.',
  schedules JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  student_email VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE CASCADE,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  certificate_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS study_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  duration INTEGER NOT NULL CHECK (duration > 0),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level VARCHAR(20) DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error', 'debug')),
  category VARCHAR(50),
  message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  user_email VARCHAR(255),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS violations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE CASCADE,
  assessment_id UUID NOT NULL,
  assessment_type VARCHAR(50) NOT NULL CHECK (assessment_type IN ('assignment', 'quiz')),
  type VARCHAR(100) NOT NULL,
  browser VARCHAR(100),
  device VARCHAR(50),
  os VARCHAR(50),
  elapsed_time INTEGER, -- in milliseconds
  score INTEGER,
  severity VARCHAR(20),
  metadata JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '90 days')
);

-- 2. Migrations for existing tables (Idempotent)

-- Separate top-level ALTER statements to ensure columns exist for subsequent script parsing
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days');
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '90 days');
ALTER TABLE system_logs ADD COLUMN IF NOT EXISTS user_email VARCHAR(255);
ALTER TABLE system_logs ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days');
ALTER TABLE quiz_submissions ADD COLUMN IF NOT EXISTS attempt_number INTEGER;
ALTER TABLE quiz_submissions ALTER COLUMN attempt_number DROP NOT NULL;
ALTER TABLE quiz_submissions ALTER COLUMN status SET DEFAULT 'in-progress';
ALTER TABLE violations ADD COLUMN IF NOT EXISTS assessment_id UUID;
ALTER TABLE violations ADD COLUMN IF NOT EXISTS assessment_type VARCHAR(50);
ALTER TABLE violations ADD COLUMN IF NOT EXISTS type VARCHAR(100);
ALTER TABLE violations ADD COLUMN IF NOT EXISTS browser VARCHAR(100);
ALTER TABLE violations ADD COLUMN IF NOT EXISTS device VARCHAR(50);
ALTER TABLE violations ADD COLUMN IF NOT EXISTS os VARCHAR(50);
ALTER TABLE violations ADD COLUMN IF NOT EXISTS elapsed_time INTEGER;
ALTER TABLE violations ADD COLUMN IF NOT EXISTS score INTEGER;
ALTER TABLE violations ADD COLUMN IF NOT EXISTS severity VARCHAR(20);
ALTER TABLE violations ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE violations DROP COLUMN IF EXISTS details;
ALTER TABLE violations ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE violations ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '90 days');

-- Fix quiz_submissions status check constraint if it was incorrectly initialized
DO $$
BEGIN
    ALTER TABLE quiz_submissions DROP CONSTRAINT IF EXISTS quiz_submissions_status_check;
    ALTER TABLE quiz_submissions ADD CONSTRAINT quiz_submissions_status_check CHECK (status IN ('in-progress', 'submitted'));
END $$;

DO $$
BEGIN
    -- users (Move sensitive data if it exists)
    ALTER TABLE users ADD COLUMN IF NOT EXISTS id UUID DEFAULT uuid_generate_v4() UNIQUE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true, "push": true, "inApp": true}'::jsonb;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts INTEGER DEFAULT 0 CHECK (failed_attempts >= 0);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS lockouts INTEGER DEFAULT 0 CHECK (lockouts >= 0);

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password') THEN
        INSERT INTO user_secrets (email, password_hash, session_id)
        SELECT email, password, session_id FROM users
        ON CONFLICT (email) DO NOTHING;

        ALTER TABLE users DROP COLUMN IF EXISTS password;
        ALTER TABLE users DROP COLUMN IF EXISTS session_id;
    END IF;

    -- user_secrets
    ALTER TABLE user_secrets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

    -- courses
    ALTER TABLE courses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    ALTER TABLE courses ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);
    ALTER TABLE courses ADD COLUMN IF NOT EXISTS enrollment_id VARCHAR(255);
    ALTER TABLE courses ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

    -- lessons
    ALTER TABLE lessons ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

    -- enrollments
    ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100);

    -- assignments
    ALTER TABLE assignments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    ALTER TABLE assignments ADD COLUMN IF NOT EXISTS points_possible INTEGER DEFAULT 100 CHECK (points_possible > 0);
    ALTER TABLE assignments ADD COLUMN IF NOT EXISTS anti_cheat_config JSONB DEFAULT '{}'::jsonb;

    -- submissions
    ALTER TABLE submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    ALTER TABLE submissions ADD COLUMN IF NOT EXISTS question_feedback JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE submissions ADD COLUMN IF NOT EXISTS question_scores JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE submissions ADD COLUMN IF NOT EXISTS late_penalty_applied INTEGER DEFAULT 0;

    -- Ensure UUID PK for submissions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'submissions' AND column_name = 'id') THEN
        ALTER TABLE submissions ADD COLUMN id UUID DEFAULT uuid_generate_v4();
    END IF;

    -- Migration to UUID PK if it's still composite
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'submissions' AND tc.constraint_type = 'PRIMARY KEY'
        GROUP BY tc.constraint_name HAVING COUNT(*) > 1
    ) THEN
        ALTER TABLE submissions DROP CONSTRAINT submissions_pkey;
        ALTER TABLE submissions ADD PRIMARY KEY (id);
    END IF;

    -- live_classes
    ALTER TABLE live_classes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    ALTER TABLE live_classes ADD COLUMN IF NOT EXISTS end_at TIMESTAMP WITH TIME ZONE;
    -- Note: Adding CHECK constraints to existing columns via ALTER TABLE
    BEGIN
        ALTER TABLE live_classes ADD CONSTRAINT live_classes_end_at_check CHECK (end_at > start_at);
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- attendance
    ALTER TABLE attendance ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

    -- quizzes
    ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS time_limit INTEGER DEFAULT 0 CHECK (time_limit >= 0);
    ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS attempts_allowed INTEGER DEFAULT 1 CHECK (attempts_allowed > 0);
    ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS passing_score INTEGER DEFAULT 60 CHECK (passing_score BETWEEN 0 AND 100);
    ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS anti_cheat_config JSONB DEFAULT '{}'::jsonb;
    BEGIN
        ALTER TABLE quizzes ADD CONSTRAINT quizzes_end_at_check CHECK (end_at > start_at);
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- quiz_submissions
    ALTER TABLE quiz_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    ALTER TABLE quiz_submissions ADD COLUMN IF NOT EXISTS attempt_number INTEGER;

    -- Migrate quiz_submissions attempt numbers if needed
    -- (Used EXECUTE to ensure it works even if attempt_number was just added)
    EXECUTE '
    UPDATE quiz_submissions SET attempt_number = NULL WHERE status = ''in-progress'';
    WITH numbered_attempts AS (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY quiz_id, student_email ORDER BY started_at ASC) as row_num
        FROM quiz_submissions
        WHERE status = ''submitted''
    )
    UPDATE quiz_submissions
    SET attempt_number = numbered_attempts.row_num
    FROM numbered_attempts
    WHERE quiz_submissions.id = numbered_attempts.id';

    -- Removed forced NOT NULL/DEFAULT for attempt_number to allow drafts to have NULL attempts

    -- materials
    ALTER TABLE materials ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    ALTER TABLE materials ADD COLUMN IF NOT EXISTS teacher_email VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE SET NULL;

    -- notifications
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

    -- broadcasts
    ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

    -- maintenance
    ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

    -- planner
    ALTER TABLE planner ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

    -- certificates
    ALTER TABLE certificates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

    -- study_sessions
    ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS duration INTEGER;
    BEGIN
        ALTER TABLE study_sessions ADD CONSTRAINT study_sessions_duration_check CHECK (duration > 0);
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- invites
    ALTER TABLE invites ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

    -- violations
    ALTER TABLE violations ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    ALTER TABLE violations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
END $$;

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

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quiz_submissions_composite_key') THEN
        ALTER TABLE quiz_submissions ADD CONSTRAINT quiz_submissions_composite_key UNIQUE(quiz_id, student_email, attempt_number);
    END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 3. Triggers for updated_at

DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('users', 'user_secrets', 'courses', 'lessons', 'enrollments', 'assignments', 'submissions', 'live_classes', 'attendance', 'quizzes', 'quiz_submissions', 'materials', 'discussions', 'notifications', 'broadcasts', 'maintenance', 'planner', 'certificates', 'study_sessions', 'invites', 'violations')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON %I', t, t);
        EXECUTE format('CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column()', t, t);
    END LOOP;
END $$;

-- 4. Functional Triggers

CREATE OR REPLACE FUNCTION tr_notify_live_class() RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF (NEW.status = 'scheduled') THEN
      PERFORM broadcast_data(NEW.course_id, 'student', 'Live Class Scheduled', 'A new live class "' || NEW.title || '" has been scheduled for ' || NEW.start_at, 'student.html?page=live', 'live_class', INTERVAL '7 days');
    END IF;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (NEW.status = 'live' AND OLD.status != 'live') THEN
      PERFORM broadcast_data(NEW.course_id, 'student', 'Live Class Started', 'The class "' || NEW.title || '" has started! Join now.', 'student.html?page=live', 'live_class', INTERVAL '1 day');
    ELSIF (NEW.status = 'scheduled' AND OLD.status = 'live') THEN
      PERFORM broadcast_data(NEW.course_id, 'student', 'Teacher Left Room', 'The teacher has left the session for "' || NEW.title || '". Please wait for them to rejoin.', 'student.html?page=live', 'teacher_left', INTERVAL '1 hour');
    ELSIF (NEW.status = 'completed' AND OLD.status = 'live') THEN
      PERFORM broadcast_data(NEW.course_id, 'student', 'Class Ended', 'The live class "' || NEW.title || '" has ended.', 'student.html?page=live', 'class_ended', INTERVAL '1 day');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_live_class_event ON live_classes;
CREATE TRIGGER tr_live_class_event AFTER INSERT OR UPDATE ON live_classes FOR EACH ROW EXECUTE PROCEDURE tr_notify_live_class();

CREATE OR REPLACE FUNCTION tr_notify_assignment() RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.status = 'published' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'published'))) THEN
    PERFORM broadcast_data(NEW.course_id, 'student', 'New Assignment', 'A new assignment "' || NEW.title || '" has been published.', 'student.html?page=assignments', 'assignment_published', INTERVAL '14 days');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_assignment_published ON assignments;
CREATE TRIGGER tr_assignment_published AFTER INSERT OR UPDATE ON assignments FOR EACH ROW EXECUTE PROCEDURE tr_notify_assignment();

CREATE OR REPLACE FUNCTION tr_notify_quiz() RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.status = 'published' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'published'))) THEN
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
  IF (NEW.status = 'submitted' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'submitted'))) THEN
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
  IF (NEW.status = 'graded' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'graded'))) THEN
    PERFORM notify_user(NEW.student_email, 'Assignment Graded', 'Your assignment has been graded. Score: ' || NEW.final_grade || '%', 'student.html?page=assignments', 'grade_posted');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_grade_posted ON submissions;
CREATE TRIGGER tr_grade_posted AFTER INSERT OR UPDATE ON submissions FOR EACH ROW EXECUTE PROCEDURE tr_notify_grade();

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
  IF (TG_OP = 'UPDATE' AND OLD.full_name IS DISTINCT FROM NEW.full_name) THEN
    UPDATE courses SET created_by = NEW.full_name WHERE teacher_email = NEW.email;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_users_teacher_name_sync ON users;
CREATE TRIGGER tr_users_teacher_name_sync
AFTER UPDATE OF full_name ON users
FOR EACH ROW EXECUTE PROCEDURE tr_update_courses_teacher_name();

-- 5. Validation Triggers

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

    IF (NEW.status = 'submitted' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'submitted'))) THEN
        IF v_start_at IS NOT NULL AND NOW() < v_start_at THEN
            RAISE EXCEPTION 'Assignment is not open for submission yet.';
        END IF;

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

    IF (NEW.status = 'submitted' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'submitted'))) THEN
        IF v_start_at IS NOT NULL AND NEW.started_at < v_start_at THEN
             RAISE EXCEPTION 'Quiz was started before the allowed window.';
        END IF;

        IF v_end_at IS NOT NULL AND NOW() > (v_end_at + INTERVAL '1 minute') THEN
            RAISE EXCEPTION 'Quiz has already closed.';
        END IF;

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

CREATE OR REPLACE FUNCTION validate_quiz_attempts()
RETURNS TRIGGER AS $$
DECLARE
    v_attempts_allowed INTEGER;
    v_next_attempt INTEGER;
BEGIN
    -- Force attempt_number to NULL if it's in-progress to ensure it doesn't count towards used attempts
    IF (NEW.status = 'in-progress') THEN
        NEW.attempt_number := NULL;
    END IF;

    -- Only allocate attempt number when status transition to 'submitted'
    IF (NEW.status = 'submitted' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM 'submitted')))) THEN
        SELECT attempts_allowed INTO v_attempts_allowed FROM quizzes WHERE id = NEW.quiz_id;

        -- Atomically allocate next attempt number among ALREADY SUBMITTED attempts
        -- We exclude the current row's ID to ensure fresh numbering regardless of previous state
        SELECT COALESCE(MAX(attempt_number), 0) + 1 INTO v_next_attempt
        FROM quiz_submissions
        WHERE quiz_id = NEW.quiz_id AND student_email = NEW.student_email AND status = 'submitted' AND id != NEW.id;

        IF v_attempts_allowed IS NOT NULL AND v_attempts_allowed > 0 THEN
            IF v_next_attempt > v_attempts_allowed THEN
                RAISE EXCEPTION 'You have reached the maximum number of attempts allowed for this quiz.';
            END IF;
        END IF;

        NEW.attempt_number := v_next_attempt;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_validate_quiz_attempts ON quiz_submissions;
CREATE TRIGGER tr_validate_quiz_attempts
BEFORE INSERT OR UPDATE ON quiz_submissions
FOR EACH ROW EXECUTE PROCEDURE validate_quiz_attempts();

-- Ensure only one in-progress attempt exists per student per quiz to prevent duplicate start records.
-- This combined with validate_quiz_attempts ensures a clean "one-in-progress-at-a-time" flow.
CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_submissions_in_progress_unique ON quiz_submissions (quiz_id, student_email) WHERE (status = 'in-progress');

-- JSONB Validation Functions
CREATE OR REPLACE FUNCTION validate_jsonb_metadata() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.metadata IS NOT NULL AND jsonb_typeof(NEW.metadata) != 'object' THEN
        RAISE EXCEPTION 'metadata must be a JSON object';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_jsonb_questions() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.questions IS NOT NULL AND jsonb_typeof(NEW.questions) != 'array' THEN
        RAISE EXCEPTION 'questions must be a JSON array';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_validate_users_metadata ON users;
CREATE TRIGGER tr_validate_users_metadata BEFORE INSERT OR UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE validate_jsonb_metadata();

DROP TRIGGER IF EXISTS tr_validate_courses_metadata ON courses;
CREATE TRIGGER tr_validate_courses_metadata BEFORE INSERT OR UPDATE ON courses FOR EACH ROW EXECUTE PROCEDURE validate_jsonb_metadata();

DROP TRIGGER IF EXISTS tr_validate_assignments_questions ON assignments;
CREATE TRIGGER tr_validate_assignments_questions BEFORE INSERT OR UPDATE ON assignments FOR EACH ROW EXECUTE PROCEDURE validate_jsonb_questions();

DROP TRIGGER IF EXISTS tr_validate_quizzes_questions ON quizzes;
CREATE TRIGGER tr_validate_quizzes_questions BEFORE INSERT OR UPDATE ON quizzes FOR EACH ROW EXECUTE PROCEDURE validate_jsonb_questions();

CREATE OR REPLACE FUNCTION tr_populate_reset_request_metadata() RETURNS TRIGGER AS $$
DECLARE
    v_reason TEXT;
    v_category TEXT;
    v_level TEXT;
    v_tip TEXT;
BEGIN
    -- Only run when reset_request is present and transitioning to 'pending'
    IF NEW.reset_request IS NOT NULL AND
       (OLD.reset_request IS NULL OR OLD.reset_request->>'status' IS DISTINCT FROM 'pending') AND
       NEW.reset_request->>'status' = 'pending' THEN

       v_reason := NEW.reset_request->>'reason';

       -- Server-side taxonomy mapping
       CASE v_reason
           WHEN 'Forgotten Password' THEN
               v_category := 'User Self-Service'; v_level := 'Low'; v_tip := 'Use a password manager to keep your credentials safe.';
           WHEN 'Regular Update' THEN
               v_category := 'User Self-Service'; v_level := 'Low'; v_tip := 'Regularly changing passwords helps maintain account health.';
           WHEN 'Compromised Account' THEN
               v_category := 'Security Incident'; v_level := 'Critical'; v_tip := 'Check your active sessions and enable 2FA after resetting.';
           WHEN 'Suspicious Activity' THEN
               v_category := 'Security Incident'; v_level := 'High'; v_tip := 'Review your login history for unrecognized devices.';
           WHEN 'Policy Enforcement' THEN
               v_category := 'Administrative'; v_level := 'Medium'; v_tip := 'Your organization requires a password update for compliance.';
           WHEN 'Account Recovery' THEN
               v_category := 'Administrative'; v_level := 'Medium'; v_tip := 'Ensure your recovery email and phone are up to date.';
           WHEN 'Lost/Stolen Device' THEN
               v_category := 'Device Management'; v_level := 'High'; v_tip := 'Revoke access for the old device in your security settings.';
           WHEN 'New Primary Device' THEN
               v_category := 'Device Management'; v_level := 'Medium'; v_tip := 'Always set up new devices on a trusted, secure network.';
           WHEN 'I''m having trouble logging in' THEN
               v_category := 'User Self-Service'; v_level := 'Low'; v_tip := '-Check caps lock. -Check the special character used. -Try another device.';
           ELSE
               v_category := 'Other'; v_level := 'Medium'; v_tip := 'Please contact an administrator for further assistance.';
       END CASE;

       -- Update the JSONB object with derived metadata
       NEW.reset_request := NEW.reset_request || jsonb_build_object(
           'category', v_category,
           'security_level', v_level,
           'tips', v_tip
       );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_users_reset_populate ON users;
CREATE TRIGGER tr_users_reset_populate
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE PROCEDURE tr_populate_reset_request_metadata();

-- 6. Indexes

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);
CREATE INDEX IF NOT EXISTS idx_users_auth_lookup ON users(active, flagged, locked_until);
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
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_status ON quiz_submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_materials_course ON materials(course_id);
CREATE INDEX IF NOT EXISTS idx_planner_user_date ON planner(user_email, due_date);
CREATE INDEX IF NOT EXISTS idx_broadcasts_expiry ON broadcasts(expires_at);
CREATE INDEX IF NOT EXISTS idx_notifications_expiry ON notifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_system_logs_expiry ON system_logs(expires_at);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_category ON system_logs(category);
CREATE INDEX IF NOT EXISTS idx_violations_expiry ON violations(expires_at);
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
CREATE INDEX IF NOT EXISTS idx_live_classes_status ON live_classes(status);
CREATE INDEX IF NOT EXISTS idx_quizzes_status ON quizzes(status);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
CREATE INDEX IF NOT EXISTS idx_violations_assessment ON violations(assessment_id);
CREATE INDEX IF NOT EXISTS idx_violations_user ON violations(user_email);
CREATE INDEX IF NOT EXISTS idx_violations_reporting ON violations(assessment_id, user_email);

-- Missing Foreign-Key Indexes
CREATE INDEX IF NOT EXISTS idx_assignments_teacher_email ON assignments(teacher_email);
CREATE INDEX IF NOT EXISTS idx_live_classes_course_id ON live_classes(course_id);
CREATE INDEX IF NOT EXISTS idx_live_classes_teacher_email ON live_classes(teacher_email);
CREATE INDEX IF NOT EXISTS idx_attendance_student_email ON attendance(student_email);
CREATE INDEX IF NOT EXISTS idx_quizzes_course_id ON quizzes(course_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_teacher_email ON quizzes(teacher_email);
CREATE INDEX IF NOT EXISTS idx_materials_teacher_email ON materials(teacher_email);
CREATE INDEX IF NOT EXISTS idx_discussions_course_id ON discussions(course_id);
CREATE INDEX IF NOT EXISTS idx_discussions_user_email ON discussions(user_email);
CREATE INDEX IF NOT EXISTS idx_broadcasts_course_id ON broadcasts(course_id);
CREATE INDEX IF NOT EXISTS idx_certificates_course_id ON certificates(course_id);
CREATE INDEX IF NOT EXISTS idx_certificates_student_email ON certificates(student_email);
CREATE INDEX IF NOT EXISTS idx_study_sessions_course_id ON study_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_invites_created_by ON invites(created_by);

-- Index for performant RLS identity resolution
CREATE INDEX IF NOT EXISTS idx_user_secrets_session_id ON user_secrets(session_id);

-- Composite Indexes for Foreign Key Pairs & Common Lookups
CREATE INDEX IF NOT EXISTS idx_enrollments_composite ON enrollments(course_id, student_email);
CREATE INDEX IF NOT EXISTS idx_submissions_composite ON submissions(assignment_id, student_email);
CREATE INDEX IF NOT EXISTS idx_attendance_composite ON attendance(live_class_id, student_email);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_composite ON quiz_submissions(quiz_id, student_email);

-- Composite Indexes for Dashboard Filters
CREATE INDEX IF NOT EXISTS idx_courses_teacher_status ON courses(teacher_email, status);
CREATE INDEX IF NOT EXISTS idx_assignments_course_status ON assignments(course_id, status);
CREATE INDEX IF NOT EXISTS idx_quizzes_course_status ON quizzes(course_id, status);
CREATE INDEX IF NOT EXISTS idx_live_classes_course_status ON live_classes(course_id, status);

-- JSONB GIN Indexes for Search Performance
CREATE INDEX IF NOT EXISTS idx_users_metadata_gin ON users USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_courses_metadata_gin ON courses USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_assignments_questions_gin ON assignments USING GIN (questions);
CREATE INDEX IF NOT EXISTS idx_assignments_anti_cheat_gin ON assignments USING GIN (anti_cheat_config);
CREATE INDEX IF NOT EXISTS idx_quizzes_questions_gin ON quizzes USING GIN (questions);
CREATE INDEX IF NOT EXISTS idx_quizzes_anti_cheat_gin ON quizzes USING GIN (anti_cheat_config);
CREATE INDEX IF NOT EXISTS idx_submissions_answers_gin ON submissions USING GIN (answers);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_answers_gin ON quiz_submissions USING GIN (answers);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_analytics_gin ON quiz_submissions USING GIN (analytics);
CREATE INDEX IF NOT EXISTS idx_violations_metadata_gin ON violations USING GIN (metadata);

-- 7. Helper Functions

-- Auth helpers supporting both JWT and Custom x-session-id header
CREATE OR REPLACE FUNCTION get_auth_email() RETURNS VARCHAR AS $$
DECLARE
  v_email VARCHAR;
  v_session_id VARCHAR;
BEGIN
  -- 1. Try JWT claims (Standard Supabase Auth)
  v_email := current_setting('request.jwt.claims', true)::jsonb->>'email';
  IF v_email IS NOT NULL THEN
    RETURN v_email;
  END IF;

  -- 2. Try custom x-session-id header (Custom SessionManager)
  v_session_id := current_setting('request.headers', true)::jsonb->>'x-session-id';
  IF v_session_id IS NOT NULL THEN
    SELECT email INTO v_email FROM user_secrets WHERE session_id = v_session_id;
    RETURN v_email;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_auth_role() RETURNS VARCHAR AS $$
DECLARE
  v_role VARCHAR;
  v_session_id VARCHAR;
BEGIN
  -- 1. Try JWT claims
  v_role := current_setting('request.jwt.claims', true)::jsonb->>'role';
  IF v_role IS NOT NULL THEN
    RETURN v_role;
  END IF;

  -- 2. Try custom x-session-id header
  v_session_id := current_setting('request.headers', true)::jsonb->>'x-session-id';
  IF v_session_id IS NOT NULL THEN
    SELECT u.role INTO v_role
    FROM users u
    JOIN user_secrets s ON u.email = s.email
    WHERE s.session_id = v_session_id;
    RETURN v_role;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
  SELECT get_auth_role() = 'admin';
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION is_teacher() RETURNS BOOLEAN AS $$
  SELECT get_auth_role() = 'teacher';
$$ LANGUAGE sql STABLE;

-- Secure Auth Logic
CREATE OR REPLACE FUNCTION authenticate_user(p_email VARCHAR, p_password_hash VARCHAR, p_session_id VARCHAR)
RETURNS JSONB AS $$
DECLARE
  v_user RECORD;
  v_secret RECORD;
BEGIN
  SELECT
    id, email, full_name, phone, role, created_at, updated_at, last_login,
    failed_attempts, locked_until, lockouts, flagged, reset_request,
    active, notification_preferences, metadata
  INTO v_user FROM users WHERE email = p_email;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Account not found');
  END IF;

  IF NOT v_user.active THEN
    RETURN jsonb_build_object('success', false, 'message', 'Account deactivated');
  END IF;

  IF v_user.flagged THEN
    RETURN jsonb_build_object('success', false, 'message', 'Account flagged');
  END IF;

  IF v_user.locked_until IS NOT NULL AND v_user.locked_until > NOW() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Account locked until ' || v_user.locked_until);
  END IF;

  SELECT password_hash, session_id INTO v_secret FROM user_secrets WHERE email = p_email;

  IF v_secret.password_hash = p_password_hash THEN
    -- Update session and login stats
    UPDATE user_secrets SET session_id = p_session_id WHERE email = p_email;
    UPDATE users SET last_login = NOW(), failed_attempts = 0, locked_until = NULL WHERE email = p_email;

    RETURN jsonb_build_object(
      'success', true,
      'user', jsonb_build_object(
        'id', v_user.id,
        'email', v_user.email,
        'full_name', v_user.full_name,
        'phone', v_user.phone,
        'role', v_user.role,
        'created_at', v_user.created_at,
        'updated_at', v_user.updated_at,
        'last_login', NOW(),
        'failed_attempts', 0,
        'locked_until', NULL,
        'lockouts', v_user.lockouts,
        'flagged', v_user.flagged,
        'reset_request', v_user.reset_request,
        'active', v_user.active,
        'notification_preferences', v_user.notification_preferences,
        'metadata', v_user.metadata,
        'session_id', p_session_id
      )
    );
  ELSE
    -- Increment failed attempts
    UPDATE users SET failed_attempts = failed_attempts + 1 WHERE email = p_email;

    -- Lock account if too many attempts
    IF v_user.failed_attempts + 1 >= 5 THEN
        UPDATE users SET locked_until = NOW() + INTERVAL '30 minutes', failed_attempts = 0, lockouts = lockouts + 1 WHERE email = p_email;
        -- Flag if too many lockouts
        IF v_user.lockouts + 1 >= 3 THEN
            UPDATE users SET flagged = TRUE WHERE email = p_email;
        END IF;
        RETURN jsonb_build_object('success', false, 'message', 'Too many failed attempts. Account locked for 30 minutes.');
    END IF;

    RETURN jsonb_build_object('success', false, 'message', 'Invalid password. ' || (5 - (v_user.failed_attempts + 1)) || ' attempts remaining.');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Secure User Creation RPC
CREATE OR REPLACE FUNCTION create_user_secure(
    p_email VARCHAR,
    p_full_name VARCHAR,
    p_phone VARCHAR,
    p_password_hash VARCHAR,
    p_role VARCHAR,
    p_session_id VARCHAR,
    p_invite_token VARCHAR DEFAULT NULL,
    p_active BOOLEAN DEFAULT TRUE,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB AS $$
DECLARE
    v_actual_role VARCHAR := 'student';
    v_invite JSONB;
BEGIN
    -- 1. Check if user already exists
    IF EXISTS (SELECT 1 FROM users WHERE email = p_email) THEN
        RETURN jsonb_build_object('success', false, 'message', 'User with this email already exists');
    END IF;

    -- 2. Role Validation
    IF p_role IN ('admin', 'teacher') THEN
        IF is_admin() THEN
            -- Admins can create any role
            v_actual_role := p_role;
        ELSIF p_invite_token IS NULL THEN
            -- Public signups for admin/teacher limited to 3
            IF (SELECT COUNT(*) FROM users WHERE role = p_role) >= 3 THEN
                RETURN jsonb_build_object('success', false, 'message', 'Maximum number of ' || p_role || ' accounts reached. Invitation required.');
            END IF;
            v_actual_role := p_role;
        ELSE
            -- Validate invite
            SELECT to_jsonb(i.*) INTO v_invite FROM invites i WHERE token = p_invite_token AND (email IS NULL OR email = p_email) AND used_at IS NULL AND expires_at > NOW();
            IF v_invite IS NULL THEN
                RETURN jsonb_build_object('success', false, 'message', 'Invalid or expired invitation');
            END IF;
            v_actual_role := v_invite->>'role';
            -- Mark invite as used
            UPDATE invites SET used_at = NOW() WHERE token = p_invite_token;
        END IF;
    ELSE
        v_actual_role := 'student';
    END IF;

    -- 3. Create User
    INSERT INTO users (email, full_name, phone, role, active, metadata)
    VALUES (p_email, p_full_name, p_phone, v_actual_role, p_active, p_metadata);

    -- 4. Create Secrets
    INSERT INTO user_secrets (email, password_hash, session_id)
    VALUES (p_email, p_password_hash, p_session_id);

    RETURN jsonb_build_object('success', true, 'user', (
        SELECT to_jsonb(t.*) FROM (
            SELECT u.*, s.session_id
            FROM users u
            JOIN user_secrets s ON u.email = s.email
            WHERE u.email = p_email
        ) t
    ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Secure Secret Update RPC
CREATE OR REPLACE FUNCTION update_user_secret_secure(
    p_email VARCHAR,
    p_password_hash VARCHAR DEFAULT NULL,
    p_session_id VARCHAR DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    -- Check permissions: User can only update own secret unless admin
    IF NOT (is_admin() OR get_auth_email() = p_email) THEN
        RAISE EXCEPTION 'Unauthorized to update secrets for this user.';
    END IF;

    IF p_password_hash IS NOT NULL THEN
        UPDATE user_secrets SET password_hash = p_password_hash WHERE email = p_email;
    END IF;

    IF p_session_id IS NOT NULL THEN
        UPDATE user_secrets SET session_id = p_session_id WHERE email = p_email;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_current_session_id()
RETURNS VARCHAR AS $$
DECLARE
    v_session_id VARCHAR;
    v_email VARCHAR;
BEGIN
    v_email := get_auth_email();
    IF v_email IS NULL THEN RETURN NULL; END IF;

    SELECT session_id INTO v_session_id FROM user_secrets WHERE email = v_email;
    RETURN v_session_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_secure(p_email VARCHAR)
RETURNS JSONB AS $$
DECLARE
    v_user RECORD;
    v_session_id VARCHAR;
BEGIN
    SELECT * INTO v_user FROM users WHERE email = p_email;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Only include session_id if requester is admin or the user themselves
    IF (is_admin() OR get_auth_email() = p_email) THEN
        SELECT session_id INTO v_session_id FROM user_secrets WHERE email = p_email;
    END IF;

    RETURN to_jsonb(v_user) || jsonb_build_object('session_id', v_session_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_server_time()
RETURNS TIMESTAMP WITH TIME ZONE AS $$
  SELECT NOW();
$$ LANGUAGE sql STABLE;

-- 7b. Quiz Authoritative Logic RPCs

CREATE OR REPLACE FUNCTION start_quiz_attempt(p_quiz_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_student_email VARCHAR;
    v_quiz RECORD;
    v_attempt RECORD;
    v_attempts_used INTEGER;
BEGIN
    v_student_email := get_auth_email();
    IF v_student_email IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT * INTO v_quiz FROM quizzes WHERE id = p_quiz_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quiz not found';
    END IF;

    -- 1. Check for existing in-progress attempt
    SELECT * INTO v_attempt FROM quiz_submissions
    WHERE quiz_id = p_quiz_id AND student_email = v_student_email AND status = 'in-progress';

    IF FOUND THEN
        RETURN to_jsonb(v_attempt);
    END IF;

    -- 2. Validate limits for new attempt
    SELECT COUNT(*) INTO v_attempts_used
    FROM quiz_submissions
    WHERE quiz_id = p_quiz_id AND student_email = v_student_email AND status = 'submitted';

    IF v_quiz.attempts_allowed IS NOT NULL AND v_attempts_used >= v_quiz.attempts_allowed THEN
        RAISE EXCEPTION 'You have reached the maximum number of attempts allowed for this quiz.';
    END IF;

    -- 3. Create new attempt
    INSERT INTO quiz_submissions (quiz_id, student_email, status, answers, started_at)
    VALUES (p_quiz_id, v_student_email, 'in-progress', '{}'::jsonb, NOW())
    RETURNING * INTO v_attempt;

    RETURN to_jsonb(v_attempt);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION submit_quiz_attempt(
    p_submission_id UUID,
    p_answers JSONB,
    p_time_spent INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_student_email VARCHAR;
    v_attempt RECORD;
    v_quiz RECORD;
    v_score INTEGER := 0;
    v_total_points INTEGER := 0;
    v_q JSONB;
    v_idx INTEGER := 0;
    v_student_answer TEXT;
    v_correct_answer TEXT;
BEGIN
    v_student_email := get_auth_email();

    SELECT * INTO v_attempt FROM quiz_submissions WHERE id = p_submission_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;

    -- Security: Ensure ownership
    IF v_attempt.student_email != v_student_email THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF v_attempt.status = 'submitted' THEN
        RETURN to_jsonb(v_attempt);
    END IF;

    SELECT * INTO v_quiz FROM quizzes WHERE id = v_attempt.quiz_id;

    -- Server-side scoring
    FOR v_q IN SELECT * FROM jsonb_array_elements(v_quiz.questions)
    LOOP
        v_total_points := v_total_points + (v_q->>'points')::INTEGER;
        v_student_answer := p_answers->>(v_idx::TEXT);
        v_correct_answer := v_q->>'correct';

        IF v_student_answer IS NOT NULL AND
           trim(lower(v_student_answer)) = trim(lower(v_correct_answer)) THEN
            v_score := v_score + (v_q->>'points')::INTEGER;
        END IF;

        v_idx := v_idx + 1;
    END LOOP;

    -- Final update
    UPDATE quiz_submissions SET
        answers = p_answers,
        score = CASE WHEN v_total_points > 0 THEN ROUND((v_score::FLOAT / v_total_points::FLOAT) * 100) ELSE 0 END,
        total_points = v_total_points,
        status = 'submitted',
        time_spent = p_time_spent,
        submitted_at = NOW()
    WHERE id = p_submission_id
    RETURNING * INTO v_attempt;

    RETURN to_jsonb(v_attempt);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Periodic Purge Function
CREATE OR REPLACE FUNCTION purge_expired_records()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM broadcasts WHERE expires_at < NOW();
    DELETE FROM notifications WHERE created_at < (NOW() - INTERVAL '60 days') AND is_read = TRUE;
    DELETE FROM violations WHERE expires_at < NOW();
    DELETE FROM system_logs WHERE created_at < (NOW() - INTERVAL '30 days');
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Attach purge trigger to high-frequency tables
DROP TRIGGER IF EXISTS tr_purge_broadcasts ON broadcasts;
CREATE TRIGGER tr_purge_broadcasts AFTER INSERT ON broadcasts FOR EACH STATEMENT EXECUTE PROCEDURE purge_expired_records();

DROP TRIGGER IF EXISTS tr_purge_notifications ON notifications;
CREATE TRIGGER tr_purge_notifications AFTER INSERT ON notifications FOR EACH STATEMENT EXECUTE PROCEDURE purge_expired_records();

DROP TRIGGER IF EXISTS tr_purge_violations ON violations;
CREATE TRIGGER tr_purge_violations AFTER INSERT ON violations FOR EACH STATEMENT EXECUTE PROCEDURE purge_expired_records();

DROP TRIGGER IF EXISTS tr_purge_logs ON system_logs;
CREATE TRIGGER tr_purge_logs AFTER INSERT ON system_logs FOR EACH STATEMENT EXECUTE PROCEDURE purge_expired_records();

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

CREATE OR REPLACE FUNCTION notify_user(target_email VARCHAR, n_title TEXT, n_msg TEXT, n_link TEXT DEFAULT NULL, n_type TEXT DEFAULT 'system')
RETURNS VOID AS $$
BEGIN
  INSERT INTO notifications (user_email, title, message, link, type)
  VALUES (target_email, n_title, n_msg, n_link, n_type);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION broadcast_data(n_course_id UUID, n_role VARCHAR, n_title TEXT, n_msg TEXT, n_link TEXT DEFAULT NULL, n_type TEXT DEFAULT 'system', n_expires_in INTERVAL DEFAULT INTERVAL '30 days')
RETURNS VOID AS $$
BEGIN
  -- Security: Only teachers or admins should be able to broadcast
  IF NOT (is_teacher() OR is_admin()) THEN
    RAISE EXCEPTION 'Only teachers and admins can broadcast data.';
  END IF;

  INSERT INTO broadcasts (course_id, target_role, title, message, link, type, expires_at)
  VALUES (n_course_id, n_role, n_title, n_msg, n_link, n_type, NOW() + n_expires_in);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Seed Data

INSERT INTO maintenance (id, enabled, schedules)
SELECT '00000000-0000-0000-0000-000000000000', false, '[]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM maintenance);

-- 9. Permissions & RLS

-- SECURE DEFAULT: Enable RLS on all tables
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('users', 'user_secrets', 'courses', 'lessons', 'enrollments', 'assignments', 'submissions', 'live_classes', 'attendance', 'quizzes', 'quiz_submissions', 'materials', 'discussions', 'notifications', 'broadcasts', 'maintenance', 'planner', 'certificates', 'study_sessions', 'invites', 'system_logs', 'violations')
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

-- RLS POLICIES

-- 0. User Secrets (Strictly restricted)
DROP POLICY IF EXISTS "Secrets: No Public Access" ON user_secrets;
CREATE POLICY "Secrets: No Public Access" ON user_secrets FOR ALL USING (false);

-- 1. Users Table
DROP POLICY IF EXISTS "Users: Select" ON users;
CREATE POLICY "Users: Select" ON users FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users: Update" ON users;
CREATE POLICY "Users: Update" ON users FOR UPDATE USING (email = get_auth_email() OR is_admin());
DROP POLICY IF EXISTS "Users: No Direct Insert" ON users;
CREATE POLICY "Users: No Direct Insert" ON users FOR INSERT WITH CHECK (false); -- Force use of create_user_secure RPC

-- 2. Courses Table
DROP POLICY IF EXISTS "Courses: Select" ON courses;
CREATE POLICY "Courses: Select" ON courses FOR SELECT USING (status = 'published' OR teacher_email = get_auth_email() OR is_admin());
DROP POLICY IF EXISTS "Courses: Teachers Manage" ON courses;
CREATE POLICY "Courses: Teachers Manage" ON courses FOR ALL USING (teacher_email = get_auth_email() OR is_admin());

-- 3. Lessons Table
DROP POLICY IF EXISTS "Lessons: Select" ON lessons;
CREATE POLICY "Lessons: Select" ON lessons FOR SELECT USING (
  EXISTS (SELECT 1 FROM enrollments WHERE course_id = lessons.course_id AND student_email = get_auth_email()) OR
  EXISTS (SELECT 1 FROM courses WHERE id = lessons.course_id AND (teacher_email = get_auth_email() OR is_admin()))
);
DROP POLICY IF EXISTS "Lessons: Teachers Manage" ON lessons;
CREATE POLICY "Lessons: Teachers Manage" ON lessons FOR ALL USING (
  EXISTS (SELECT 1 FROM courses WHERE id = lessons.course_id AND (teacher_email = get_auth_email() OR is_admin()))
);

-- 4. Enrollments Table
DROP POLICY IF EXISTS "Enrollments: User Access" ON enrollments;
CREATE POLICY "Enrollments: User Access" ON enrollments FOR SELECT USING (
  student_email = get_auth_email() OR
  is_admin() OR
  (is_teacher() AND EXISTS (SELECT 1 FROM courses WHERE id = enrollments.course_id AND teacher_email = get_auth_email()))
);
DROP POLICY IF EXISTS "Enrollments: Self Enroll" ON enrollments;
CREATE POLICY "Enrollments: Self Enroll" ON enrollments FOR INSERT WITH CHECK (student_email = get_auth_email());
DROP POLICY IF EXISTS "Enrollments: Manage for Admins" ON enrollments;
CREATE POLICY "Enrollments: Manage for Admins" ON enrollments FOR ALL USING (is_admin());

-- 5. Assignments Table
DROP POLICY IF EXISTS "Assignments: Select" ON assignments;
CREATE POLICY "Assignments: Select" ON assignments FOR SELECT USING (
  EXISTS (SELECT 1 FROM enrollments WHERE course_id = assignments.course_id AND student_email = get_auth_email()) OR
  teacher_email = get_auth_email() OR is_admin()
);
DROP POLICY IF EXISTS "Assignments: Teachers Manage" ON assignments;
CREATE POLICY "Assignments: Teachers Manage" ON assignments FOR ALL USING (teacher_email = get_auth_email() OR is_admin());

-- 6. Submissions Table
DROP POLICY IF EXISTS "Submissions: Select" ON submissions;
CREATE POLICY "Submissions: Select" ON submissions FOR SELECT USING (
  student_email = get_auth_email() OR
  EXISTS (SELECT 1 FROM assignments WHERE id = submissions.assignment_id AND (teacher_email = get_auth_email() OR is_admin()))
);
DROP POLICY IF EXISTS "Submissions: Insert" ON submissions;
CREATE POLICY "Submissions: Insert" ON submissions FOR INSERT WITH CHECK (student_email = get_auth_email());
DROP POLICY IF EXISTS "Submissions: Update" ON submissions;
CREATE POLICY "Submissions: Update" ON submissions FOR UPDATE USING (
  student_email = get_auth_email() OR
  EXISTS (SELECT 1 FROM assignments WHERE id = submissions.assignment_id AND (teacher_email = get_auth_email() OR is_admin()))
);

-- 7. Live Classes Table
DROP POLICY IF EXISTS "Live Classes: Select" ON live_classes;
CREATE POLICY "Live Classes: Select" ON live_classes FOR SELECT USING (
  EXISTS (SELECT 1 FROM enrollments WHERE course_id = live_classes.course_id AND student_email = get_auth_email()) OR
  teacher_email = get_auth_email() OR is_admin()
);
DROP POLICY IF EXISTS "Live Classes: Teachers Manage" ON live_classes;
CREATE POLICY "Live Classes: Teachers Manage" ON live_classes FOR ALL USING (teacher_email = get_auth_email() OR is_admin());

-- 8. Attendance Table
DROP POLICY IF EXISTS "Attendance: Access" ON attendance;
CREATE POLICY "Attendance: Access" ON attendance FOR SELECT USING (
  student_email = get_auth_email() OR
  is_admin() OR
  (is_teacher() AND EXISTS (SELECT 1 FROM live_classes WHERE id = attendance.live_class_id AND teacher_email = get_auth_email()))
);
DROP POLICY IF EXISTS "Attendance: Insert" ON attendance;
CREATE POLICY "Attendance: Insert" ON attendance FOR INSERT WITH CHECK (student_email = get_auth_email());

-- 9. Quizzes Table
DROP POLICY IF EXISTS "Quizzes: Select" ON quizzes;
CREATE POLICY "Quizzes: Select" ON quizzes FOR SELECT USING (
  EXISTS (SELECT 1 FROM enrollments WHERE course_id = quizzes.course_id AND student_email = get_auth_email()) OR
  teacher_email = get_auth_email() OR is_admin()
);
DROP POLICY IF EXISTS "Quizzes: Teachers Manage" ON quizzes;
CREATE POLICY "Quizzes: Teachers Manage" ON quizzes FOR ALL USING (teacher_email = get_auth_email() OR is_admin());

-- 10. Quiz Submissions Table
DROP POLICY IF EXISTS "Quiz Submissions: Access" ON quiz_submissions;
CREATE POLICY "Quiz Submissions: Access" ON quiz_submissions FOR SELECT USING (
  student_email = get_auth_email() OR
  EXISTS (SELECT 1 FROM quizzes WHERE id = quiz_submissions.quiz_id AND (teacher_email = get_auth_email() OR is_admin()))
);
DROP POLICY IF EXISTS "Quiz Submissions: Insert" ON quiz_submissions;
CREATE POLICY "Quiz Submissions: Insert" ON quiz_submissions FOR INSERT WITH CHECK (student_email = get_auth_email());
DROP POLICY IF EXISTS "Quiz Submissions: Update" ON quiz_submissions;
CREATE POLICY "Quiz Submissions: Update" ON quiz_submissions FOR UPDATE USING (student_email = get_auth_email());

-- 11. Materials Table
DROP POLICY IF EXISTS "Materials: Select" ON materials;
CREATE POLICY "Materials: Select" ON materials FOR SELECT USING (
  EXISTS (SELECT 1 FROM enrollments WHERE course_id = materials.course_id AND student_email = get_auth_email()) OR
  teacher_email = get_auth_email() OR is_admin()
);
DROP POLICY IF EXISTS "Materials: Teachers Manage" ON materials;
CREATE POLICY "Materials: Teachers Manage" ON materials FOR ALL USING (teacher_email = get_auth_email() OR is_admin());

-- 12. Discussions Table
DROP POLICY IF EXISTS "Discussions: Access" ON discussions;
CREATE POLICY "Discussions: Access" ON discussions FOR ALL USING (
  EXISTS (SELECT 1 FROM enrollments WHERE course_id = discussions.course_id AND student_email = get_auth_email()) OR
  EXISTS (SELECT 1 FROM courses WHERE id = discussions.course_id AND (teacher_email = get_auth_email() OR is_admin()))
);

-- 13. Notifications Table
DROP POLICY IF EXISTS "Notifications: User Access" ON notifications;
CREATE POLICY "Notifications: User Access" ON notifications FOR ALL USING (user_email = get_auth_email() OR is_admin());

-- 14. Broadcasts Table
DROP POLICY IF EXISTS "Broadcasts: Access" ON broadcasts;
CREATE POLICY "Broadcasts: Access" ON broadcasts FOR SELECT USING (
  (course_id IS NULL AND (target_role IS NULL OR target_role = get_auth_role())) OR
  EXISTS (SELECT 1 FROM enrollments WHERE course_id = broadcasts.course_id AND student_email = get_auth_email()) OR
  EXISTS (SELECT 1 FROM courses WHERE id = broadcasts.course_id AND (teacher_email = get_auth_email() OR is_admin()))
);
DROP POLICY IF EXISTS "Broadcasts: Manage" ON broadcasts;
CREATE POLICY "Broadcasts: Manage" ON broadcasts FOR ALL USING (is_teacher() OR is_admin());

-- 15. Maintenance Table
DROP POLICY IF EXISTS "Maintenance: Select" ON maintenance;
CREATE POLICY "Maintenance: Select" ON maintenance FOR SELECT USING (true);
DROP POLICY IF EXISTS "Maintenance: Manage for Admins" ON maintenance;
CREATE POLICY "Maintenance: Manage for Admins" ON maintenance FOR ALL USING (is_admin());

-- 16. System Logs Table
DROP POLICY IF EXISTS "System Logs: Manage for Admins" ON system_logs;
CREATE POLICY "System Logs: Manage for Admins" ON system_logs FOR ALL USING (is_admin());
DROP POLICY IF EXISTS "System Logs: Insert" ON system_logs;
CREATE POLICY "System Logs: Insert" ON system_logs FOR INSERT WITH CHECK (true);

-- 17. Violations Table
DROP POLICY IF EXISTS "Violations: User Access" ON violations;
CREATE POLICY "Violations: User Access" ON violations FOR SELECT USING (
  user_email = get_auth_email() OR
  is_admin() OR
  (is_teacher() AND (
    EXISTS (SELECT 1 FROM assignments WHERE id = violations.assessment_id AND assessment_type = 'assignment' AND teacher_email = get_auth_email()) OR
    EXISTS (SELECT 1 FROM quizzes WHERE id = violations.assessment_id AND assessment_type = 'quiz' AND teacher_email = get_auth_email())
  ))
);
DROP POLICY IF EXISTS "Violations: Insert" ON violations;
CREATE POLICY "Violations: Insert" ON violations FOR INSERT WITH CHECK (user_email = get_auth_email());
DROP POLICY IF EXISTS "Violations: Delete" ON violations;
CREATE POLICY "Violations: Delete" ON violations FOR DELETE USING (
  is_admin() OR
  (is_teacher() AND (
    EXISTS (SELECT 1 FROM assignments WHERE id = violations.assessment_id AND assessment_type = 'assignment' AND teacher_email = get_auth_email()) OR
    EXISTS (SELECT 1 FROM quizzes WHERE id = violations.assessment_id AND assessment_type = 'quiz' AND teacher_email = get_auth_email())
  ))
);

-- 18. Planner Table
DROP POLICY IF EXISTS "Planner: User Access" ON planner;
CREATE POLICY "Planner: User Access" ON planner FOR ALL USING (user_email = get_auth_email() OR is_admin());

-- 19. Study Sessions Table
DROP POLICY IF EXISTS "Study Sessions: User Access" ON study_sessions;
CREATE POLICY "Study Sessions: User Access" ON study_sessions FOR ALL USING (user_email = get_auth_email() OR is_admin());

-- 20. Certificates Table
DROP POLICY IF EXISTS "Certificates: User Access" ON certificates;
CREATE POLICY "Certificates: User Access" ON certificates FOR SELECT USING (
  student_email = get_auth_email() OR
  is_admin() OR
  (is_teacher() AND EXISTS (SELECT 1 FROM courses WHERE id = certificates.course_id AND teacher_email = get_auth_email()))
);

-- 21. Invites Table
DROP POLICY IF EXISTS "Invites: Manage for Admins" ON invites;
CREATE POLICY "Invites: Manage for Admins" ON invites FOR ALL USING (is_admin());
DROP POLICY IF EXISTS "Invites: Select for Signup" ON invites;
CREATE POLICY "Invites: Select for Signup" ON invites FOR SELECT USING (true);

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, postgres, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, postgres, service_role;

-- 10. Storage Initialization

INSERT INTO storage.buckets (id, name, public)
VALUES ('materials', 'materials', true), ('assignments', 'assignments', true), ('certificates', 'certificates', true)
ON CONFLICT (id) DO NOTHING;
