const { getPrisma } = require("../../config/prisma");
const { sha256 } = require("../../utils/hash");
const { scoreSourceCode } = require("../../engines/ast/sophisticationScorer");
const { notFound, forbidden, conflict } = require("../../utils/httpErrors");
const sessionsService = require("../sessions/sessions.service");

function toBaselineResponse(b) {
  return {
    id: b.id,
    studentId: b.studentId,
    courseId: b.courseId,
    sessionId: b.sessionId,
    contentHash: b.contentHash,
    sophisticationScore: b.sophisticationScore,
    metrics: b.metrics,
    isLocked: b.isLocked,
    submittedAt: b.submittedAt,
  };
}

async function submitBaseline({ actor, sessionCode, source }) {
  const prisma = getPrisma();
  const session = await sessionsService.findActiveSessionByCode(sessionCode);

  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { courseId_studentId: { courseId: session.courseId, studentId: actor.id } },
  });
  if (!enrollment) throw forbidden("You are not enrolled in the course for this session");

  const contentHash = sha256(source);
  const hashConflict = await prisma.baseline.findUnique({ where: { contentHash } });
  if (hashConflict) throw conflict("Identical code already submitted as a baseline");

  const existing = await prisma.baseline.findUnique({
    where: { studentId_courseId: { studentId: actor.id, courseId: session.courseId } },
  });
  if (existing) throw conflict("You already have a baseline for this course");

  const { sophisticationScore, metrics } = scoreSourceCode(source);
  const baseline = await prisma.$transaction(async (tx) => {
    const created = await tx.baseline.create({
      data: {
        studentId: actor.id,
        courseId: session.courseId,
        sessionId: session.id,
        contentHash,
        rawCode: source,
        metrics,
        sophisticationScore,
        isLocked: false,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: "BASELINE_SUBMITTED",
        resourceType: "Baseline",
        resourceId: created.id,
        newValue: { sophisticationScore, sessionCode },
      },
    });
    return created;
  });

  return toBaselineResponse(baseline);
}

async function getBaseline({ actor, studentId, courseId }) {
  const prisma = getPrisma();
  const baseline = await prisma.baseline.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
  });
  if (!baseline) throw notFound("Baseline not found");

  if (actor.id !== studentId && actor.role !== "ADMIN") {
    if (actor.role === "INSTRUCTOR") {
      const course = await prisma.course.findUnique({ where: { id: courseId } });
      if (!course || course.instructorId !== actor.id) throw forbidden("Forbidden");
    } else if (actor.role === "PROCTOR") {
      const session = await prisma.proctoredSession.findUnique({ where: { id: baseline.sessionId } });
      if (!session || session.proctorId !== actor.id) throw forbidden("Forbidden");
    } else {
      throw forbidden("Forbidden");
    }
  }

  return toBaselineResponse(baseline);
}

module.exports = { submitBaseline, getBaseline };
