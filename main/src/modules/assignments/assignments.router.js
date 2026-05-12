const express = require("express");
const { authRequired } = require("../../middleware/auth");
const { requireRole } = require("../../middleware/rbac");
const { createAssignmentSchema } = require("./assignments.schema");
const assignmentsService = require("./assignments.service");

function parseIntParam(v, def) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
}

function makeAssignmentsRouter() {
  const router = express.Router();
  router.use(authRequired);

  router.get("/", async (req, res, next) => {
    try {
      const courseId = req.query.courseId;
      const weekNumber = req.query.weekNumber ? Number(req.query.weekNumber) : undefined;
      const page = parseIntParam(req.query.page, 1);
      const limit = Math.min(100, parseIntParam(req.query.limit, 20));

      const result = await assignmentsService.listAssignments({
        actor: req.user,
        courseId,
        weekNumber: Number.isFinite(weekNumber) ? weekNumber : undefined,
        page,
        limit,
      });
      return res.status(200).json(result);
    } catch (e) {
      return next(e);
    }
  });

  router.post("/", requireRole("INSTRUCTOR", "ADMIN"), async (req, res, next) => {
    try {
      const data = createAssignmentSchema.parse(req.body);
      const assignment = await assignmentsService.createAssignment({ actor: req.user, ...data });
      return res.status(201).json(assignment);
    } catch (e) {
      return next(e);
    }
  });

  return router;
}

module.exports = { makeAssignmentsRouter };

