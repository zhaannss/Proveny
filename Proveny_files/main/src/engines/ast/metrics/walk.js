function walk(node, visitor) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const n of node) walk(n, visitor);
    return;
  }

  visitor(node);

  for (const key of Object.keys(node)) {
    if (key === "loc" || key === "start" || key === "end") continue;
    const value = node[key];
    if (!value) continue;
    if (typeof value === "object") walk(value, visitor);
  }
}

module.exports = { walk };

