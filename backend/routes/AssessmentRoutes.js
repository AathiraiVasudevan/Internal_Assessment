const express = require("express");

const controller = require("../controllers/AssessmentController");


const { createAssessment, addQuestionsToAssessment } = controller;

const router = express.Router();

router.post("/", createAssessment);
router.patch("/:assessmentId/questions", addQuestionsToAssessment);


module.exports = router;