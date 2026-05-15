const parser = require("@babel/parser");

function parseSourceToAst(source, { filename = "submission.js" } = {}) {
  return parser.parse(source, {
    sourceType: "unambiguous",
    plugins: [
      "jsx",
      "typescript", // allowed even in JS project: we accept TS submissions too (per spec), but treat as optional
      "classProperties",
      "decorators-legacy",
      "dynamicImport",
      "topLevelAwait",
    ],
    sourceFilename: filename,
    errorRecovery: false,
    allowReturnOutsideFunction: true,
  });
}

module.exports = { parseSourceToAst };

