const Joi = require("joi");

exports.candidateSchema = Joi.object({
  name: Joi.string().min(3).required().messages({
  "string.empty": "Name cannot be empty",
  "string.min": "Name must be at least 3 characters"
}),
  email: Joi.string().email().min(5).required().messages({
  "string.empty": "Email cannot be empty",
  "string.email": "Email must be valid"}),
  assignedAssessment: Joi.string().length(24).required()
});