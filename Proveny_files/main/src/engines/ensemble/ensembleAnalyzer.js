const { checkGenealogy } = require("../genealogy/genealogyChecker");
const { computeCohortOutlierScore } = require("../cohort/cohortAnalyzer");

function getRiskLevel(score) {
  if (score >= 2.5) return "CRITICAL";
  if (score >= 2.0) return "FLAGGED";
  if (score >= 1.5) return "MONITOR";
  return "NORMAL";
}

function generateLlmGuidance(violations, riskLevel) {
  if (violations.length === 0 || riskLevel === "NORMAL") return null;
  const lines = [`This submission scored as ${riskLevel} risk. Recommended interview questions:`];
  for (const violation of violations) {
    const technique = violation.technique.replace(/_/g, " ");
    lines.push(`Ask the student to explain how they implemented "${technique}" step by step.`);
    if (violation.missingPrerequisites?.length > 0) {
      lines.push(`Baseline did not show: ${violation.missingPrerequisites.join(", ")}.`);
    }
  }
  return lines.join("\n");
}

async function runEnsembleAnalysis({ submission, baseline, assignment, course }) {
  const expectedScore =
    course.weeklyTargets && course.weeklyTargets[String(assignment.weekNumber)] !== undefined
      ? Number(course.weeklyTargets[String(assignment.weekNumber)])
      : assignment.expectedScore;

  const trajectoryZScore = (submission.sophisticationScore - expectedScore) / 8;
  const expectedWeeklyIncrement =
    (expectedScore - baseline.sophisticationScore) / Math.max(1, assignment.weekNumber - 1);
  const increment = expectedWeeklyIncrement === 0 ? 5 : expectedWeeklyIncrement;
  const compressedWeeks = (submission.sophisticationScore - baseline.sophisticationScore) / increment;

  const genealogy = await checkGenealogy({
    baselineMetrics: baseline.metrics,
    submissionMetrics: submission.metrics,
  });
  const cohortOutlierScore = await computeCohortOutlierScore({
    courseId: assignment.courseId,
    weekNumber: assignment.weekNumber,
    submissionScore: submission.sophisticationScore,
  });

  const ensembleScore =
    0.5 * Math.abs(trajectoryZScore) +
    0.3 * genealogy.genealogyPenalty +
    0.2 * cohortOutlierScore;
  const riskLevel = getRiskLevel(ensembleScore);

  return {
    submissionId: submission.id,
    trajectoryZScore: Number(trajectoryZScore.toFixed(4)),
    genealogyPenalty: genealogy.genealogyPenalty,
    cohortOutlierScore,
    ensembleScore: Number(ensembleScore.toFixed(4)),
    riskLevel,
    compressedWeeks: Number(compressedWeeks.toFixed(4)),
    violations: genealogy.violations,
    llmGuidance: generateLlmGuidance(genealogy.violations, riskLevel),
  };
}

module.exports = { runEnsembleAnalysis, getRiskLevel, generateLlmGuidance };
