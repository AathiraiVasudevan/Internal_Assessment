const mongoose = require("mongoose");

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

    questions: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Question" }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Assessment", assessmentSchema);