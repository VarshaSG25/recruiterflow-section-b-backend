import express, { Request, Response } from 'express';
import cors from 'cors';
import { db, queryRawAll, queryRawGet } from './db/database.js';
import { seedDatabase } from './db/seed.js';
import { calculateMatch, compareMatches, Candidate, Job, MatchResult } from './matching/engine.js';
import { runSqlDetective } from './sql-detective/run.js';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

app.use(cors());
app.use(express.json());

// Initialize / ensure DB is seeded upon launch
try {
  const candidateCount = queryRawGet<{ count: number }>('SELECT count(*) as count FROM candidates');
  if (!candidateCount || candidateCount.count === 0) {
    console.log('[Startup] Seeding database with initial candidates and jobs...');
    seedDatabase();
  }
} catch {
  console.log('[Startup] Table not found, seeding database...');
  seedDatabase();
}

// Root landing page with interactive API documentation and link to Frontend UI
app.get('/', (_req: Request, res: Response) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>RecruiterBot API Server</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px 20px; display: flex; justify-content: center; }
        .card { max-width: 650px; width: 100%; background: #1e293b; border: 1px solid #334155; border-radius: 20px; padding: 32px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
        h1 { color: #818cf8; margin-top: 0; font-size: 24px; }
        p { color: #94a3b8; line-height: 1.6; font-size: 14px; }
        .btn { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 12px; font-weight: bold; text-decoration: none; margin: 16px 0; transition: background 0.2s; }
        .btn:hover { background: #4f46e5; }
        .endpoints { background: #0f172a; border-radius: 12px; padding: 16px; margin-top: 20px; border: 1px solid #334155; }
        .endpoint { margin: 8px 0; font-family: monospace; font-size: 13px; }
        .endpoint a { color: #38bdf8; text-decoration: none; }
        .endpoint a:hover { text-decoration: underline; }
        .badge { background: #334155; color: #cbd5e1; padding: 2px 8px; border-radius: 6px; font-size: 11px; margin-right: 8px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>🤖 RecruiterBot Backend API</h1>
        <p>This is the <strong>Backend API Service</strong> running on <strong>Port 4000</strong>.</p>
        <p>Looking for the <strong>visual website &amp; UI</strong>? Open the Frontend app running on Port 3000:</p>
        <a href="http://localhost:3000" class="btn">👉 Open Frontend UI (http://localhost:3000)</a>
        
        <div class="endpoints">
          <div style="font-weight: bold; color: #94a3b8; margin-bottom: 12px; font-size: 12px; text-transform: uppercase;">Available API Endpoints:</div>
          <div class="endpoint"><span class="badge">GET</span><a href="/jobs">/jobs</a> - List all 6 job openings</div>
          <div class="endpoint"><span class="badge">GET</span><a href="/jobs/1/matches">/jobs/1/matches</a> - Ranked candidates for Backend Detective</div>
          <div class="endpoint"><span class="badge">GET</span><a href="/candidates">/candidates</a> - List all 15 fictional candidates</div>
          <div class="endpoint"><span class="badge">GET</span><a href="/candidates/1/matches">/candidates/1/matches</a> - Ranked jobs for Sherlock Holmes</div>
          <div class="endpoint"><span class="badge">GET</span><a href="/sql-detective/run">/sql-detective/run</a> - Run SQL Detective queries</div>
        </div>
      </div>
    </body>
    </html>
  `);
});

/**
 * Health check
 */
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'RecruiterBot API', timestamp: new Date().toISOString() });
});

/**
 * POST /api/seed (or /seed) - Re-ingest initial dataset
 */
const handleSeed = (_req: Request, res: Response) => {
  try {
    seedDatabase();
    res.json({ message: 'Database successfully seeded with seed candidates and jobs.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to seed database', details: String(error) });
  }
};
app.post('/api/seed', handleSeed);
app.post('/seed', handleSeed);

/**
 * GET /api/jobs (or /jobs) - List all jobs
 */
const handleGetJobs = (_req: Request, res: Response) => {
  try {
    const jobs = queryRawAll<Job>('SELECT * FROM jobs ORDER BY id ASC');
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch jobs', details: String(error) });
  }
};
app.get('/api/jobs', handleGetJobs);
app.get('/jobs', handleGetJobs);

/**
 * GET /api/jobs/:id (or /jobs/:id) - Get single job
 */
const handleGetJobById = (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const job = queryRawGet<Job>('SELECT * FROM jobs WHERE id = ?', [id]);
    if (!job) {
      return res.status(404).json({ error: `Job with ID ${req.params.id} not found.` });
    }
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch job', details: String(error) });
  }
};
app.get('/api/jobs/:id', handleGetJobById);
app.get('/jobs/:id', handleGetJobById);

/**
 * GET /api/jobs/:id/matches (or /jobs/:id/matches)
 * Ranked candidates for a job with score and short reason
 */
const handleGetJobMatches = (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const job = queryRawGet<Job>('SELECT * FROM jobs WHERE id = ?', [id]);
    if (!job) {
      return res.status(404).json({ error: `Job with ID ${req.params.id} not found.` });
    }

    const candidates = queryRawAll<Candidate>('SELECT * FROM candidates');
    const matches: MatchResult[] = candidates
      .map(candidate => calculateMatch(candidate, job))
      .sort(compareMatches);

    res.json({
      job: {
        id: job.id,
        title: job.title,
        required_skills: job.required_skills,
        min_experience: job.min_experience,
        culture_keywords: job.culture_keywords,
        tagline: job.tagline,
      },
      matchCount: matches.length,
      matches,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to compute job matches', details: String(error) });
  }
};
app.get('/api/jobs/:id/matches', handleGetJobMatches);
app.get('/jobs/:id/matches', handleGetJobMatches);

/**
 * GET /api/candidates (or /candidates) - List all candidates
 */
const handleGetCandidates = (_req: Request, res: Response) => {
  try {
    const candidates = queryRawAll<Candidate>('SELECT * FROM candidates ORDER BY id ASC');
    res.json(candidates);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch candidates', details: String(error) });
  }
};
app.get('/api/candidates', handleGetCandidates);
app.get('/candidates', handleGetCandidates);

/**
 * GET /api/candidates/:id (or /candidates/:id) - Get single candidate
 */
const handleGetCandidateById = (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const candidate = queryRawGet<Candidate>('SELECT * FROM candidates WHERE id = ?', [id]);
    if (!candidate) {
      return res.status(404).json({ error: `Candidate with ID ${req.params.id} not found.` });
    }
    res.json(candidate);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch candidate', details: String(error) });
  }
};
app.get('/api/candidates/:id', handleGetCandidateById);
app.get('/candidates/:id', handleGetCandidateById);

/**
 * GET /api/candidates/:id/matches (or /candidates/:id/matches)
 * Ranked jobs for a candidate (reverse direction)
 */
const handleGetCandidateMatches = (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const candidate = queryRawGet<Candidate>('SELECT * FROM candidates WHERE id = ?', [id]);
    if (!candidate) {
      return res.status(404).json({ error: `Candidate with ID ${req.params.id} not found.` });
    }

    const jobs = queryRawAll<Job>('SELECT * FROM jobs');
    const matches: MatchResult[] = jobs
      .map(job => calculateMatch(candidate, job))
      .sort(compareMatches);

    res.json({
      candidate: {
        id: candidate.id,
        name: candidate.name,
        skills: candidate.skills,
        experience_years: candidate.experience_years,
        availability: candidate.availability,
        traits: candidate.traits,
        quirk: candidate.quirk,
      },
      matchCount: matches.length,
      matches,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to compute candidate matches', details: String(error) });
  }
};
app.get('/api/candidates/:id/matches', handleGetCandidateMatches);
app.get('/candidates/:id/matches', handleGetCandidateMatches);

/**
 * GET /api/sql-detective/run (or /sql-detective/run) - Run Part 2 SQL challenge
 */
const handleSqlDetectiveRun = (_req: Request, res: Response) => {
  try {
    const results = runSqlDetective();
    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to run SQL Detective queries', details: String(error) });
  }
};
app.get('/api/sql-detective/run', handleSqlDetectiveRun);
app.get('/sql-detective/run', handleSqlDetectiveRun);

// Start server
app.listen(PORT, () => {
  console.log(`[RecruiterBot] Server running at http://localhost:${PORT}`);
  console.log(`[RecruiterBot] Available endpoints:`);
  console.log(`  - GET  /jobs`);
  console.log(`  - GET  /jobs/:id/matches`);
  console.log(`  - GET  /candidates`);
  console.log(`  - GET  /candidates/:id/matches`);
  console.log(`  - POST /seed`);
  console.log(`  - GET  /sql-detective/run`);
});
