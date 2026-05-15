const { getPrisma } = require("../../config/prisma");
const { conflict, forbidden, notFound } = require("../../utils/httpErrors");

function toCourseResponse(c) {
  return {
    id: c.id,
    name: c.name,
    code: c.code,
    instructorId: c.instructorId,
    weeklyTargets: c.weeklyTargets,
    isActive: c.isActive,
    createdAt: c.createdAt,
  };
}

async function createCourse({ actor, instructorId, name, code, weeklyTargets }) {
  const prisma = getPrisma();
  const ownerId = actor.role === "ADMIN" ? instructorId || actor.id : actor.id;
  const existing = await prisma.course.findUnique({ where: { code } });
  if (existing) throw conflict("Course code already exists");

  if (actor.role !== "ADMIN" && instructorId && instructorId !== actor.id) {
    throw forbidden("Instructors can only create courses for themselves");
  }

  const instructor = await prisma.user.findUnique({ where: { id: ownerId } });
  if (!instructor || !["INSTRUCTOR", "ADMIN"].includes(instructor.role)) {
    throw notFound("Instructor not found");
  }

  const course = await prisma.course.create({
    data: { instructorId: ownerId, name, code, weeklyTargets },
  });
  return toCourseResponse(course);
}

async function listCourses({ user, page, limit }) {
  const prisma = getPrisma();
  const skip = (page - 1) * limit;

  if (user.role === "ADMIN") {
    const [total, courses] = await Promise.all([
      prisma.course.count(),
      prisma.course.findMany({ skip, take: limit, orderBy: { createdAt: "desc" } }),
    ]);
    return { data: courses.map(toCourseResponse), meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
  }

  if (user.role === "INSTRUCTOR") {
    const where = { instructorId: user.id };
    const [total, courses] = await Promise.all([
      prisma.course.count({ where }),
      prisma.course.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
    ]);
    return { data: courses.map(toCourseResponse), meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
  }

  const where = { studentId: user.id };
  const [total, enrollments] = await Promise.all([
    prisma.courseEnrollment.count({ where }),
    prisma.courseEnrollment.findMany({ where, skip, take: limit, include: { course: true }, orderBy: { enrolledAt: "desc" } }),
  ]);
  return { data: enrollments.map((e) => toCourseResponse(e.course)), meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

async function enrollStudent({ actor, courseId, studentId }) {
  const prisma = getPrisma();
  if (!["INSTRUCTOR", "ADMIN"].includes(actor.role)) throw forbidden("Only INSTRUCTOR/ADMIN can enroll");

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw notFound("Course not found");
  if (actor.role === "INSTRUCTOR" && course.instructorId !== actor.id) {
    throw forbidden("Cannot enroll students into another instructor's course");
  }

  const student = await prisma.user.findUnique({ where: { id: studentId } });
  if (!student) throw notFound("Student not found");
  if (student.role !== "STUDENT") throw conflict("Only STUDENT users can be enrolled in courses");

  const existing = await prisma.courseEnrollment.findUnique({
    where: { courseId_studentId: { courseId, studentId } },
  });
  if (existing) throw conflict("Student already enrolled in this course");

  return prisma.courseEnrollment.create({ data: { courseId, studentId } });
}

module.exports = { createCourse, listCourses, enrollStudent };
