const mongoose = require("mongoose");
const AppError = require("./AppError");

const isBlank = (value) => typeof value !== "string" || value.trim().length === 0;

const requireFields = (body, fields) => {
  const missing = fields.filter((field) => body[field] === undefined || body[field] === null || body[field] === "");
  if (missing.length) {
    throw new AppError(`Missing required field(s): ${missing.join(", ")}`, 400);
  }
};

const validateObjectId = (id, label = "id") => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${label}`, 400);
  }
};

module.exports = {
  isBlank,
  requireFields,
  validateObjectId,
};
