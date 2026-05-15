const express = require("express");
const { z } = require("zod");
const { authRequired } = require("../../middleware/auth");
const { requireRole } = require("../../middleware/rbac");
const { getCohortReport, exportCourseReport } = require("./reports.service");

const cohortQuerySchema = z.object({
  courseId: z.string().uuid(),
  weekNumber: z.coerce.number().int().min(1).max(16),
});

const exportQuerySchema = z.object({
  courseId: z.string().uuid(),
  format: z.enum(["csv", "json"]).default("csv"),
});

function makeReportsRouter() {
  const router = express.Router();
  router.use(authRequired);
  router.use(requireRole("INSTRUCTOR", "ADMIN"));

  router.get("/cohort", async (req, res, next) => {
    try {
      const query = cohortQuerySchema.parse(req.query);
      return res.status(200).json(await getCohortReport({ actor: req.user, ...query }));
    } catch (e) {
      return next(e);
    }
  });

  router.get("/export", async (req, res, next) => {
    try {
      const { courseId, format } = exportQuerySchema.parse(req.query);
      const result = await exportCourseReport({ actor: req.user, courseId, format });
      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv");
        return res.status(200).send(result.data);
      }
      return res.status(200).json(result.data);
    } catch (e) {
      return next(e);
    }
  });

  return router;
}

module.exports = { makeReportsRouter };
