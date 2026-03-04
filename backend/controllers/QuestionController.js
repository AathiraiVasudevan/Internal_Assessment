const Question = require("../models/Question");

/* ===============================
   CREATE QUESTION
================================= */
const createQuestion = async (req, res) => {
  try {
    // Normalize title (extra professional touch)
    req.body.title = req.body.title.trim();

    const question = await Question.create(req.body);

    return res.status(201).json({
      success: true,
      message: "Question created successfully.",
      data: question
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