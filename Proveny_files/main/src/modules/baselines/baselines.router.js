const express = require("express");
const { authRequired } = require("../../middleware/auth");
const { requireRole } = require("../../middleware/rbac");
const { makeCodeUpload } = require("../../middleware/fileUpload");
const { badRequest } = require("../../utils/httpErrors");
const baselinesService = require("./baselines.service");

function makeBaselinesRouter({ maxFileSizeMb = 5 } = {}) {
  const router = express.Router();
  const upload = makeCodeUpload({ maxFileSizeMb });

  router.use(authRequired);

  router.post("/", requireRole("STUDENT"), upload.single("file"), async (req, res, next) => {
    try {
      const sessionCode = req.body?.sessionCode;
      if (!sessionCode) throw badRequest("sessionCode is required");
      if (!req.file?.buffer) throw badRequest("file is required");
      const baseline = await baselinesService.submitBaseline({
        actor: req.user,
        sessionCode,
        source: req.file.buffer.toString("utf-8"),
      });
      return res.status(201).json(baseline);
    } catch (e) {
      return next(e);
    }
  });

  router.get("/:studentId/:courseId", async (req, res, next) => {
    try {
      const baseline = await baselinesService.getBaseline({
        actor: req.user,
        studentId: req.params.studentId,
        courseId: req.params.courseId,
      });
      return res.status(200).json(baseline);
    } catch (e) {
      return next(e);
    }
  });

  return router;
}

module.exports = { makeBaselinesRouter };
