const fs = require("fs");
const zlib = require("zlib");

const STOP_TOKENS = new Set([
  "CORRECT ANSWER",
  "CANDIDATE'S ANSWER",
  "Powered by",
  "ACCEPTED",
  "REJECTED",
  "Solution",
  "SCORE:"
]);

const PROBLEM_START_REGEX = /^Problem\s+(\d+)\s*:\s*(.+)$/i;
const SCORE_VALUE_REGEX = /^-?\d+(?:\.\d+)?$/;
const TOTAL_MARKS_REGEX = /^\/\s*(-?\d+(?:\.\d+)?)$/;

const decodePdfString = (value) => {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\b/g, "\b")
    .replace(/\\f/g, "\f")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\([0-7]{1,3})/g, (_, octal) =>
      String.fromCharCode(parseInt(octal, 8))
    );
};

const extractStreams = (pdfBuffer) => {
  const starts = [];
  const markers = [Buffer.from("stream\n"), Buffer.from("stream\r\n")];

  for (const marker of markers) {
    let index = 0;
    while ((index = pdfBuffer.indexOf(marker, index)) !== -1) {
      starts.push({ index, separatorLength: marker.length });
      index += marker.length;
    }
  }

  starts.sort((a, b) => a.index - b.index);

  const streams = [];
  for (const marker of starts) {
    const start = marker.index + marker.separatorLength;
    const end = pdfBuffer.indexOf(Buffer.from("endstream"), start);
    if (end === -1) continue;

    let dataEnd = end;
    if (pdfBuffer[dataEnd - 1] === 0x0a) dataEnd -= 1;
    if (pdfBuffer[dataEnd - 1] === 0x0d) dataEnd -= 1;

    streams.push(pdfBuffer.subarray(start, dataEnd));
  }

  return streams;
};

const extractTextTokens = (content) => {
  const lines = [];

  for (const match of content.matchAll(/\((?:\\.|[^\\)])*\)\s*Tj/g)) {
    const token = match[0];
    const start = token.indexOf("(");
    const end = token.lastIndexOf(")");
    if (start === -1 || end <= start) continue;

    const decoded = decodePdfString(token.slice(start + 1, end)).trim();
    if (decoded) lines.push(decoded);
  }

  for (const match of content.matchAll(/\[((?:.|\n|\r)*?)\]\s*TJ/g)) {
    const chunks = [...match[1].matchAll(/\((?:\\.|[^\\)])*\)/g)].map((part) =>
      decodePdfString(part[0].slice(1, -1))
    );

    const joined = chunks.join("").trim();
    if (joined) lines.push(joined);
  }

  return lines;
};

const extractLinesFromPdf = (pdfPath) => {
  const fileBuffer = fs.readFileSync(pdfPath);
  const allLines = [];

  for (const stream of extractStreams(fileBuffer)) {
    try {
      const inflated = zlib.inflateSync(stream).toString("latin1");
      const tokens = extractTextTokens(inflated);
      if (tokens.length) allLines.push(...tokens);
    } catch {
      // Ignore non-compressed or non-text streams.
    }
  }

  return allLines;
};

const findNumericAfter = (block, markerIndex) => {
  for (let i = markerIndex + 1; i < Math.min(block.length, markerIndex + 20); i++) {
    if (SCORE_VALUE_REGEX.test(block[i])) {
      return Number(block[i]);
    }
  }
  return null;
};

const parseScores = (block) => {
  const scoreMarkers = [];
  for (let i = 0; i < block.length; i++) {
    if (block[i] === "SCORE:") scoreMarkers.push(i);
  }

  if (!scoreMarkers.length) return { awardedMarks: null, totalMarks: null };

  const scorePairs = scoreMarkers
    .map((marker) => {
      const awardedMarks = findNumericAfter(block, marker);
      let totalMarks = null;

      for (let i = marker + 1; i < Math.min(block.length, marker + 25); i++) {
        const totalMatch = block[i].match(TOTAL_MARKS_REGEX);
        if (totalMatch) {
          totalMarks = Number(totalMatch[1]);
          break;
        }
      }

      return {
        marker,
        awardedMarks,
        totalMarks,
        hasTotal: totalMarks !== null
      };
    })
    .filter((pair) => pair.awardedMarks !== null);

  if (!scorePairs.length) return { awardedMarks: null, totalMarks: null };

  const preferred = scorePairs.find((pair) => pair.hasTotal) || scorePairs[0];
  return {
    awardedMarks: preferred.awardedMarks,
    totalMarks: preferred.totalMarks
  };
};

const isProblemStart = (line) => PROBLEM_START_REGEX.test(line);

const getCandidateAnswer = (block, questionType) => {
  if (String(questionType).toUpperCase() === "CODING") {
    return "Submitted coding solution (see full report)";
  }

  const markerIndex = block.indexOf("CANDIDATE'S ANSWER");
  if (markerIndex === -1) return "Not found in report";

  const after = [];
  for (let i = markerIndex + 1; i < block.length; i++) {
    const current = block[i];
    if (STOP_TOKENS.has(current) || isProblemStart(current)) break;
    after.push(current);
  }

  const afterText = after.join(" ").replace(/\s+/g, " ").trim();
  if (afterText) return afterText;

  for (let i = markerIndex - 1; i >= Math.max(0, markerIndex - 5); i--) {
    const current = block[i];
    if (isProblemStart(current)) break;
    if (current === "CORRECT ANSWER") continue;
    if (STOP_TOKENS.has(current)) break;
    if (current && !/^\d+$/.test(current)) return current.trim();
  }

  return "Not found in report";
};

const parseQuestionType = (block) => {
  for (const line of block) {
    const upper = String(line).toUpperCase().trim();
    if (upper === "MCQ" || upper === "CODING" || upper === "DESCRIPTIVE") {
      return upper;
    }
  }
  return "UNKNOWN";
};

const parseStatus = (block) => {
  if (block.includes("REJECTED")) return "rejected";
  if (block.includes("ACCEPTED")) return "accepted";
  return "unknown";
};

const parseDetailedAnalysis = (lines) => {
  const blocks = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!PROBLEM_START_REGEX.test(line)) continue;

    const start = i;
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      if (PROBLEM_START_REGEX.test(lines[j])) {
        end = j;
        break;
      }
    }

    blocks.push(lines.slice(start, end));
    i = end - 1;
  }

  return blocks
    .map((block) => {
      const header = block[0].match(PROBLEM_START_REGEX);
      if (!header) return null;

      const questionNumber = Number(header[1]);
      const questionTitle = header[2].trim();
      const questionType = parseQuestionType(block);
      const status = parseStatus(block);
      const { awardedMarks: parsedAwarded, totalMarks: parsedTotal } = parseScores(block);
      const totalMarks = parsedTotal;
      const awardedMarks =
        status === "rejected" && totalMarks !== null
          ? 0
          : parsedAwarded;
      const candidateAnswer = getCandidateAnswer(block, questionType);

      const resolvedType =
        questionType === "UNKNOWN" && totalMarks !== null
          ? totalMarks >= 50
            ? "CODING"
            : "MCQ"
          : questionType;

      return {
        questionNumber,
        questionTitle,
        questionType: resolvedType,
        status,
        awardedMarks,
        totalMarks,
        candidateAnswer
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.questionNumber - b.questionNumber);
};

const parseDetailedAnalysisFromPdf = (pdfPath) => {
  const lines = extractLinesFromPdf(pdfPath);
  const rows = parseDetailedAnalysis(lines);

  const solutionsIndex = lines.findIndex((line) => line === "Solutions");
  const technologyIndex = lines.findIndex((line) => line === "Technology used");
  const typeStatusIndex = lines.findIndex((line) => line === "TypeStatusScore");

  const totalMarksByOrder =
    solutionsIndex !== -1 && technologyIndex !== -1 && technologyIndex > solutionsIndex
      ? lines
          .slice(solutionsIndex, technologyIndex)
          .map((line) => line.match(TOTAL_MARKS_REGEX))
          .filter(Boolean)
          .map((match) => Number(match[1]))
      : [];

  const awardedMarksByOrder =
    typeStatusIndex !== -1 && technologyIndex !== -1 && technologyIndex > typeStatusIndex
      ? lines
          .slice(typeStatusIndex, technologyIndex)
          .filter((line) => /^\d+\.\d+$/.test(line))
          .map((line) => Number(line))
      : [];

  return rows.map((row, index) => {
    const fallbackTotal = totalMarksByOrder[index];
    const fallbackAwarded = awardedMarksByOrder[index];

    const totalMarks = row.totalMarks ?? (fallbackTotal ?? null);
    const awardedMarks =
      row.awardedMarks ??
      (row.status === "rejected" && totalMarks !== null
        ? 0
        : fallbackAwarded ?? null);

    const questionType =
      row.questionType === "UNKNOWN" && totalMarks !== null
        ? totalMarks >= 50
          ? "CODING"
          : "MCQ"
        : row.questionType;

    return {
      ...row,
      questionType,
      awardedMarks,
      totalMarks
    };
  });
};

module.exports = {
  parseDetailedAnalysisFromPdf
};
