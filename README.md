# RecruiterBot — Backend Developer Assignment & SQL Detective

This directory contains the complete backend service (**Section B**) for the Recruiterflow Take-Home Assignment.

It consists of:
1. **Part 1 — The Recruiter Bot**: A backend matching service built with Node.js, TypeScript, Express, and raw SQLite (utilizing Node's native `DatabaseSync` engine without any ORMs or query builders).
2. **Part 2 — The SQL Detective Challenge**: Direct hand-written SQL queries in `sql_detective.sql` solving the hiring operations analytical puzzles.

---

## 🚀 How to Install and Run Locally

### Prerequisites
- Node.js (v18 or newer, v22+ recommended for native `node:sqlite`)
- npm (v9+)

### Installation
```bash
cd backend
npm install
```

### 1. Ingest / Seed Database
Initializes the SQLite database and seeds all 15 fictional candidate profiles and 6 job openings using raw SQL `CREATE TABLE` and `INSERT` statements:
```bash
npm run seed
```

### 2. Start the API Server
Starts the Express server on `http://localhost:4000`:
```bash
npm start
# or development mode with live watch:
npm run dev
```

### 3. Run the SQL Detective Challenge
Executes the analytical queries in `sql_detective.sql` against the hiring ops dataset and prints tabular verification:
```bash
npm run sql-detective
```

### 4. Run Automated Backend Tests
```bash
npm test
```

---

## 📡 API Endpoints & Example `curl` Commands

### 1. Match Candidates for a Job
Returns candidates ranked by matching score for a specified job opening:
```bash
curl http://localhost:4000/api/jobs/1/matches
```
*Example Response:*
```json
{
  "job": {
    "id": 1,
    "title": "Backend Detective",
    "required_skills": "deduction, pattern-recognition, forensics",
    "min_experience": 3
  },
  "matches": [
    {
      "candidateId": 1,
      "candidateName": "Sherlock H.",
      "score": 90,
      "scoreBreakdown": {
        "skillsScore": 45,
        "experienceScore": 25,
        "cultureScore": 10,
        "availabilityScore": 10
      },
      "reason": "Matches all 3 required skills (deduction, pattern-recognition, forensics). 8 yrs experience fulfills 3+ yr requirement (+5 yrs), and is immediately available. Personality note: \"Solves problems by eliminating the impossible; occasionally insufferable in standups.\""
    }
  ]
}
```

### 2. Match Jobs for a Candidate (Reverse Direction)
Returns jobs ranked by matching score for a specified candidate:
```bash
curl http://localhost:4000/api/candidates/11/matches
```
*(Shows Michael Scott matching with Sales Engineer as #1)*

### 3. Retrieve All Jobs / Candidates
```bash
curl http://localhost:4000/api/jobs
curl http://localhost:4000/api/candidates
```

### 4. Execute SQL Detective Online
```bash
curl http://localhost:4000/api/sql-detective/run
```

---

## 🧠 Architectural Decisions & Trade-Offs

### 1. Database & Raw SQL Constraint
- **No ORM Rule**: In accordance with the prompt's strict constraint (*"Raw SQL only — no ORM, query builder, or anything that generates SQL for you. Hand-written DDL and hand-written queries, full stop"*), we used Node's built-in `DatabaseSync` engine (`node:sqlite`).
- **Why this choice?**: `node:sqlite` comes bundled directly in modern Node.js, requires zero external binary compilation or C++ build tools on Windows/Linux/macOS, and gives absolute control over raw parameterized SQL (`db.prepare(...)`, `db.exec(...)`).
- **Data integrity**: Foreign keys and WAL journaling are enabled via explicit `PRAGMA` statements.

### 2. The Matching Algorithm
The matching algorithm balances predictive precision with explainability:

- **Skill Overlap (50% max)**:
  - Calculates the exact overlap between the job's required skills and the candidate's skills.
  - Full match grants 45 points; up to 5 additional bonus points are granted for complementary skills that provide breadth.
  - Missing core skills directly lowers the candidate's ceiling.
- **Experience Fit (25% max)**:
  - Compares candidate experience against minimum required experience.
  - Optimal band (meeting or exceeding by up to 12 years) receives full 25 points.
  - Deficits incur a progressive penalty of -8 points per year under the threshold.
  - Extreme seniority (>12 years above minimum) receives a subtle nuance score (22 pts) to reflect overqualification risks.
- **Culture & Trait Alignment (15% max)**:
  - Matches candidate traits with company culture keywords (e.g. `analytical`, `decisive`, `innovative`, `empathetic`).
  - Base baseline of 5 points + up to 10 points for exact alignment.
- **Availability Weighting (10% max)**:
  - `Immediate` candidates receive +10 points.
  - `2 weeks` notice receives +7 points.
  - `Not looking` passive candidates receive +2 points (indicating higher recruitment friction).
- **Explainability**: Rather than an opaque black-box score, every match produces a human-readable synthesis explaining skill alignment, years gap, availability status, and personality quirk considerations.

---

## 🔍 Part 2: The SQL Detective Highlights

The queries are organized in `sql_detective.sql`:
1. **Q1**: `INNER JOIN` between `job_postings` and `recruiters` filtered by `status = 'open'`.
2. **Q2**: `LEFT JOIN` counting distinct `applicant_id` at `stage = 'Final'`.
3. **Q3**: Cleaned duplicate applicant entities by normalizing emails via `LOWER(TRIM(email))`. Deduplicates Ananya Rao's dual entries (`ananya.rao@mail.com` and `Ananya.Rao@mail.com`), revealing that **Ananya Rao**, **Ben Turner**, and **Elena Popescu** all effectively applied to multiple jobs.
4. **Q4**: Calculates final-stage conversion rates `passed / total` grouped by recruiter, correctly filtering recruiters with at least 3 final-stage interviews using `HAVING COUNT(*) >= 3` (Priya Shah at 75%, Daniel Ortiz at 50%).
5. **Q5**: Employs `DENSE_RANK() OVER (PARTITION BY jp.department ORDER BY COUNT(*) DESC)` to determine top recruiters per department (Fatima Al-Sayed for Data, Priya Shah for Engineering).

---

## 🤖 Note on AI Usage
During development, AI was utilized as a brainstorming sounding-board to test candidate matching edge cases (e.g., verifying how Sheldon Cooper and Tony Stark should rank on collaborative vs technical jobs) and to quickly scaffold test assertions. All SQL queries, algorithm weighting constants, API routes, and schema implementations were authored, cross-checked, and verified locally.
