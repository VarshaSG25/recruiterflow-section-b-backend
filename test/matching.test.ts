import assert from 'node:assert';
import { queryRawAll, queryRawGet } from '../src/db/database.js';
import { seedDatabase } from '../src/db/seed.js';
import { calculateMatch, compareMatches, Candidate, Job } from '../src/matching/engine.js';

console.log('Running RecruiterBot Matching Engine Tests...\n');

// 1. Ensure DB seeded
seedDatabase();

// 2. Fetch Sherlock Holmes and Backend Detective
const sherlock = queryRawGet<Candidate>("SELECT * FROM candidates WHERE name LIKE 'Sherlock%'");
const backendJob = queryRawGet<Job>("SELECT * FROM jobs WHERE title = 'Backend Detective'");

assert(sherlock, 'Sherlock Holmes must exist');
assert(backendJob, 'Backend Detective job must exist');

const sherlockMatch = calculateMatch(sherlock, backendJob);
console.log(`Sherlock Holmes vs Backend Detective Score: ${sherlockMatch.score}/100`);
console.log(`Reason: ${sherlockMatch.reason}\n`);

assert(sherlockMatch.score >= 90, 'Sherlock must have score >= 90 for Backend Detective');
assert.strictEqual(sherlockMatch.missingSkills.length, 0, 'Sherlock should have 0 missing skills');

// 3. Test job matches ranking
const allCandidates = queryRawAll<Candidate>('SELECT * FROM candidates');
const rankedForBackendJob = allCandidates
  .map(c => calculateMatch(c, backendJob))
  .sort(compareMatches);

console.log(`Top match for Backend Detective: ${rankedForBackendJob[0].candidateName} (Score: ${rankedForBackendJob[0].score})`);
assert.strictEqual(rankedForBackendJob[0].candidateName, 'Sherlock H.', 'Sherlock H. must be top ranked candidate for Backend Detective');

// 4. Test reverse direction: Michael Scott matches
const michael = queryRawGet<Candidate>("SELECT * FROM candidates WHERE name LIKE 'Michael%'");
assert(michael, 'Michael Scott must exist');
const allJobs = queryRawAll<Job>('SELECT * FROM jobs');
const rankedJobsForMichael = allJobs
  .map(j => calculateMatch(michael, j))
  .sort(compareMatches);

console.log(`Top match for Michael Scott: ${rankedJobsForMichael[0].jobTitle} (Score: ${rankedJobsForMichael[0].score})`);
assert.strictEqual(rankedJobsForMichael[0].jobTitle, 'Sales Engineer', 'Top match for Michael Scott should be Sales Engineer');

console.log('\nAll Backend Matching Engine tests passed successfully!');
