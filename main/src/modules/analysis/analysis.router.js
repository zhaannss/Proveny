const express = require("express");
const { z } = require("zod");
const { authRequired } = require("../../middleware/auth");
const { requireRole } = require("../../middleware/rbac");
const { getPrisma } = require("../../config/prisma");
const { notFound, forbidden } = require("../../utils/httpErrors");
const analysisService = require("./analysis.service");

const oneShotSchema = z.object({
  studentId: z.string().uuid(),
  courseId: z.string().uuid(),
  weekNumber: z.number().int().min(1).max(16),
  rawCode: z.string().min(1),
});

const outcomeSchema = z.object({
  outcome: z.enum(["CLEARED", "CONFIRMED_AI", "ESCALATED"]),
  notes: z.string().max(2000).optional(),
});

function makeAnalysisRouter() {
  const router = express.Router();
  router.use(authRequired);

  router.get("/:submissionId", async (req, res, next) => {
    try {
      const result = await analysisService.getAnalysisResult({
        actor: req.user,
        submissionId: req.params.submissionId,
      });
      return res.status(200).json(result);
    } catch (e) {
      return next(e);
    }
  });

  router.patch("/:submissionId/outcome", requireRole("INSTRUCTOR", "ADMIN"), async (req, res, next) => {
    try {
      const { outcome, notes } = outcomeSchema.parse(req.body);
      const result = await analysisService.recordOutcome({
        actor: req.user,
        submissionId: req.params.submissionId,
        outcome,
        notes,
      });
      return res.status(200).json(result);
    } catch (e) {
      return next(e);
    }
  });

  router.post("/one-shot", requireRole("INSTRUCTOR", "ADMIN"), async (req, res, next) => {
    try {
      const prisma = getPrisma();
      const data = oneShotSchema.parse(req.body);
      const { scoreSourceCode } = require("../../engines/ast/sophisticationScorer");

      const baseline = await prisma.baseline.findUnique({
        where: { studentId_courseId: { studentId: data.studentId, courseId: data.courseId } },
      });
      if (!baseline) throw notFound("Baseline not found");

      const course = await prisma.course.findUnique({ where: { id: data.courseId } });
      if (!course) throw notFound("Course not found");
      if (req.user.role === "INSTRUCTOR" && course.instructorId !== req.user.id) throw forbidden("Forbidden");

      const current = scoreSourceCode(data.rawCode);
      const currentScore = current.sophisticationScore;
      const baselineScore = baseline.sophisticationScore;
      const expectedScore =
        course.weeklyTargets && course.weeklyTargets[String(data.weekNumber)] !== undefined
          ? Number(course.weeklyTargets[String(data.weekNumber)])
          : baselineScore;
      const trajectoryZScore = (currentScore - expectedScore) / 8;
      const expectedWeeklyIncrement = (expectedScore - baselineScore) / Math.max(1, data.weekNumber - 1);
      const increment = expectedWeeklyIncrement === 0 ? 5 : expectedWeeklyIncrement;
      const compressedWeeks = (currentScore - baselineScore) / increment;

      return res.status(200).json({
        studentId: data.studentId,
        courseId: data.courseId,
        weekNumber: data.weekNumber,
        baselineScore,
        expectedScore,
        currentScore,
        compressedWeeks: Number(compressedWeeks.toFixed(4)),
        trajectoryZScore: Number(trajectoryZScore.toFixed(4)),
      });
    } catch (e) {
      return next(e);
    }
  });

  return router;
}

module.exports = { makeAnalysisRouter };
