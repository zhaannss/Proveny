const { walk } = require("./walk");

function scoreArchitecture(ast) {
  let functionCount = 0;
  let classCount = 0;
  let hasServiceLike = 0;

  walk(ast, (n) => {
    if (n.type === "FunctionDeclaration" || n.type === "FunctionExpression" || n.type === "ArrowFunctionExpression") {
      functionCount += 1;
    }
    if (n.type === "ClassDeclaration") classCount += 1;
    if (n.type === "Identifier" && /Service|Repository|Controller/.test(n.name)) hasServiceLike += 1;
  });

  // Tier 0-5 (simple heuristic)
  if (classCount >= 3 || hasServiceLike >= 3) return 5;
  if (classCount >= 1 && hasServiceLike >= 1) return 4;
  if (classCount >= 1) return 2;
  if (functionCount >= 5) return 1;
  return 0;
}

module.exports = { scoreArchitecture };

