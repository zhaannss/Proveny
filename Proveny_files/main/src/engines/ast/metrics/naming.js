const { walk } = require("./walk");

function scoreNamingVerbosity(ast) {
  const identifiers = [];
  walk(ast, (n) => {
    if (n.type === "Identifier" && typeof n.name === "string") identifiers.push(n.name);
  });
  if (identifiers.length === 0) return 0;

  const avg = identifiers.reduce((a, s) => a + s.length, 0) / identifiers.length;
  // 0-2 scale
  if (avg >= 18) return 2;
  if (avg >= 12) return 1;
  return 0;
}

module.exports = { scoreNamingVerbosity };

