const { HttpError } = require("../utils/httpErrors");
const { ZodError } = require("zod");
const { Prisma } = require("@prisma/client");

function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(422).json({
      statusCode: 422,
      error: "Unprocessable Entity",
      message: "Validation failed",
      details: err.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
  }

  if (err instanceof HttpError) {
    const statusCode = err.statusCode;
    const errorName =
      statusCode === 400
        ? "Bad Request"
        : statusCode === 401
          ? "Unauthorized"
          : statusCode === 403
            ? "Forbidden"
            : statusCode === 404
              ? "Not Found"
              : statusCode === 409
                ? "Conflict"
                : "Error";

    const body = {
      statusCode,
      error: errorName,
      message: err.message,
    };

    if (statusCode === 422 && err.details) {
      body.details = err.details;
    }

    return res.status(statusCode).json(body);
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({
        statusCode: 409,
        error: "Conflict",
        message: "Resource already exists",
      });
    }
  }

  const isProd = process.env.NODE_ENV === "production";
  const message = isProd
    ? "An unexpected error occurred. Please try again later."
    : err?.message || "Unknown error";

  return res.status(500).json({
    statusCode: 500,
    error: "Internal Server Error",
    message,
  });
}

module.exports = { errorHandler };

