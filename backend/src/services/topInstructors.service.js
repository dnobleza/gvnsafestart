const ratingRepository = require('../repositories/rating.repository');
const instructorRepository = require('../repositories/instructor.repository');

const MIN_RATINGS = 3;
const TOP = 5;
const COMMENT_MAX = 120;
const CACHE_MS = 10 * 60000;

let cache = null;

const shorten = (text) => {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= COMMENT_MAX ? clean : `${clean.slice(0, COMMENT_MAX - 1).trimEnd()}…`;
};

const branchName = (instructor) => {
  const branch = instructor.instructorProfile && instructor.instructorProfile.branch;
  return branch ? { name: branch.name } : null;
};

// Public, so only what a landing page needs: no email, phone, address or
// anything about who wrote the ratings.
const load = async () => {
  const ranked = await ratingRepository.topRated({ minCount: MIN_RATINGS });
  if (!ranked.length) return [];
  const ids = ranked.map((r) => r.instructorId);
  const [people, comments] = await Promise.all([
    instructorRepository.findManyByIds(ids),
    ratingRepository.latestVisibleComments(ids),
  ]);
  const byId = new Map(people.filter((p) => p.isActive).map((p) => [p.id, p]));
  const commentOf = new Map(comments.map((c) => [c.instructorId, c.comment]));

  return ranked
    .filter((r) => byId.has(r.instructorId))
    .map((r) => ({ ...r, instructor: byId.get(r.instructorId) }))
    .sort(
      (a, b) =>
        b.average - a.average || b.count - a.count || a.instructor.fullName.localeCompare(b.instructor.fullName),
    )
    .slice(0, TOP)
    .map((r) => ({
      id: r.instructorId,
      fullName: r.instructor.fullName,
      branch: branchName(r.instructor),
      average: Math.round(r.average * 10) / 10,
      count: r.count,
      comment: commentOf.has(r.instructorId) ? shorten(commentOf.get(r.instructorId)) : null,
    }));
};

const list = async (now = Date.now()) => {
  if (!cache || now - cache.at > CACHE_MS) cache = { at: now, value: await load() };
  return cache.value;
};

const clearCache = () => {
  cache = null;
};

module.exports = { list, clearCache, MIN_RATINGS, TOP };
