const Candidate = require("../models/Candidate");

exports.getCandidateListing = async () => {
  return await Candidate.aggregate([
    { $sort: { createdAt: -1 } },
    // Join with both assessment collections (legacy + internal module)
    {
      $lookup: {
        from: "assessments",
        localField: "assignedAssessment",
        foreignField: "_id",
        as: "assessmentMain"
      }
    },
    {
      $lookup: {
        from: "internalassessments",
        localField: "assignedAssessment",
        foreignField: "_id",
        as: "assessmentInternal"
      }
    },
    {
      $addFields: {
        assessmentResolved: {
          $ifNull: [
            { $first: "$assessmentMain" },
            { $first: "$assessmentInternal" }
          ]
        }
      }
    },

    // Join with Attempts
    { $lookup: { from: "attempts", localField: "_id", foreignField: "candidate", as: "attempts" } },

    // Extract the most recent attempt (Simplified sort logic)
    {
      $addFields: {
        latestAttempt: { $first: { $sortArray: { input: "$attempts", sortBy: { createdAt: -1, _id: -1 } } } }
      }
    },

    // Final Data Shape
    {
      $project: {
        candidateId: "$_id",
        name: 1, email: 1, category: 1,
        assessmentId: "$assessmentResolved._id",
        attemptId: "$latestAttempt._id",
        assessmentName: { $ifNull: ["$assessmentResolved.title", "Unassigned"] },
        assessmentType: {
          $ifNull: ["$assessmentResolved.type", "$assessmentResolved.assessmentType"]
        },
        status: { $ifNull: ["$latestAttempt.status", "pending"] },
        reassignedAt: 1,
        isReassigned: {
          $and: [
            { $eq: [{ $ifNull: ["$latestAttempt.isReassignedAttempt", false] }, true] },
            { $eq: [{ $ifNull: ["$latestAttempt.status", "pending"] }, "pending"] }
          ]
        },

        // Score String formatting: "X/Y" or "-"
        score: {
          $cond: [
            { $eq: ["$latestAttempt.status", "completed"] },
            {
              $concat: [
                { $toString: "$latestAttempt.score" },
                "/",
                { $toString: { $ifNull: ["$assessmentResolved.totalMarks", 100] } }
              ]
            },
            "-"
          ]
        },

        // Percentage formatting: "X%" or "-"
        percentage: {
          $cond: [
            { $eq: ["$latestAttempt.status", "completed"] },
            {
              $concat: [
                {
                  $toString: {
                    $round: [
                      {
                        $multiply: [
                          {
                            $divide: [
                              "$latestAttempt.score",
                              { $ifNull: ["$assessmentResolved.totalMarks", 100] }
                            ]
                          },
                          100
                        ]
                      },
                      0
                    ]
                  }
                },
                "%"
              ]
            },
            "-"
          ]
        },

        completionDate: {
          $cond: [{ $eq: ["$latestAttempt.status", "completed"] }, "$latestAttempt.completedAt", null]
        }
      }
    }
  ]);
};
