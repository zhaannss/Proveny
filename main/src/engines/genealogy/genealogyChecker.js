const { getPrisma } = require("../../config/prisma");

const TECHNIQUE_METRIC_MAP = {
  circuit_breaker: "hasCircuitBreaker",
  dependency_injection: "hasDependencyInjection",
  service_repository_pattern: "hasServiceRepositoryPattern",
  decorator: "hasDecorator",
  custom_error_hierarchy: "hasCustomErrorHierarchy",
  jsdoc_typing: "hasJsDocTyping",
  async_await: "hasAsyncAwait",
  class_based_architecture: "architectureTier",
};

function hasTechnique(metrics, technique) {
  const key = TECHNIQUE_METRIC_MAP[technique];
  if (!key) return false;
  if (key === "architectureTier") return Number(metrics?.architectureTier || 0) >= 3;
  return Boolean(metrics?.[key]);
}

async function checkGenealogy({ baselineMetrics, submissionMetrics }) {
  const prisma = getPrisma();
  const rules = await prisma.techniquePrerequisite.findMany();
  const violations = [];
  let penalty = 0;

  for (const rule of rules) {
    if (!hasTechnique(submissionMetrics, rule.technique)) continue;
    const missingPrerequisites = rule.prerequisites.filter(
      (technique) => !hasTechnique(baselineMetrics, technique)
    );
    if (missingPrerequisites.length === 0) continue;
    penalty += rule.severityWeight;
    violations.push({
      technique: rule.technique,
      missingPrerequisites,
      severityWeight: rule.severityWeight,
      description: rule.description,
    });
  }

  return {
    genealogyPenalty: Number(penalty.toFixed(4)),
    violations,
  };
}

module.exports = { checkGenealogy, hasTechnique };
