const mongoose = require("mongoose");

const attemptSchema = new mongoose.Schema(
  {
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Candidate",
      required: true
    },
    assessment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assessment",
      required: true
    },
    status: {
      type: String,
      enum: ["pending", "in-progress", "completed"],
      default: "pending"
    },
    isReassignedAttempt: {
      type: Boolean,
      default: false
    },
    score: {
      type: Number,
      default: null
    },
    startedAt: {
      type: Date
    },
    completedAt: {
      type: Date,
      default: null
    },
    timeTaken: {
      type: Number,
      default: null
    },
    result: {
      type: String,
      enum: ["pass", "fail"],
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
    questionStats: {
      answered: {
        type: Number,
        default: null
      },
      total: {
        type: Number,
        default: null
      }
    },
    reportPath: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Attempt", attemptSchema);
