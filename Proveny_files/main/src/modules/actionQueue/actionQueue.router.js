const express = require("express");
const { z } = require("zod");
const { authRequired } = require("../../middleware/auth");
const { requireRole } = require("../../middleware/rbac");
const { getActionQueue, getQueueJobStats } = require("./actionQueue.service");

const querySchema = z.object({
  courseId: z.string().uuid().optional(),
  riskLevel: z.enum(["MONITOR", "FLAGGED", "CRITICAL"]).optional(),
  interviewOutcome: z.enum(["PENDING", "CLEARED", "CONFIRMED_AI", "ESCALATED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
});

function makeActionQueueRouter() {
  const router = express.Router();
  router.use(authRequired);
  router.use(requireRole("INSTRUCTOR", "ADMIN"));

  router.get("/jobs", async (req, res, next) => {
    try {
      const result = await getQueueJobStats({ actor: req.user });
      return res.status(200).json(result);
    } catch (e) {
      return next(e);
    }
  });

  router.get("/", async (req, res, next) => {
    try {
      const query = querySchema.parse(req.query);
      const result = await getActionQueue({ actor: req.user, ...query });
      return res.status(200).json(result);
    } catch (e) {
      return next(e);
    }
  });

  return router;
}

module.exports = { makeActionQueueRouter };
