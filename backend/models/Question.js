const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ["MCQ", "Coding", "Descriptive"],
      trim: true
    },

    title: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      trim: true
    },

    difficultyLevel: {
      type: String,
      required: true,
      enum: ["Easy", "Medium", "Hard"]
    },

    marks: {
      type: Number,
      required: true,
      min: 1
    },

    options: {
      type: [String],
      default: []
    },

    correctAnswer: {
      type: String,
      trim: true
    },

    programmingLanguage: {
      type: [String],
      default: []
    },

    starterCode: {
      type: String,
      default: ""
    },

    testCases: [
      {
        input: String,
        output: String
      }
    ]
  },
  { timestamps: true }
);


questionSchema.index(
  { title: 1, type: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

module.exports = mongoose.model("Question", questionSchema);

//collation - makes "Array" and "array" considered the same for uniqueness, but still stores the original case.case-insensitive unique index on title + type to prevent duplicates like "Array" and "array" for the same question type, while allowing different types to have the same title.
//This ensures a cleaner question bank and prevents confusion when selecting questions for assessments.

//trim: true - removes leading and trailing whitespace from string fields, ensuring cleaner data entry and preventing issues with searching or matching questions later on.
//The Question model defines the structure of question documents in MongoDB, including fields for type, title, description, difficulty level, marks, options (for MCQs), correct answer, programming language (for coding questions), starter code, and test cases. It also includes a unique index on the combination of title and type to prevent duplicate questions with the same title and type.
