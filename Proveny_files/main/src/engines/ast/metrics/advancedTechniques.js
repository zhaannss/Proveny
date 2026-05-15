const { walk } = require("./walk");

function detectAdvanced(ast) {
  const flags = {
    hasDecorators: false,
    hasAsyncAwait: false,
    hasContextManagers: false, // JS proxy: usage of "using" (TC39) or common pattern isn't standard; keep false
    hasMetaclasses: false, // JS doesn't have metaclasses; reserved for Python track
    hasCircuitBreaker: false,
    hasDependencyInjection: false,
  };

  walk(ast, (n) => {
    if (n.type === "Decorator") flags.hasDecorators = true;
    if (n.type === "AwaitExpression") flags.hasAsyncAwait = true;
    if (n.type === "Identifier" && n.name === "CircuitBreaker") flags.hasCircuitBreaker = true;
    if (n.type === "Identifier" && (n.name === "container" || n.name === "inject" || n.name === "Inject")) {
      flags.hasDependencyInjection = true;
    }
  });

  return flags;
}

module.exports = { detectAdvanced };

