const express = require("express");
const { authRequired } = require("../../middleware/auth");
const { requireRole } = require("../../middleware/rbac");
const { createCourseSchema } = require("./courses.schema");
const coursesService = require("./courses.service");

function parseIntParam(v, def) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
}

function makeCoursesRouter() {
  const router = express.Router();
  router.use(authRequired);

  router.get("/", async (req, res, next) => {
    try {
      const page = parseIntParam(req.query.page, 1);
      const limit = Math.min(100, parseIntParam(req.query.limit, 20));
      const result = await coursesService.listCourses({ user: req.user, page, limit });
      return res.status(200).json(result);
    } catch (e) {
      return next(e);
    }
  });

  router.post("/", requireRole("INSTRUCTOR", "ADMIN"), async (req, res, next) => {
    try {
      const data = createCourseSchema.parse(req.body);
      const course = await coursesService.createCourse({ actor: req.user, ...data });
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

