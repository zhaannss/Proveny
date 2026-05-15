const { scoreSourceCode } = require("../../../src/engines/ast/sophisticationScorer");

test("scores plain function lower than try/catch + class", () => {
  const simple = `function add(a,b){ return a+b }`;
  const advanced = `
    class CustomError extends Error {}
    async function run(){
      try {
        await Promise.resolve(1);
        throw new CustomError("x");
      } catch (e) {
        return e;
      }
    }
  `;

  const s1 = scoreSourceCode(simple).sophisticationScore;
  const s2 = scoreSourceCode(advanced).sophisticationScore;
  expect(s2).toBeGreaterThan(s1);
});

