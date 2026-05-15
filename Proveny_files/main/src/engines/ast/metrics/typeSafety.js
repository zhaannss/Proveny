const { walk } = require("./walk");

function scoreTypeSafety(ast) {
  let tsNodeCount = 0;
  walk(ast, (n) => {
    if (typeof n.type === "string" && n.type.startsWith("TS")) tsNodeCount += 1;
  });

  if (tsNodeCount > 50) return 3;
  if (tsNodeCount > 10) return 2;
  if (tsNodeCount > 0) return 1;
  return 0;
}

module.exports = { scoreTypeSafety };

