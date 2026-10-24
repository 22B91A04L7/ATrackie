export function manualDraftKey(token, revision) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { userId } = JSON.parse(atob(payload));
    if (!/^[a-f\d]{24}$/i.test(userId)) return null;
    return `manual-edit:${userId}:${revision || 'new'}`;
  } catch { return null; }
}

export function validateManualJob(job) {
  for (const field of ['title', 'company', 'url', 'source']) {
    if (typeof job[field] !== 'string' || !job[field].trim()) return `${field} is required and cannot contain only spaces.`;
  }
  try {
    if (!['http:', 'https:'].includes(new URL(job.url).protocol)) throw new Error();
  } catch { return 'Application URL must start with http:// or https:// and be a valid address.'; }
  const limits = { title: 500, company: 500, source: 500, url: 8192, jobId: 500, location: 2000, salary: 2000, experience: 10000, education: 10000, description: 30000, jobDescription: 30000 };
  for (const [field, limit] of Object.entries(limits)) {
    if (job[field] != null && (typeof job[field] !== 'string' || job[field].length > limit)) return `${field} must be text of at most ${limit} characters.`;
  }
  for (const field of ['responsibilities', 'requiredSkills', 'preferredSkills']) {
    if (!Array.isArray(job[field]) || job[field].length > 100 || job[field].some(item => item.length > 2000)) return `${field}: use at most 100 items, each at most 2000 characters.`;
  }
  if (new TextEncoder().encode(JSON.stringify(job)).length > 100 * 1024) return 'These details are too large. Shorten the description or lists before saving (maximum 100 KB).';
  return '';
}
