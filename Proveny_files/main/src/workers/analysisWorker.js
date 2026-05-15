require("dotenv").config();

const { Worker } = require("bullmq");
const { getPrisma } = require("../config/prisma");
const { CONNECTION, enqueueEmail } = require("../config/queue");
const { runEnsembleAnalysis } = require("../engines/ensemble/ensembleAnalyzer");
const { submissionFlaggedEmailHtml } = require("../utils/emailTemplates");

async function processAnalysisJob(job) {
  const { submissionId } = job.data;
  const prisma = getPrisma();

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      assignment: { include: { course: true } },
      student: { select: { id: true, email: true, firstName: true } },
    },
  });
  if (!submission) throw new Error(`Submission ${submissionId} not found`);

  const existing = await prisma.analysisResult.findUnique({ where: { submissionId } });
  if (existing) return { skipped: true };

  const baseline = await prisma.baseline.findUnique({
    where: {
      studentId_courseId: {
        studentId: submission.studentId,
        courseId: submission.assignment.courseId,
      },
    },
  });
  if (!baseline) throw new Error(`Baseline not found for student ${submission.studentId}`);

  const result = await runEnsembleAnalysis({
    submission,
    baseline,
    assignment: submission.assignment,
    course: submission.assignment.course,
  });

  const analysisResult = await prisma.analysisResult.create({ data: result });
  await prisma.auditLog.create({
    data: {
      userId: submission.studentId,
      action: "ANALYSIS_COMPLETED",
      resourceType: "AnalysisResult",
      resourceId: analysisResult.id,
      newValue: { riskLevel: result.riskLevel, ensembleScore: result.ensembleScore },
    },
  });

  if (["FLAGGED", "CRITICAL"].includes(result.riskLevel)) {
    const course = await prisma.course.findUnique({
      where: { id: submission.assignment.courseId },
      include: { instructor: { select: { email: true, firstName: true } } },
    });
    if (course?.instructor) {
      await enqueueEmail({
        to: course.instructor.email,
        subject: `[SylLab] ${result.riskLevel} submission flagged - ${submission.assignment.title}`,
        html: submissionFlaggedEmailHtml({
          firstName: course.instructor.firstName,
          riskLevel: result.riskLevel,
          assignmentTitle: submission.assignment.title,
          ensembleScore: result.ensembleScore,
          submissionId,
        }),
      });
    }
  }
  return { analysisResultId: analysisResult.id, riskLevel: result.riskLevel };
}

const worker = new Worker("analysis", processAnalysisJob, {
  connection: CONNECTION,
  concurrency: Number(process.env.WORKER_CONCURRENCY || 5),
});

worker.on("completed", (job, result) => console.log(`[AnalysisWorker] Job ${job.id} completed`, result));
worker.on("failed", (job, err) => console.error(`[AnalysisWorker] Job ${job?.id} failed: ${err.message}`));

async function shutdown() {
  await worker.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
