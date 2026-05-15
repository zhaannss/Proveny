require("dotenv").config();

const { Worker } = require("bullmq");
const { getPrisma } = require("../config/prisma");
const { CONNECTION, enqueueEmail, getMaintenanceQueue } = require("../config/queue");

const STALE_REVIEW_JOB = "stale-flag-review";

function staleReviewEmailHtml({ firstName, count }) {
  return `
    <h2>SylLab stale review reminder</h2>
    <p>Hello ${firstName},</p>
    <p>You have ${count} high-risk submissions pending review for more than seven days.</p>
  `;
}

async function ensureSchedules() {
  await getMaintenanceQueue().add(
    STALE_REVIEW_JOB,
    {},
    {
      jobId: STALE_REVIEW_JOB,
      repeat: { pattern: "0 9 * * 1" },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 100 },
    }
  );
}

async function processStaleFlagReview() {
  const prisma = getPrisma();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const staleResults = await prisma.analysisResult.findMany({
    where: {
      interviewOutcome: "PENDING",
      riskLevel: { in: ["MONITOR", "FLAGGED", "CRITICAL"] },
      analyzedAt: { lt: sevenDaysAgo },
    },
    include: {
      submission: {
        include: {
          assignment: {
            include: {
              course: { include: { instructor: { select: { id: true, email: true, firstName: true } } } },
            },
          },
        },
      },
    },
  });

  const byInstructor = new Map();
  for (const result of staleResults) {
    const instructor = result.submission.assignment.course.instructor;
    const current = byInstructor.get(instructor.id) || { instructor, count: 0 };
    current.count += 1;
    byInstructor.set(instructor.id, current);
  }
  for (const { instructor, count } of byInstructor.values()) {
    await enqueueEmail({
      to: instructor.email,
      subject: `[SylLab] ${count} stale high-risk submissions need review`,
      html: staleReviewEmailHtml({ firstName: instructor.firstName, count }),
    });
  }
  return { staleCount: staleResults.length, instructorsNotified: byInstructor.size };
}

ensureSchedules().catch((err) => {
  console.error("[MaintenanceWorker] Failed to schedule recurring jobs:", err);
  process.exit(1);
});

const worker = new Worker(
  "maintenance",
  async (job) => {
    if (job.name === STALE_REVIEW_JOB) return processStaleFlagReview();
    throw new Error(`Unknown maintenance job: ${job.name}`);
  },
  { connection: CONNECTION, concurrency: Number(process.env.WORKER_CONCURRENCY || 5) }
);

worker.on("completed", (job, result) => console.log(`[MaintenanceWorker] Job ${job.id} completed`, result));
worker.on("failed", (job, err) => console.error(`[MaintenanceWorker] Job ${job?.id} failed: ${err.message}`));

async function shutdown() {
  await worker.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
