const { getPrisma } = require("../../config/prisma");
const { sha256 } = require("../../utils/hash");
const { scoreSourceCode } = require("../../engines/ast/sophisticationScorer");
const { notFound, forbidden } = require("../../utils/httpErrors");

function toSubmissionResponse(s) {
  return {
    id: s.id,
    assignmentId: s.assignmentId,
    studentId: s.studentId,
    contentHash: s.contentHash,
    sophisticationScore: s.sophisticationScore,
    metrics: s.metrics,
    submittedAt: s.submittedAt,
    analysisStatus: "PENDING",
  };
}

async function submitAssignment({ actor, assignmentId, source }) {
  const prisma = getPrisma();
  if (actor.role !== "STUDENT") throw forbidden("Student only");
  if (!assignmentId) throw notFound("assignmentId is required");
  if (!source) throw notFound("file is required");

  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw notFound(`Assignment with id '${assignmentId}' not found`);

  const baseline = await prisma.baseline.findUnique({
    where: { studentId_courseId: { studentId: actor.id, courseId: assignment.courseId } },
  });
  if (!baseline) throw forbidden("Student must have a baseline for this course before submitting");

  const contentHash = sha256(source);
  const { sophisticationScore, metrics } = scoreSourceCode(source);

  const submission = await prisma.submission.create({
    data: {
      assignmentId,
      studentId: actor.id,
      rawCode: source,
      contentHash,
      metrics,
      sophisticationScore,
    },
  });

  // AnalysisResult orchestration will be added next (core milestone).
  return toSubmissionResponse(submission);
}

async function listSubmissions({ actor, assignmentId, studentId, page, limit }) {
  const prisma = getPrisma();

  const where = {};
  if (assignmentId) where.assignmentId = assignmentId;
  if (studentId) where.studentId = studentId;

  if (actor.role === "STUDENT") {
    where.studentId = actor.id;
  }

  const skip = (page - 1) * limit;
  const [total, rows] = await Promise.all([
    prisma.submission.count({ where }),
    prisma.submission.findMany({ where, skip, take: limit, orderBy: { submittedAt: "desc" } }),
  ]);

  return {
    data: rows.map(toSubmissionResponse),
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

module.exports = { submitAssignment, listSubmissions };

