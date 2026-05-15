const { getPrisma } = require("../../config/prisma");
const { sha256 } = require("../../utils/hash");
const { scoreSourceCode } = require("../../engines/ast/sophisticationScorer");
const { notFound, forbidden, conflict } = require("../../utils/httpErrors");
const { enqueueAnalysis } = require("../../config/queue");

function toSubmissionResponse(s) {
  return {
    id: s.id,
    assignmentId: s.assignmentId,
    studentId: s.studentId,
    contentHash: s.contentHash,
    sophisticationScore: s.sophisticationScore,
    metrics: s.metrics,
    submittedAt: s.submittedAt,
    analysisStatus: s.analysisResult ? "COMPLETED" : "PENDING",
  };
}

async function submitAssignment({ actor, assignmentId, source }) {
  const prisma = getPrisma();
  if (actor.role !== "STUDENT") throw forbidden("Only students can submit assignments");

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { course: true },
  });
  if (!assignment) throw notFound(`Assignment '${assignmentId}' not found`);

  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { courseId_studentId: { courseId: assignment.courseId, studentId: actor.id } },
  });
  if (!enrollment) throw forbidden("You are not enrolled in this course");

  const baseline = await prisma.baseline.findUnique({
    where: { studentId_courseId: { studentId: actor.id, courseId: assignment.courseId } },
  });
  if (!baseline) throw forbidden("You must complete a proctored baseline session before submitting assignments");
  if (!baseline.isLocked) throw forbidden("Your proctored baseline must be locked before assignment submissions open");
  if (assignment.dueDate < new Date()) throw conflict("Assignment due date has passed");

  const contentHash = sha256(source);
  const { sophisticationScore, metrics } = scoreSourceCode(source);

  const submission = await prisma.$transaction(async (tx) => {
    const created = await tx.submission.create({
      data: {
        assignmentId,
        studentId: actor.id,
        rawCode: source,
        contentHash,
        metrics,
        sophisticationScore,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: "SUBMISSION_CREATED",
        resourceType: "Submission",
        resourceId: created.id,
        newValue: { sophisticationScore, assignmentId },
      },
    });
    return created;
  });

  await enqueueAnalysis({ submissionId: submission.id });
  return toSubmissionResponse(submission);
}

async function listSubmissions({ actor, assignmentId, studentId, riskLevel, page, limit, sort }) {
  const prisma = getPrisma();

  const where = {};
  if (assignmentId) where.assignmentId = assignmentId;
  if (actor.role === "STUDENT") {
    where.studentId = actor.id;
  } else if (studentId) {
    where.studentId = studentId;
  }
  if (riskLevel) where.analysisResult = { riskLevel };

  if (actor.role === "INSTRUCTOR") {
    where.assignment = { course: { instructorId: actor.id } };
  } else if (actor.role === "PROCTOR") {
    throw forbidden("Proctors cannot list assignment submissions");
  }

  let orderBy = { submittedAt: "desc" };
  if (sort) {
    const dir = sort.startsWith("-") ? "desc" : "asc";
    const field = sort.replace(/^-/, "");
    orderBy = { [field]: dir };
  }

  const skip = (page - 1) * limit;
  const [total, rows] = await Promise.all([
    prisma.submission.count({ where }),
    prisma.submission.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: { analysisResult: { select: { riskLevel: true } } },
    }),
  ]);

  return {
    data: rows.map(toSubmissionResponse),
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

module.exports = { submitAssignment, listSubmissions };
