const { parseSourceToAst } = require("./parser");
const { scoreErrorHandling } = require("./metrics/errorHandling");
const { scoreArchitecture } = require("./metrics/architecture");
const { scoreTypeSafety } = require("./metrics/typeSafety");
const { detectAdvanced } = require("./metrics/advancedTechniques");
const { scoreNamingVerbosity } = require("./metrics/naming");

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function computeSophisticationFromAst(ast) {
  const errorHandlingTier = scoreErrorHandling(ast); // 0-5
  const architectureTier = scoreArchitecture(ast); // 0-5
  const typeSafetyTier = scoreTypeSafety(ast); // 0-3
  const advanced = detectAdvanced(ast);
  const namingVerbosityScore = scoreNamingVerbosity(ast); // 0-2

  const advancedTechniqueCount = Object.values(advanced).filter(Boolean).length;
  const advancedTechniquesScore = clamp(advancedTechniqueCount, 0, 5);

  // Rule-based 0-100. Weighted primarily by tiers, intentionally deterministic.
  const score =
    errorHandlingTier * 12 +
    architectureTier * 12 +
    typeSafetyTier * 10 +
    advancedTechniquesScore * 8 +
    namingVerbosityScore * 5;

  return {
    sophisticationScore: clamp(score, 0, 100),
    metrics: {
      errorHandlingTier,
      architectureTier,
      typeSafetyTier,
      ...advanced,
      namingVerbosityScore,
    },
  };
}

function scoreSourceCode(source) {
  const ast = parseSourceToAst(source);
  return computeSophisticationFromAst(ast);
}

module.exports = { scoreSourceCode, computeSophisticationFromAst };

