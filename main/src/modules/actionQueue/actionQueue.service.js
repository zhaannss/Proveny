const { getPrisma } = require("../../config/prisma");
const { getEmailQueue, getAnalysisQueue, getMaintenanceQueue } = require("../../config/queue");
const { forbidden } = require("../../utils/httpErrors");

function toQueueItem(ar) {
  return {
    analysisId: ar.id,
    submissionId: ar.submissionId,
    riskLevel: ar.riskLevel,
    ensembleScore: ar.ensembleScore,
    trajectoryZScore: ar.trajectoryZScore,
    genealogyPenalty: ar.genealogyPenalty,
    cohortOutlierScore: ar.cohortOutlierScore,
    compressedWeeks: ar.compressedWeeks,
    interviewOutcome: ar.interviewOutcome,
    violations: ar.violations,
    analyzedAt: ar.analyzedAt,
    student: ar.submission.student,
    assignment: ar.submission.assignment,
  };
}

async function getActionQueue({ actor, courseId, riskLevel, interviewOutcome, page, limit, sort }) {
  if (!["INSTRUCTOR", "ADMIN"].includes(actor.role)) throw forbidden("Only INSTRUCTOR or ADMIN can access the action queue");
  const prisma = getPrisma();
  const where = {
    riskLevel: riskLevel || { in: ["MONITOR", "FLAGGED", "CRITICAL"] },
  };
  if (interviewOutcome) where.interviewOutcome = interviewOutcome;
  if (actor.role === "INSTRUCTOR") {
    where.submission = { assignment: { course: { instructorId: actor.id }, ...(courseId ? { courseId } : {}) } };
  } else if (courseId) {
    where.submission = { assignment: { courseId } };
  }

  let orderBy = { ensembleScore: "desc" };
  if (sort) {
    const dir = sort.startsWith("-") ? "desc" : "asc";
    orderBy = { [sort.replace(/^-/, "")]: dir };
  }

  const skip = (page - 1) * limit;
  const [total, rows] = await Promise.all([
    prisma.analysisResult.count({ where }),
    prisma.analysisResult.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        submission: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true, email: true } },
            assignment: { select: { id: true, title: true, weekNumber: true, courseId: true } },
          },
        },
      },
    }),
  ]);

  return { data: rows.map(toQueueItem), meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

async function getQueueJobStats({ actor }) {
  if (!["INSTRUCTOR", "ADMIN"].includes(actor.role)) throw forbidden("Only INSTRUCTOR or ADMIN can inspect queue status");
  const queues = [
    ["email", getEmailQueue()],
    ["analysis", getAnalysisQueue()],
    ["maintenance", getMaintenanceQueue()],
  ];
  const data = await Promise.all(
    queues.map(async ([name, queue]) => {
      const [counts, jobs] = await Promise.all([
        queue.getJobCounts("waiting", "active", "completed", "failed", "delayed", "paused"),
        queue.getJobs(["waiting", "active", "failed", "delayed"], 0, 9, false),
      ]);
      return {
        name,
        counts,
        recentJobs: jobs.map((job) => ({
          id: job.id,
          name: job.name,
          attemptsMade: job.attemptsMade,
          timestamp: new Date(job.timestamp).toISOString(),
          failedReason: job.failedReason || null,
        })),
      };
    })
  );
  return { data };
}

module.exports = { getActionQueue, getQueueJobStats };
