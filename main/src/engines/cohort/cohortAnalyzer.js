const { getPrisma } = require("../../config/prisma");

function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

async function computeCohortOutlierScore({ courseId, weekNumber, submissionScore }) {
  const prisma = getPrisma();
  const rows = await prisma.submission.findMany({
    where: { assignment: { courseId, weekNumber } },
    select: { sophisticationScore: true },
  });
  const scores = rows.map((row) => row.sophisticationScore);
  if (scores.length < 3) return 0;
  const avg = mean(scores);
  const sd = stddev(scores);
  if (sd === 0) return 0;
  return Number(Math.max(0, (submissionScore - avg) / sd).toFixed(4));
}

async function getCohortStats({ courseId, weekNumber }) {
  const prisma = getPrisma();
  const rows = await prisma.submission.findMany({
    where: { assignment: { courseId, weekNumber } },
    select: { sophisticationScore: true },
  });
  const scores = rows.map((row) => row.sophisticationScore);
  const avg = mean(scores);
  const sd = stddev(scores);
  return {
    cohortSize: scores.length,
    avg: Number(avg.toFixed(4)),
    stddev: Number(sd.toFixed(4)),
    p10: Number(percentile(scores, 0.1).toFixed(4)),
    p50: Number(percentile(scores, 0.5).toFixed(4)),
    p90: Number(percentile(scores, 0.9).toFixed(4)),
    outlierThreshold: Number((avg + 2 * sd).toFixed(4)),
  };
}

module.exports = { mean, stddev, percentile, computeCohortOutlierScore, getCohortStats };
