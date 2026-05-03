const express = require("express");
const { authRequired } = require("../../middleware/auth");
const { requireRole } = require("../../middleware/rbac");
const { makeCodeUpload } = require("../../middleware/fileUpload");
const { getPrisma } = require("../../config/prisma");
const { sha256 } = require("../../utils/hash");
const { scoreSourceCode } = require("../../engines/ast/sophisticationScorer");
const sessionsService = require("../sessions/sessions.service");
const { forbidden, notFound } = require("../../utils/httpErrors");

function toBaselineResponse(b) {
  return {
    id: b.id,
    studentId: b.studentId,
    courseId: b.courseId,
    sessionId: b.sessionId,
    contentHash: b.contentHash,
    sophisticationScore: b.sophisticationScore,
    metrics: b.metrics,
    isLocked: b.isLocked,
    submittedAt: b.submittedAt,
  };
}

function makeBaselinesRouter({ maxFileSizeMb = 5 } = {}) {
  const router = express.Router();
  const upload = makeCodeUpload({ maxFileSizeMb });

  router.use(authRequired);

  router.post("/", requireRole("STUDENT"), upload.single("file"), async (req, res, next) => {
    try {
      const sessionCode = req.body?.sessionCode;
      if (!sessionCode) throw notFound("sessionCode is required");
      if (!req.file?.buffer) throw notFound("file is required");

      const source = req.file.buffer.toString("utf-8");
      const contentHash = sha256(source);
      const { sophisticationScore, metrics } = scoreSourceCode(source);

      const session = await sessionsService.findActiveSessionByCode(sessionCode);

      const prisma = getPrisma();
      const baseline = await prisma.baseline.create({
        data: {
          studentId: req.user.id,
          courseId: session.courseId,
          sessionId: session.id,
          contentHash,
          rawCode: source,
          metrics,
          sophisticationScore,
          isLocked: false,
        },
      });

      return res.status(201).json(toBaselineResponse(baseline));
    } catch (e) {
      return next(e);
    }
  });

  router.get("/:studentId/:courseId", async (req, res, next) => {
    try {
      const { studentId, courseId } = req.params;
      const prisma = getPrisma();
      const baseline = await prisma.baseline.findUnique({
        where: { studentId_courseId: { studentId, courseId } },
      });
      if (!baseline) throw notFound(`Baseline not found`);

      const isSelf = req.user.id === studentId;
      const allowed =
        isSelf ||
        req.user.role === "ADMIN" ||
        req.user.role === "INSTRUCTOR";

      if (!allowed) throw forbidden("Forbidden");

      return res.status(200).json(toBaselineResponse(baseline));
    } catch (e) {
      return next(e);
    }
  });

  return router;
}

module.exports = { makeBaselinesRouter };

