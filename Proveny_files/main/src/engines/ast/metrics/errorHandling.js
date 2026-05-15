const { walk } = require("./walk");

function scoreErrorHandling(ast) {
  let tryCount = 0;
  let throwCount = 0;
  let customErrorClass = 0;

  walk(ast, (n) => {
    if (n.type === "TryStatement") tryCount += 1;
    if (n.type === "ThrowStatement") throwCount += 1;
    if (n.type === "ClassDeclaration" && n.superClass && n.superClass.name === "Error") {
      customErrorClass += 1;
    }
  });

  // Tier rubric (0-5) — intentionally simple but deterministic.
  if (customErrorClass > 0 && tryCount > 0 && throwCount > 0) return 5;
  if (tryCount >= 2 && throwCount > 0) return 4;
  if (tryCount >= 1) return 2;
  if (throwCount >= 1) return 1;
  return 0;
}

module.exports = { scoreErrorHandling };

