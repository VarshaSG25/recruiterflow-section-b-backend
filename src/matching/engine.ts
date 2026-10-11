export interface Candidate {
  id: number;
  name: string;
  skills: string;
  experience_years: number;
  availability: 'Immediate' | '2 weeks' | 'Not looking' | string;
  traits: string;
  quirk: string;
}

export interface Job {
  id: number;
  title: string;
  required_skills: string;
  min_experience: number;
  culture_keywords: string;
  tagline: string;
}

export interface MatchResult {
  candidateId: number;
  candidateName: string;
  jobId: number;
  jobTitle: string;
  score: number; // 0 - 100
  scoreBreakdown: {
    skillsScore: number;      // max 50
    experienceScore: number;  // max 25
    cultureScore: number;     // max 15
    availabilityScore: number;// max 10
  };
  matchingSkills: string[];
  missingSkills: string[];
  matchingTraits: string[];
  experienceGap: number;
  reason: string;
}

function parseList(str: string): string[] {
  if (!str) return [];
  return str
    .split(',')
    .map(s => s.trim().toLowerCase().replace(/\s+/g, '-'))
    .filter(Boolean);
}

/**
 * Computes the deterministic match score and detailed explanation
 * between a candidate profile and a job opening.
 */
export function calculateMatch(candidate: Candidate, job: Job): MatchResult {
  const candidateSkills = parseList(candidate.skills);
  const requiredSkills = parseList(job.required_skills);
  const candidateTraits = parseList(candidate.traits);
  const cultureKeywords = parseList(job.culture_keywords);

  // 1. Skill Overlap (Weight: 50%)
  const matchingSkills = requiredSkills.filter(req => candidateSkills.includes(req));
  const missingSkills = requiredSkills.filter(req => !candidateSkills.includes(req));
  const skillRatio = requiredSkills.length > 0 ? matchingSkills.length / requiredSkills.length : 0;
  
  let skillsScore = Math.round(skillRatio * 45);
  // Complementary skill bonus (+5 max for rich diverse skillset)
  const nonRequiredSkills = candidateSkills.filter(s => !requiredSkills.includes(s));
  if (skillRatio > 0 && nonRequiredSkills.length > 0) {
    skillsScore += Math.min(5, nonRequiredSkills.length);
  }
  skillsScore = Math.min(50, skillsScore);

  // 2. Experience Fit (Weight: 25%)
  const expGap = candidate.experience_years - job.min_experience;
  let experienceScore = 25;
  if (expGap < 0) {
    // Under minimum experience: penalty proportional to deficit
    experienceScore = Math.max(0, 25 - Math.abs(expGap) * 8);
  } else if (expGap > 12) {
    // Highly senior / potential overqualification nuance
    experienceScore = 22;
  } else {
    // Optimal experience range
    experienceScore = 25;
  }

  // 3. Culture & Trait Fit (Weight: 15%)
  const matchingTraits = cultureKeywords.filter(kw => 
    candidateTraits.some(tr => tr === kw || tr.includes(kw) || kw.includes(tr))
  );
  const traitRatio = cultureKeywords.length > 0 ? matchingTraits.length / cultureKeywords.length : 0;
  const cultureScore = Math.round(5 + traitRatio * 10); // Baseline 5 for professional traits + up to 10 for exact match

  // 4. Availability Factor (Weight: 10%)
  let availabilityScore = 5;
  if (candidate.availability === 'Immediate') {
    availabilityScore = 10;
  } else if (candidate.availability === '2 weeks') {
    availabilityScore = 7;
  } else if (candidate.availability === 'Not looking') {
    availabilityScore = 2;
  }

  // Aggregate Score
  const totalScore = Math.min(100, Math.max(0, skillsScore + experienceScore + cultureScore + availabilityScore));

  // Synthesize concise, human-readable reason
  const skillReason = matchingSkills.length === requiredSkills.length
    ? `Matches all ${requiredSkills.length} required skills (${matchingSkills.join(', ')})`
    : matchingSkills.length > 0
    ? `Matches ${matchingSkills.length}/${requiredSkills.length} required skills (${matchingSkills.join(', ')})`
    : `Lacks required skills (${missingSkills.join(', ')})`;

  const expReason = expGap >= 0
    ? `${candidate.experience_years} yrs experience fulfills ${job.min_experience}+ yr requirement (+${expGap} yrs)`
    : `${candidate.experience_years} yrs experience is below the ${job.min_experience} yr requirement (${expGap} yrs)`;

  const availReason = candidate.availability === 'Immediate'
    ? 'immediately available'
    : candidate.availability === '2 weeks'
    ? 'available on 2 weeks notice'
    : 'currently not looking (passive outreach required)';

  const quirkNote = candidate.quirk ? ` Personality note: "${candidate.quirk}"` : '';

  const reason = `${skillReason}. ${expReason}, and is ${availReason}.${quirkNote}`;

  return {
    candidateId: candidate.id,
    candidateName: candidate.name,
    jobId: job.id,
    jobTitle: job.title,
    score: totalScore,
    scoreBreakdown: {
      skillsScore,
      experienceScore,
      cultureScore,
      availabilityScore,
    },
    matchingSkills,
    missingSkills,
    matchingTraits,
    experienceGap: expGap,
    reason,
  };
}

/**
 * Compare function for ranking matches
 */
export function compareMatches(a: MatchResult, b: MatchResult): number {
  if (b.score !== a.score) {
    return b.score - a.score;
  }
  // Tie-breaker 1: More matching skills
  if (b.matchingSkills.length !== a.matchingSkills.length) {
    return b.matchingSkills.length - a.matchingSkills.length;
  }
  // Tie-breaker 2: Closer experience fit
  return Math.abs(a.experienceGap) - Math.abs(b.experienceGap);
}
