const { getPrisma } = require("../../config/prisma");
const { notFound, forbidden } = require("../../utils/httpErrors");

function toAssignmentResponse(a) {
  return {
    id: a.id,
    courseId: a.courseId,
    title: a.title,
    weekNumber: a.weekNumber,
    expectedScore: a.expectedScore,
    dueDate: a.dueDate,
    createdAt: a.createdAt,
  };
}

async function createAssignment({ actor, courseId, title, weekNumber, expectedScore, dueDate }) {
  const prisma = getPrisma();
  if (!["INSTRUCTOR", "ADMIN"].includes(actor.role)) throw forbidden("Only INSTRUCTOR/ADMIN can perform this action");

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw notFound(`Course with id '${courseId}' not found`);
  if (actor.role === "INSTRUCTOR" && course.instructorId !== actor.id) {
    throw forbidden("Cannot create assignments for another instructor's course");
  }

  const a = await prisma.assignment.create({
    data: {
      courseId,
      title,
      weekNumber,
      expectedScore,
      dueDate: new Date(dueDate),
    },
  });
  return toAssignmentResponse(a);
}

async function listAssignments({ actor, courseId, weekNumber, page, limit }) {
  const prisma = getPrisma();

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw notFound(`Course with id '${courseId}' not found`);

  // Students can only view assignments if enrolled.
  if (actor.role === "STUDENT") {
    const enrollment = await prisma.courseEnrollment.findUnique({
      where: { courseId_studentId: { courseId, studentId: actor.id } },
    });
    if (!enrollment) throw forbidden("Not enrolled in this course");
  }

  if (actor.role === "INSTRUCTOR" && course.instructorId !== actor.id) {
    throw forbidden("Forbidden");
  }

  const where = { courseId };
  if (typeof weekNumber === "number") where.weekNumber = weekNumber;

  const skip = (page - 1) * limit;
  const [total, rows] = await Promise.all([
    prisma.assignment.count({ where }),
    prisma.assignment.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
  ]);

  return {
    data: rows.map(toAssignmentResponse),
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

module.exports = { createAssignment, listAssignments };

