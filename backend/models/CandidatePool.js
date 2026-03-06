const mongoose = require("mongoose");

const candidatePoolSchema = new mongoose.Schema({
  candidate_id: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true, lowercase: true },
  category: {
    type: String,
    enum: ["Student", "Lateral", "Employee"], // Added Employee
    required: true
  },
  experience_years: { type: Number, default: 0 },
  background: String,
  skills: [String],
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model(
  "CandidatePool",
  candidatePoolSchema,
  "candidates_pool"
);