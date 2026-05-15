const multer = require("multer");

function makeCodeUpload({ maxFileSizeMb }) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxFileSizeMb * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const okMime =
        file.mimetype === "application/javascript" ||
        file.mimetype === "text/javascript" ||
        file.mimetype === "application/typescript" ||
        file.mimetype === "text/typescript" ||
        file.mimetype === "text/plain";
      if (!okMime) return cb(new Error("Unsupported file type"));
      return cb(null, true);
    },
  });

  return upload;
}

module.exports = { makeCodeUpload };

