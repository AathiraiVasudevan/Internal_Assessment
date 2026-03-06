const mongoose = require("mongoose");

const candidateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    category: {
      type: String,
      enum: ["Student", "Lateral", "Employee"],
      required: true
    },
    assignedAssessment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assessment",
      required: false,
      default: null
    },
    reassignedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Candidate", candidateSchema);
