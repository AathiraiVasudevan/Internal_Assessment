const Joi = require("joi");

exports.assessmentSchema = Joi.object({
  title: Joi.string()
    .trim()
    .min(3)
    .required(),

  type: Joi.string()
    .valid("Campus", "Lateral", "Employee")
    .required(),

  allowedCategories: Joi.array()
    .items(Joi.string().valid("Student", "Lateral", "Employee"))
    .min(1)
    .required(),

  totalMarks: Joi.number()
    .min(1)
    .max(100)
    .required(),

  passMark: Joi.number()
    .min(0)
    .max(Joi.ref("totalMarks"))
    .required()
});