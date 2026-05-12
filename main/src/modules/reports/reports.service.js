const { getPrisma } = require("../../config/prisma");
const { getCohortStats } = require("../../engines/cohort/cohortAnalyzer");
const { notFound, forbidden } = require("../../utils/httpErrors");

async function getCohortReport({ actor, courseId, weekNumber }) {
  const prisma = getPrisma();
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw notFound("Course not found");
  if (actor.role === "INSTRUCTOR" && course.instructorId !== actor.id) {
    throw forbidden("You can only view reports for your own courses");
  }
  return { courseId, weekNumber, ...(await getCohortStats({ courseId, weekNumber })) };
}

async function exportCourseReport({ actor, courseId, format }) {
  const prisma = getPrisma();
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw notFound("Course not found");
  if (actor.role === "INSTRUCTOR" && course.instructorId !== actor.id) {
    throw forbidden("You can only export reports for your own courses");
  }
  const submissions = await prisma.submission.findMany({
    where: { assignment: { courseId } },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, email: true } },
      assignment: { select: { title: true, weekNumber: true } },
      analysisResult: true,
    },
    orderBy: [{ assignment: { weekNumber: "asc" } }, { submittedAt: "asc" }],
  });
  const rows = submissions.map((s) => ({
    studentId: s.studentId,
    firstName: s.student.firstName,
    lastName: s.student.lastName,
    email: s.student.email,
    assignmentTitle: s.assignment.title,
    weekNumber: s.assignment.weekNumber,
    sophisticationScore: s.sophisticationScore,
    submittedAt: s.submittedAt.toISOString(),
    riskLevel: s.analysisResult?.riskLevel ?? "PENDING",
    ensembleScore: s.analysisResult?.ensembleScore ?? null,
    interviewOutcome: s.analysisResult?.interviewOutcome ?? "PENDING",
  }));
  if (format === "json") return { format, data: rows };
  const headers = Object.keys(rows[0] || { studentId: "", firstName: "", lastName: "", email: "" });
  const escape = (v) => (v === null || v === undefined ? "" : `"${String(v).replace(/"/g, '""')}"`);
  return { format: "csv", data: [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\r\n") };
}

module.exports = { getCohortReport, exportCourseReport };
