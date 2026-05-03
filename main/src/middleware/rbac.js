const { forbidden } = require("../utils/httpErrors");

function requireRole(...roles) {
  return (req, res, next) => {
    const user = req.user;
    if (!user || !roles.includes(user.role)) {
      return next(forbidden(`Requires one of: ${roles.join(", ")}`));
    }
    return next();
  };
}

module.exports = { requireRole };

