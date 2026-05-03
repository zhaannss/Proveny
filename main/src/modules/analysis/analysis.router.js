const express = require("express");
const { z } = require("zod");
const { authRequired } = require("../../middleware/auth");
const { requireRole } = require("../../middleware/rbac");
const { getPrisma } = require("../../config/prisma");
const { scoreSourceCode } = require("../../engines/ast/sophisticationScorer");
const { notFound, forbidden } = require("../../utils/httpErrors");

const oneShotSchema = z.object({
  studentId: z.string().uuid(),
  courseId: z.string().uuid(),
  weekNumber: z.number().int().min(1).max(16),
  rawCode: z.string().min(1),
});

function makeAnalysisRouter() {
  const router = express.Router();
  router.use(authRequired);

  // One-shot comparison vs baseline (required by assignment deep-dive)
  router.post("/one-shot", requireRole("INSTRUCTOR", "ADMIN"), async (req, res, next) => {
    try {
      const prisma = getPrisma();
      const data = oneShotSchema.parse(req.body);

      const baseline = await prisma.baseline.findUnique({
        where: { studentId_courseId: { studentId: data.studentId, courseId: data.courseId } },
      });
      if (!baseline) throw notFound("Baseline not found");

      const course = await prisma.course.findUnique({ where: { id: data.courseId } });
      if (!course) throw notFound("Course not found");

      // Instructor can only analyze their own course
      if (req.user.role === "INSTRUCTOR" && course.instructorId !== req.user.id) {
        throw forbidden("Forbidden");
      }

      const current = scoreSourceCode(data.rawCode);
      const currentScore = current.sophisticationScore;
      const baselineScore = baseline.sophisticationScore;

      // expected score: prefer course.weeklyTargets[weekNumber] if available
      const expectedScoreRaw =
        course.weeklyTargets && course.weeklyTargets[String(data.weekNumber)] !== undefined
          ? Number(course.weeklyTargets[String(data.weekNumber)])
          : baselineScore;

      // z-score requires stddev; for milestone we use a deterministic fallback stddev=8 (documented in rubric/changelog)
      const stddev = 8;
      const trajectoryZScore = (currentScore - expectedScoreRaw) / stddev;

      const expectedWeeklyIncrement = (expectedScoreRaw - baselineScore) / Math.max(1, data.weekNumber - 1);
      const increment = expectedWeeklyIncrement === 0 ? 5 : expectedWeeklyIncrement;
      const compressedWeeks = (currentScore - baselineScore) / increment;

      return res.status(200).json({
        studentId: data.studentId,
        courseId: data.courseId,
        weekNumber: data.weekNumber,
        baselineScore,
        expectedScore: expectedScoreRaw,
        currentScore,
        compressedWeeks,
        trajectoryZScore,
      });
    } catch (e) {
      return next(e);
    }
  });

  return router;
}

module.exports = { makeAnalysisRouter };

