const express = require("express");
const { authRequired } = require("../../middleware/auth");
const { requireRole } = require("../../middleware/rbac");
const { makeCodeUpload } = require("../../middleware/fileUpload");
const submissionsService = require("./submissions.service");

function parseIntParam(v, def) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
}

function makeSubmissionsRouter({ maxFileSizeMb = 5 } = {}) {
  const router = express.Router();
  const upload = makeCodeUpload({ maxFileSizeMb });

  router.use(authRequired);

  router.get("/", async (req, res, next) => {
    try {
      const page = parseIntParam(req.query.page, 1);
      const limit = Math.min(100, parseIntParam(req.query.limit, 20));

      const result = await submissionsService.listSubmissions({
        actor: req.user,
        assignmentId: req.query.assignmentId,
        studentId: req.query.studentId,
        page,
        limit,
      });
      return res.status(200).json(result);
    } catch (e) {
      return next(e);
    }
  });

  router.post("/", requireRole("STUDENT"), upload.single("file"), async (req, res, next) => {
    try {
      const assignmentId = req.body?.assignmentId;
      const source = req.file?.buffer?.toString("utf-8");
      const submission = await submissionsService.submitAssignment({ actor: req.user, assignmentId, source });
      return res.status(201).json(submission);
    } catch (e) {
      return next(e);
    }
  });

  return router;
}

module.exports = { makeSubmissionsRouter };

