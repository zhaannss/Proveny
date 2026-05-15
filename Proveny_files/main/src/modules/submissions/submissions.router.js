const express = require("express");
const { z } = require("zod");
const { authRequired } = require("../../middleware/auth");
const { makeCodeUpload } = require("../../middleware/fileUpload");
const { badRequest } = require("../../utils/httpErrors");
const submissionsService = require("./submissions.service");

const listQuerySchema = z.object({
  assignmentId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  riskLevel: z.enum(["NORMAL", "MONITOR", "FLAGGED", "CRITICAL"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
});

function makeSubmissionsRouter({ maxFileSizeMb = 5 } = {}) {
  const router = express.Router();
  const upload = makeCodeUpload({ maxFileSizeMb });

  router.use(authRequired);

  router.get("/", async (req, res, next) => {
    try {
      const query = listQuerySchema.parse(req.query);
      const result = await submissionsService.listSubmissions({
        actor: req.user,
        ...query,
      });
      return res.status(200).json(result);
    } catch (e) {
      return next(e);
    }
  });

  router.post("/", upload.single("file"), async (req, res, next) => {
    try {
      const assignmentId = req.body?.assignmentId;
      if (!assignmentId) throw badRequest("assignmentId is required");
      if (!req.file?.buffer) throw badRequest("file is required");
      const submission = await submissionsService.submitAssignment({
        actor: req.user,
        assignmentId,
        source: req.file.buffer.toString("utf-8"),
      });
      return res.status(201).json(submission);
    } catch (e) {
      return next(e);
    }
  });

  return router;
}

module.exports = { makeSubmissionsRouter };

