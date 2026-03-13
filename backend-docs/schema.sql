-- =============================================================================
-- CRUNCH FITNESS CLUB — PostgreSQL Database Schema
-- =============================================================================
-- Replaces Firebase Firestore + Firebase Auth
-- Designed for: Node.js + Express/Fastify + PostgreSQL (pg / Prisma / Drizzle)
-- Auth strategy: JWT (access token + refresh token)
-- File storage: Replace Firebase Storage with S3 / Cloudinary / local storage
-- Real-time chat: Use WebSockets (Socket.io) or Server-Sent Events (SSE)
-- =============================================================================

-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- =============================================================================
-- 1. USERS & ROLES
--    Replaces: Firebase Auth + `userRoles` collection
-- =============================================================================

CREATE TYPE user_role AS ENUM ('admin', 'trainer', 'client');

CREATE TABLE users (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  role          user_role   NOT NULL,
  name          VARCHAR(255),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Refresh tokens (one-per-user, rotated on each login)
CREATE TABLE refresh_tokens (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,  -- store bcrypt hash, not raw token
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- 2. TRAINERS
--    Replaces: `userRoles` trainerId field + trainerData namespace
--    One row per trainer; links to users table for auth
-- =============================================================================

CREATE TABLE trainers (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- 3. CLIENTS
--    Replaces: `trainerData/{trainerId}/clients` subcollection
--    user_id is nullable — a client row can exist before they have login access
-- =============================================================================

CREATE TYPE client_goal AS ENUM (
  'Fat Loss', 'Muscle Gain', 'Strength', 'Flexibility',
  'General Fitness', 'Rehabilitation', 'Weight Gain', 'Other'
);

CREATE TABLE clients (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainer_id  UUID         NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  user_id     UUID         UNIQUE REFERENCES users(id) ON DELETE SET NULL, -- nullable (no login yet)
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255),
  phone       VARCHAR(50),
  goal        client_goal  NOT NULL DEFAULT 'General Fitness',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- 4. BLOG POSTS
--    Replaces: `posts` collection
-- =============================================================================

CREATE TYPE post_category AS ENUM (
  'Fitness Tips', 'Nutrition', 'Workout Guide', 'Success Story', 'News'
);

CREATE TABLE posts (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        VARCHAR(500) NOT NULL,
  slug         VARCHAR(500) NOT NULL UNIQUE,
  excerpt      TEXT,
  content      TEXT,
  cover_image  TEXT,                        -- URL (S3 / Cloudinary)
  category     post_category NOT NULL DEFAULT 'Fitness Tips',
  author       VARCHAR(255)  NOT NULL DEFAULT 'Crunch Fitness Club',
  tags         TEXT[]        NOT NULL DEFAULT '{}',
  read_time    INTEGER       NOT NULL DEFAULT 1, -- minutes
  published    BOOLEAN       NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_posts_slug      ON posts(slug);
CREATE INDEX idx_posts_published ON posts(published, published_at DESC);


-- =============================================================================
-- 5. TEAM MEMBERS
--    Replaces: `teamMembers` collection
-- =============================================================================

CREATE TABLE team_members (
  id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             VARCHAR(255) NOT NULL,
  role             VARCHAR(255) NOT NULL,
  specialization   VARCHAR(255),
  experience       VARCHAR(100),
  bio              TEXT,
  image            TEXT,           -- URL
  instagram        VARCHAR(255),
  is_owner         BOOLEAN      NOT NULL DEFAULT FALSE,
  object_position  VARCHAR(50)  NOT NULL DEFAULT 'center',
  display_order    INTEGER      NOT NULL DEFAULT 0,
  visible          BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_team_order ON team_members(display_order ASC);


-- =============================================================================
-- 6. OFFERS & PROMOTIONS
--    Replaces: `offers` collection
-- =============================================================================

CREATE TYPE offer_color AS ENUM ('green', 'yellow', 'orange', 'red', 'blue', 'purple');

CREATE TABLE offers (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       VARCHAR(500) NOT NULL,
  description TEXT,
  badge       VARCHAR(100) NOT NULL DEFAULT '🔥 LIMITED TIME',
  color       offer_color  NOT NULL DEFAULT 'green',
  start_date  DATE         NOT NULL,
  end_date    DATE         NOT NULL,
  active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- 7. MEMBERSHIP PLANS
--    Replaces: `plans` collection
-- =============================================================================

CREATE TABLE membership_plans (
  id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  display_order  INTEGER      NOT NULL DEFAULT 0,
  duration       VARCHAR(50)  NOT NULL,              -- e.g. '1 Month', '3 Months'
  price          VARCHAR(50)  NOT NULL,              -- e.g. '₹3,000'
  original_price VARCHAR(50),
  description    TEXT,
  features       TEXT[]       NOT NULL DEFAULT '{}', -- e.g. ['Full gym access', 'Locker']
  ideal_for      VARCHAR(255),
  savings        VARCHAR(100),
  badge          VARCHAR(100),                       -- e.g. 'Most Popular'
  is_popular     BOOLEAN      NOT NULL DEFAULT FALSE,
  gradient       VARCHAR(255),                       -- Tailwind gradient class
  icon_name      VARCHAR(100),                       -- e.g. 'Crown', 'Sparkles'
  cta_text       VARCHAR(100) NOT NULL DEFAULT 'Get Started',
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_plans_order ON membership_plans(display_order ASC);


-- =============================================================================
-- 8. ENQUIRIES (Contact Form / Sales Leads)
--    Replaces: `enquiries` collection
-- =============================================================================

CREATE TYPE enquiry_status AS ENUM ('new', 'contacted', 'converted', 'closed');

CREATE TABLE enquiries (
  id           UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(255)   NOT NULL,
  email        VARCHAR(255),
  phone        VARCHAR(50),
  plan         VARCHAR(255),  -- selected plan or 'General Enquiry'
  message      TEXT,
  status       enquiry_status NOT NULL DEFAULT 'new',
  read         BOOLEAN        NOT NULL DEFAULT FALSE,
  submitted_at TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_enquiries_status      ON enquiries(status);
CREATE INDEX idx_enquiries_submitted   ON enquiries(submitted_at DESC);
CREATE INDEX idx_enquiries_unread      ON enquiries(read) WHERE read = FALSE;


-- =============================================================================
-- 9. DUTY ROSTER
--    Replaces: `duties` collection
-- =============================================================================

CREATE TYPE gym_area AS ENUM (
  'Cardio Zone', 'Powerlifting', 'CrossFit',
  'Yoga & Flexibility', 'Functional Training', 'Boxing', 'Floor Duty'
);

CREATE TYPE duty_shift AS ENUM (
  'Morning (6am – 2pm)', 'Evening (2pm – 10pm)', 'Full Day (6am – 10pm)'
);

CREATE TABLE duties (
  id           UUID       PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainer_id   UUID       NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  area         gym_area   NOT NULL,
  days         TEXT[]     NOT NULL DEFAULT '{}', -- ['Monday', 'Wednesday']
  shift        duty_shift NOT NULL,
  week_start   DATE       NOT NULL,              -- Monday of the week (ISO)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_duties_trainer    ON duties(trainer_id);
CREATE INDEX idx_duties_week_start ON duties(week_start);


-- =============================================================================
-- 10. CLASS SESSIONS (Group Fitness Classes)
--     Replaces: `classSessions` collection
-- =============================================================================

CREATE TABLE class_sessions (
  id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainer_id     UUID         NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  title          VARCHAR(255) NOT NULL,
  area           VARCHAR(255),
  date           DATE         NOT NULL,
  start_time     TIME         NOT NULL,  -- stored as TIME, e.g. 06:00
  duration       INTEGER      NOT NULL,  -- minutes
  capacity       INTEGER      NOT NULL DEFAULT 20,
  pin            VARCHAR(10)  NOT NULL,  -- 6-digit check-in code
  pin_valid_from TIMESTAMPTZ  NOT NULL,  -- 30 min before class
  pin_valid_to   TIMESTAMPTZ  NOT NULL,  -- 30 min after class ends
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_class_sessions_trainer ON class_sessions(trainer_id);
CREATE INDEX idx_class_sessions_date    ON class_sessions(date);


-- =============================================================================
-- 11. ATTENDANCE (Class Check-ins via PIN)
--     Replaces: `attendance` collection
-- =============================================================================

CREATE TABLE attendance (
  id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_session_id UUID         NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  member_name      VARCHAR(255) NOT NULL,
  member_phone     VARCHAR(50)  NOT NULL,
  checked_in_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- prevent duplicate check-ins to the same session from the same phone
  UNIQUE (class_session_id, member_phone)
);

CREATE INDEX idx_attendance_session ON attendance(class_session_id);


-- =============================================================================
-- 12. PT SESSIONS (1-on-1 Personal Training)
--     Replaces: `trainerData/{trainerId}/sessions` subcollection
-- =============================================================================

CREATE TYPE pt_session_status AS ENUM ('scheduled', 'completed', 'cancelled', 'no-show');

CREATE TABLE pt_sessions (
  id          UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainer_id  UUID              NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  client_id   UUID              NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date        DATE              NOT NULL,
  time        TIME              NOT NULL,
  duration    INTEGER           NOT NULL DEFAULT 60, -- minutes
  status      pt_session_status NOT NULL DEFAULT 'scheduled',
  notes       TEXT,
  created_at  TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pt_sessions_trainer ON pt_sessions(trainer_id, date DESC);
CREATE INDEX idx_pt_sessions_client  ON pt_sessions(client_id, date DESC);


-- =============================================================================
-- 13. WORKOUT PLANS
--     Replaces: `trainerData/{trainerId}/workoutPlans` subcollection
-- =============================================================================

CREATE TABLE workout_plans (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainer_id  UUID         NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Exercises inside a plan (replaces the embedded `exercises` array)
CREATE TABLE exercises (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_plan_id UUID         NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  sets            INTEGER,
  reps            VARCHAR(50),  -- '10' or '8-12'
  notes           TEXT,
  display_order   INTEGER      NOT NULL DEFAULT 0
);

CREATE INDEX idx_exercises_plan ON exercises(workout_plan_id, display_order);

-- Which clients are assigned a plan (many-to-many)
CREATE TABLE workout_plan_assignments (
  workout_plan_id  UUID NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  assigned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workout_plan_id, client_id)
);


-- =============================================================================
-- 14. PROGRESS LOGS
--     Replaces: `trainerData/{trainerId}/clients/{clientId}/progressLogs`
-- =============================================================================

CREATE TABLE progress_logs (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id   UUID         NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  trainer_id  UUID         NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  date        DATE         NOT NULL,
  notes       TEXT,
  weight      NUMERIC(6,2), -- kg
  body_fat    NUMERIC(5,2), -- %
  waist       NUMERIC(5,1), -- cm
  chest       NUMERIC(5,1), -- cm
  arms        NUMERIC(5,1), -- cm
  thigh       NUMERIC(5,1), -- cm
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_progress_client ON progress_logs(client_id, date DESC);


-- =============================================================================
-- 15. TRAINER AVAILABILITY
--     Replaces: `trainerData/{trainerId}/availability` subcollection
-- =============================================================================

CREATE TYPE day_of_week AS ENUM (
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
);

CREATE TABLE trainer_availability (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainer_id  UUID        NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  day         day_of_week NOT NULL,
  start_time  TIME        NOT NULL,
  end_time    TIME        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- one slot per day per trainer
  UNIQUE (trainer_id, day)
);

CREATE INDEX idx_availability_trainer ON trainer_availability(trainer_id);


-- =============================================================================
-- 16. SESSION REQUESTS (Client → Trainer booking requests)
--     Replaces: `trainerData/{trainerId}/sessionRequests` subcollection
-- =============================================================================

CREATE TYPE request_status AS ENUM ('pending', 'confirmed', 'rejected');

CREATE TABLE session_requests (
  id              UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainer_id      UUID           NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  client_id       UUID           NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  requested_date  DATE           NOT NULL,
  requested_time  TIME           NOT NULL,
  duration        INTEGER        NOT NULL DEFAULT 60, -- minutes
  notes           TEXT,
  status          request_status NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_requests_trainer ON session_requests(trainer_id, status);
CREATE INDEX idx_requests_client  ON session_requests(client_id);


-- =============================================================================
-- 17. CONVERSATIONS & MESSAGES (Trainer ↔ Client Chat)
--     Replaces: `conversations/{trainerId}_{clientId}/messages` subcollection
-- =============================================================================

CREATE TABLE conversations (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainer_id  UUID        NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  client_id   UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- one conversation per trainer-client pair
  UNIQUE (trainer_id, client_id)
);

CREATE TABLE messages (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID         NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_name     VARCHAR(255) NOT NULL,
  text            TEXT         NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at ASC);


-- =============================================================================
-- UTILITY: auto-update updated_at columns
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables that have updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','clients','trainers','posts','team_members','offers',
    'membership_plans','duties','class_sessions','pt_sessions',
    'workout_plans','session_requests'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t
    );
  END LOOP;
END;
$$;
