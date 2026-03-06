const express = require("express");

const controller = require("../../controllers/internalAssessment/AssessmentController");


const {
  getAssessments,
  createAssessment,
  addQuestionsToAssessment,
  getAssessmentById,
  updateAssessment,
  deleteAssessment,
  unlinkQuestionFromAssessment,
} = controller;

const router = express.Router();

router.get("/", getAssessments);
router.post("/", createAssessment);
router.get("/:assessmentId", getAssessmentById);
router.put("/:assessmentId", updateAssessment);
router.delete("/:assessmentId", deleteAssessment);
router.patch("/:assessmentId/questions", addQuestionsToAssessment);
router.delete("/:assessmentId/questions/:questionId", unlinkQuestionFromAssessment);


module.exports = router;
