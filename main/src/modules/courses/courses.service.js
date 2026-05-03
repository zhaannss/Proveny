const { getPrisma } = require("../../config/prisma");
const { conflict, forbidden } = require("../../utils/httpErrors");

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

async function createCourse({ instructorId, name, code, weeklyTargets }) {
  const prisma = getPrisma();
  const existing = await prisma.course.findUnique({ where: { code } });
  if (existing) throw conflict("Course code already exists");

  const course = await prisma.course.create({
    data: { instructorId, name, code, weeklyTargets },
  });
  return toCourseResponse(course);
}

async function listCourses({ user }) {
  const prisma = getPrisma();

  if (user.role === "ADMIN") {
    const courses = await prisma.course.findMany({ orderBy: { createdAt: "desc" } });
    return courses.map(toCourseResponse);
  }

  if (user.role === "INSTRUCTOR") {
    const courses = await prisma.course.findMany({
      where: { instructorId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return courses.map(toCourseResponse);
  }

  // STUDENT/PROCTOR: by enrollment
  const enrollments = await prisma.courseEnrollment.findMany({
    where: { studentId: user.id },
    include: { course: true },
    orderBy: { enrolledAt: "desc" },
  });
  return enrollments.map((e) => toCourseResponse(e.course));
}

async function enrollStudent({ actor, courseId, studentId }) {
  const prisma = getPrisma();
  if (!["INSTRUCTOR", "ADMIN"].includes(actor.role)) throw forbidden("Only INSTRUCTOR/ADMIN can enroll");

  return prisma.courseEnrollment.create({
    data: { courseId, studentId },
  });
}

module.exports = { createCourse, listCourses, enrollStudent };

