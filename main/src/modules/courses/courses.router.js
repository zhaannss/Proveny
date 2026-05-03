const express = require("express");
const { authRequired } = require("../../middleware/auth");
const { requireRole } = require("../../middleware/rbac");
const { createCourseSchema } = require("./courses.schema");
const coursesService = require("./courses.service");

function makeCoursesRouter() {
  const router = express.Router();
  router.use(authRequired);

  router.get("/", async (req, res, next) => {
    try {
      const courses = await coursesService.listCourses({ user: req.user });
      return res.status(200).json({
        data: courses,
        meta: { page: 1, limit: courses.length, total: courses.length, totalPages: 1 },
      });
    } catch (e) {
      return next(e);
    }
  });

  router.post("/", requireRole("INSTRUCTOR"), async (req, res, next) => {
    try {
      const data = createCourseSchema.parse(req.body);
      const course = await coursesService.createCourse({ instructorId: req.user.id, ...data });
      return res.status(201).json(course);
    } catch (e) {
      return next(e);
    }
  });

  router.post("/:courseId/enroll", requireRole("INSTRUCTOR", "ADMIN"), async (req, res, next) => {
    try {
      const { courseId } = req.params;
      const studentId = req.body?.studentId;
      const enrollment = await coursesService.enrollStudent({
        actor: req.user,
        courseId,
        studentId,
      });
      return res.status(201).json(enrollment);
    } catch (e) {
      return next(e);
    }
  });

  return router;
}

module.exports = { makeCoursesRouter };

