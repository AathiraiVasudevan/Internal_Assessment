const mongoose = require("mongoose");
const { getInternalAssessmentConnection } = require("../../config/internalAssessmentDb");

const assessmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },

    assessmentType: { type: String, required: true },

    duration: { type: Number, required: true }, // minutes

    difficultyLevel: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      required: true
    },

    passingScore: { type: Number, required: true }, // %

    instructions: { type: String },

    totalQuestions: { type: Number },

    totalMarks: { type: Number, default: 0 },

    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: "InternalQuestion" }]
  },
  { timestamps: true }
);

const internalDb = getInternalAssessmentConnection();

module.exports =
  internalDb.models.InternalAssessment ||
  internalDb.model("InternalAssessment", assessmentSchema);
