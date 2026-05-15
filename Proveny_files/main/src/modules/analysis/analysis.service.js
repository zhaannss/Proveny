const { getPrisma } = require("../../config/prisma");
const { notFound, forbidden, badRequest } = require("../../utils/httpErrors");
const { enqueueEmail } = require("../../config/queue");
const { interviewOutcomeEmailHtml } = require("../../utils/emailTemplates");

const ALLOWED_OUTCOMES = ["CLEARED", "CONFIRMED_AI", "ESCALATED"];

function toAnalysisResponse(r) {
  return {
    id: r.id,
    submissionId: r.submissionId,
    trajectoryZScore: r.trajectoryZScore,
    genealogyPenalty: r.genealogyPenalty,
    cohortOutlierScore: r.cohortOutlierScore,
    ensembleScore: r.ensembleScore,
    riskLevel: r.riskLevel,
    compressedWeeks: r.compressedWeeks,
    violations: r.violations,
    llmGuidance: r.llmGuidance,
    interviewOutcome: r.interviewOutcome,
    interviewNotes: r.interviewNotes,
    analyzedAt: r.analyzedAt,
    reviewedAt: r.reviewedAt,
  };
}

async function getAnalysisResult({ actor, submissionId }) {
  const prisma = getPrisma();
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      analysisResult: true,
      assignment: { select: { course: { select: { instructorId: true } } } },
    },
  });
  if (!submission) throw notFound(`Submission '${submissionId}' not found`);
  if (actor.role === "STUDENT") {
    if (submission.studentId !== actor.id) throw forbidden("You can only view your own analysis results");
  } else if (actor.role === "INSTRUCTOR") {
    if (submission.assignment.course.instructorId !== actor.id) throw forbidden("Forbidden");
  } else if (actor.role !== "ADMIN") {
    throw forbidden("Forbidden");
  }
  if (!submission.analysisResult) throw notFound("Analysis not yet available. The job may still be processing.");
  return toAnalysisResponse(submission.analysisResult);
}

async function recordOutcome({ actor, submissionId, outcome, notes }) {
  if (!["INSTRUCTOR", "ADMIN"].includes(actor.role)) throw forbidden("Only INSTRUCTOR or ADMIN can record interview outcomes");
  if (!ALLOWED_OUTCOMES.includes(outcome)) throw badRequest(`outcome must be one of: ${ALLOWED_OUTCOMES.join(", ")}`);

  const prisma = getPrisma();
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      analysisResult: true,
      assignment: { select: { title: true, courseId: true } },
      student: { select: { email: true, firstName: true } },
    },
  });
  if (!submission) throw notFound(`Submission '${submissionId}' not found`);
  if (!submission.analysisResult) throw notFound("Analysis result not found for this submission");

  if (actor.role === "INSTRUCTOR") {
    const course = await prisma.course.findUnique({ where: { id: submission.assignment.courseId } });
    if (!course || course.instructorId !== actor.id) throw forbidden("You can only record outcomes for your own courses");
  }

  const updated = await prisma.analysisResult.update({
    where: { submissionId },
    data: { interviewOutcome: outcome, interviewNotes: notes || null, reviewedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "INTERVIEW_OUTCOME_RECORDED",
      resourceType: "AnalysisResult",
      resourceId: updated.id,
      newValue: { outcome, notes: notes || null },
    },
  });

  await enqueueEmail({
    to: submission.student.email,
    subject: `[SylLab] Your interview outcome - ${submission.assignment.title}`,
    html: interviewOutcomeEmailHtml({
      firstName: submission.student.firstName,
      outcome,
      assignmentTitle: submission.assignment.title,
      notes,
    }),
  });

  return toAnalysisResponse(updated);
}

module.exports = { getAnalysisResult, recordOutcome };
