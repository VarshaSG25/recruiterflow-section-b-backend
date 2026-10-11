import { queryRawAll, queryRawGet } from './db/database.js';
import { Candidate, Job, calculateMatch, compareMatches } from './matching/engine.js';
import { seedDatabase } from './db/seed.js';

// Ensure database is populated
try {
  const count = queryRawGet<{ count: number }>('SELECT count(*) as count FROM candidates');
  if (!count || count.count === 0) {
    seedDatabase();
  }
} catch {
  seedDatabase();
}

console.log('\n====================================================================================================================');
console.log('RECRUITERFLOW SECTION B: SEED DATA — CANDIDATES TABLE (AS SHOWN IN PDF)');
console.log('====================================================================================================================\n');

// 1. Fetch Candidates and format exactly as PDF table
const rawCandidates = queryRawAll<Candidate>('SELECT * FROM candidates ORDER BY id ASC');
const formattedCandidates = rawCandidates.map(c => ({
  'ID': c.id,
  'Name': c.name,
  'Skills': c.skills,
  'Experience (yrs)': c.experience_years,
  'Availability': c.availability,
  'Traits': c.traits,
  'Quirk': c.quirk,
}));

console.table(formattedCandidates);

console.log('\n====================================================================================================================');
console.log('RECRUITERFLOW SECTION B: SEED DATA — JOBS TABLE (AS SHOWN IN PDF)');
console.log('====================================================================================================================\n');

// 2. Fetch Jobs and format exactly as PDF table
const rawJobs = queryRawAll<Job>('SELECT * FROM jobs ORDER BY id ASC');
const formattedJobs = rawJobs.map(j => ({
  'ID': j.id,
  'Title': j.title,
  'Required Skills': j.required_skills,
  'Min Experience': j.min_experience,
  'Culture Keywords': j.culture_keywords,
  'Tagline': j.tagline,
}));

console.table(formattedJobs);

console.log('\n====================================================================================================================');
console.log('RECRUITERFLOW SECTION B: MATCH RESULTS — RANKED CANDIDATES FOR "Backend Detective" (JOB #1)');
console.log('====================================================================================================================\n');

// 3. Match Candidates for Job #1 (Backend Detective)
const job1 = queryRawGet<Job>('SELECT * FROM jobs WHERE id = 1');
if (job1) {
  const matches = rawCandidates
    .map(c => calculateMatch(c, job1))
    .sort(compareMatches);

  const formattedMatches = matches.map((m, idx) => ({
    'Rank': `#${idx + 1}`,
    'Candidate Name': m.candidateName,
    'Score': `${m.score}/100`,
    'Matched Skills': m.matchingSkills.join(', ') || 'none',
    'Skills Pts': `${m.scoreBreakdown.skillsScore}/50`,
    'Exp Pts': `${m.scoreBreakdown.experienceScore}/25`,
    'Culture Pts': `${m.scoreBreakdown.cultureScore}/15`,
    'Avail Pts': `${m.scoreBreakdown.availabilityScore}/10`,
    'Reason': m.reason,
  }));

  console.table(formattedMatches.slice(0, 5));
}

console.log('\n====================================================================================================================');
console.log('RECRUITERFLOW SECTION B: MATCH RESULTS — RANKED JOBS FOR "Michael S." (CANDIDATE #11)');
console.log('====================================================================================================================\n');

// 4. Match Jobs for Candidate (Michael S.)
const candidateMichael = queryRawGet<Candidate>("SELECT * FROM candidates WHERE name LIKE 'Michael%' LIMIT 1");
if (candidateMichael) {
  const jobMatches = rawJobs
    .map(j => calculateMatch(candidateMichael, j))
    .sort(compareMatches);

  const formattedJobMatches = jobMatches.map((m, idx) => ({
    'Rank': `#${idx + 1}`,
    'Job Title': m.jobTitle,
    'Score': `${m.score}/100`,
    'Matched Skills': m.matchingSkills.join(', ') || 'none',
    'Skills Pts': `${m.scoreBreakdown.skillsScore}/50`,
    'Exp Pts': `${m.scoreBreakdown.experienceScore}/25`,
    'Culture Pts': `${m.scoreBreakdown.cultureScore}/15`,
    'Avail Pts': `${m.scoreBreakdown.availabilityScore}/10`,
    'Reason': m.reason,
  }));

  console.table(formattedJobMatches);
}

console.log('\n');
