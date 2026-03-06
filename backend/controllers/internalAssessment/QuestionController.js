const Question = require("../../models/internalAssessment/Question");
const Assessment = require("../../models/internalAssessment/Assessment");

/* ===============================
   CREATE QUESTION
================================= */
const createQuestion = async (req, res) => {
  try {
    const { assessmentId, ...payload } = req.body;

    // Normalize title
    if (typeof payload.title === "string") {
      payload.title = payload.title.trim();
    }

    let assessment = null;
    if (assessmentId) {
      assessment = await Assessment.findById(assessmentId);
      if (!assessment) {
        return res.status(404).json({
          success: false,
          message: "Assessment not found."
        });
      }
    }

    const question = await Question.create(payload);

    if (assessment) {
      assessment.questions = [...(assessment.questions || []), question._id];
      assessment.totalQuestions = assessment.questions.length;
      assessment.totalMarks = (assessment.totalMarks || 0) + (question.marks || 0);
      await assessment.save();
    }

    return res.status(201).json({
      success: true,
      message: "Question created successfully.",
      data: question,
      assessmentUpdated: Boolean(assessment)
    });

  } catch (err) {

    // 🔥 Duplicate Error Handling
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A question with the same title and type already exists."
      });
    }

    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/* ===============================
   GET ALL QUESTIONS
================================= */
const getQuestions = async (req, res) => {
  try {
    const questions = await Question.find()
      .collation({ locale: "en", strength: 2 }) // case insensitive sorting
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: questions.length,
      data: questions
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch questions.",
      error: err.message
    });
  }
};

module.exports = { createQuestion, getQuestions };
