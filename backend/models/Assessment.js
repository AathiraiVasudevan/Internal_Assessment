const mongoose = require("mongoose");

const assessmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    type: {
      type: String,
      enum: ["Campus", "Lateral", "Employee"],
      required: true
    },
    allowedCategories: [{
      type: String,
      enum: ["Student", "Lateral", "Employee"],
      required: true
    }],
    passMark: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    sectionBreakdown: {
      mcq: {
        score: Number,
        total: Number
      },
      coding: {
        score: Number,
        total: Number
      },
      descriptive: {
        score: Number,
        total: Number
      }
    },
    totalMarks: {
      type: Number,
      required: true,
      default: 100
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Assessment", assessmentSchema);