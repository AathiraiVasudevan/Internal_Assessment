const express = require("express");
const router = express.Router();

const controller = require("../controllers/assessment.controller");
const validate = require("../middleware/validate.middleware");
const { assessmentSchema } = require("../validators/assessment.validator");
const asyncHandler = require("../middleware/asyncHandler");

router.post(
  "/",
  validate(assessmentSchema),
  asyncHandler(controller.createAssessment)
);

router.get("/", asyncHandler(controller.getAllAssessments));
router.get("/:id", asyncHandler(controller.getAssessmentById));
router.put("/:id", asyncHandler(controller.updateAssessment));
router.delete("/:id", asyncHandler(controller.deleteAssessment));

module.exports = router;