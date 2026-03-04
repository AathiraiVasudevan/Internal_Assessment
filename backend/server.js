require("dotenv").config();

const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");

const assessmentRoutes = require("./routes/AssessmentRoutes");
const questionRoutes = require("./routes/QuestionRoutes"); 

const app = express();

// connect DB
connectDB();

// middleware
app.use(express.json());

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));

// routes
app.use("/api/assessments", assessmentRoutes);
app.use("/api/questions", questionRoutes); // ⭐ ADD THIS

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Server running on port", PORT));