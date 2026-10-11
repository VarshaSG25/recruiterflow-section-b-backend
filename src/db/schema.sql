-- =====================================================================
-- RecruiterFlow Backend Take-Home Assignment
-- Part 1: Recruiter Bot Schema (Hand-written Raw DDL - NO ORM)
-- =====================================================================

DROP TABLE IF EXISTS candidate_matches;
DROP TABLE IF EXISTS candidates;
DROP TABLE IF EXISTS jobs;

-- Table: candidates
-- Ingests fictional candidate profiles with skills, experience, availability, traits, and quirks.
CREATE TABLE candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    skills TEXT NOT NULL,                  -- Comma-separated or serialized skills list
    experience_years INTEGER NOT NULL,     -- Total professional experience in years
    availability VARCHAR(50) NOT NULL,     -- 'Immediate', '2 weeks', 'Not looking'
    traits TEXT NOT NULL,                  -- Behavioral & personality traits
    quirk TEXT NOT NULL,                   -- Candidate's notable quirk
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: jobs
-- Ingests job openings with required skills, minimum experience, and culture keywords.
CREATE TABLE jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(100) NOT NULL,
    required_skills TEXT NOT NULL,         -- Comma-separated required skills
    min_experience INTEGER NOT NULL,       -- Minimum years of experience expected
    culture_keywords TEXT NOT NULL,        -- Company/team culture keywords
    tagline TEXT NOT NULL,                 -- Short engaging role tagline
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_candidates_experience ON candidates(experience_years);
CREATE INDEX idx_candidates_availability ON candidates(availability);
CREATE INDEX idx_jobs_min_experience ON jobs(min_experience);
