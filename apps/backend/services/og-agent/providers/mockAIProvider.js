const taskLabels = {
  GENERAL: "general operations analysis",
  EMAIL_ANALYSIS: "email content analysis",
  GROWER_RESEARCH: "grower research preparation",
  BUYER_RESEARCH: "buyer research preparation",
  TELECALLING_PREPARATION: "telecalling preparation",
  CODING_ANALYSIS: "read-only coding analysis",
  SEO_ANALYSIS: "SEO analysis",
  REPORT_GENERATION: "report generation",
};

const concisePrompt = (prompt = "") => String(prompt).replace(/\s+/g, " ").trim().slice(0, 500);

export const mockAIProvider = {
  name: "mock",

  async generateTaskPlan({ task, tool }) {
    const label = taskLabels[task.taskType] || "analysis";
    return [
      {
        stepNumber: 1,
        title: "Validate scope and safety",
        description: `Confirm that the ${label} request is limited to Phase 1 analysis and recommendation mode.`,
        tool: tool.name,
        riskLevel: tool.riskLevel,
        approvalRequired: tool.approvalRequired,
        status: "PENDING",
      },
      {
        stepNumber: 2,
        title: "Generate structured preview",
        description: "Use the local mock provider to prepare structured, reviewable output without contacting external systems.",
        tool: tool.name,
        riskLevel: tool.riskLevel,
        approvalRequired: tool.approvalRequired,
        status: "PENDING",
      },
      {
        stepNumber: 3,
        title: "Prepare recommendations",
        description: "Summarize observations, limitations, and human-reviewed next actions.",
        tool: tool.name,
        riskLevel: tool.riskLevel,
        approvalRequired: false,
        status: "PENDING",
      },
    ];
  },

  async executeTask({ task }) {
    const request = concisePrompt(task.prompt);
    const common = {
      summary: `Safe ${taskLabels[task.taskType] || "task"} preview generated for: ${task.title}.`,
      recommendations: [
        "Review this preview with the responsible team member before taking any action.",
        "Verify source data and assumptions before operational use.",
      ],
    };

    if (task.taskType === "TELECALLING_PREPARATION") {
      return {
        ...common,
        data: {
          introductionScript: "Hello, I am calling from Orchard Growers Private Limited. Is this a convenient time to discuss your fruit sourcing or supply requirements?",
          questionsToAsk: [
            "Which fruits, grades, and approximate quantities are relevant?",
            "What delivery locations and timelines should be considered?",
            "What quality, packaging, and payment requirements apply?",
          ],
          objectionsAndAnswers: [
            { objection: "Please send details first.", suggestedAnswer: "Certainly. We can prepare a concise information note for your review; no message will be sent by OG Agent." },
            { objection: "We already have suppliers.", suggestedAnswer: "Understood. May we note future seasonal or backup sourcing needs?" },
          ],
          outcomeOptions: ["Interested", "Follow up later", "Send information draft", "Not relevant", "Do not contact"],
          followUpRecommendation: "Record the outcome manually and obtain consent before any follow-up.",
          requestContext: request,
          limitation: "No call was initiated and no contact data was accessed.",
        },
      };
    }

    if (task.taskType === "CODING_ANALYSIS") {
      return {
        ...common,
        data: {
          analysisScope: request,
          filesToInspect: ["Relevant route or entry file", "Associated controller/service", "Related tests and types"],
          riskChecklist: ["Authentication and authorization", "Input validation", "Secrets and logs", "Backward compatibility", "Test coverage"],
          proposedImplementationSteps: ["Inspect affected modules", "Define the smallest safe change", "Add focused tests", "Run existing checks", "Request human review"],
          explicitSafetyStatement: "No code was changed, executed, committed, pushed, merged, or deployed.",
        },
      };
    }

    if (task.taskType === "REPORT_GENERATION") {
      return {
        ...common,
        data: {
          executiveSummary: `This demo report organizes the supplied instruction into a human-reviewable brief: ${request}`,
          observations: ["The report uses only text supplied in the task.", "No production database or external service was queried."],
          recommendations: ["Attach verified source data in a future approved workflow.", "Assign an owner and review date to accepted actions."],
          nextActions: ["Review the report", "Correct assumptions", "Export or distribute manually if approved"],
        },
      };
    }

    if (task.taskType === "EMAIL_ANALYSIS") {
      return {
        ...common,
        data: {
          scope: "Analysis of user-supplied text only",
          observations: ["Identify the sender's stated need.", "Separate facts, questions, deadlines, and commitments."],
          suggestedDraftOutline: ["Acknowledge the request", "Answer confirmed points", "Ask for missing information", "State the next step"],
          requestContext: request,
          limitation: "No mailbox was searched and no email was drafted or sent automatically.",
        },
      };
    }

    return {
      ...common,
      data: {
        requestContext: request,
        observations: ["The requested scope was converted into a safe analysis preview.", "No external system, private mailbox, terminal, or production database was accessed."],
        analysisChecklist: ["Confirm objective", "Verify available evidence", "Identify constraints", "Assign human-reviewed next actions"],
        limitation: "Mock provider output is demonstrative and must be verified by a human.",
      },
    };
  },

  async generateSummary({ result }) {
    return result?.summary || "Mock OG Agent task completed in analysis-only mode.";
  },

  async analyzeCodingTask(context) {
    const { deterministicCodingProvider } = await import("../coding/codingProvider.js");
    return deterministicCodingProvider.analyzeCodingTask(context);
  },
  async selectRelevantFiles(context) {
    const { deterministicCodingProvider } = await import("../coding/codingProvider.js");
    return deterministicCodingProvider.selectRelevantFiles(context);
  },
  async generateImplementationPlan(context) {
    const { deterministicCodingProvider } = await import("../coding/codingProvider.js");
    return deterministicCodingProvider.generateImplementationPlan(context);
  },
  async generatePatch(context) {
    const { deterministicCodingProvider } = await import("../coding/codingProvider.js");
    return deterministicCodingProvider.generatePatch(context);
  },
  async reviewPatch(context) {
    const { deterministicCodingProvider } = await import("../coding/codingProvider.js");
    return deterministicCodingProvider.reviewPatch(context);
  },
  async summarizeValidation(context) {
    const { deterministicCodingProvider } = await import("../coding/codingProvider.js");
    return deterministicCodingProvider.summarizeValidation(context);
  },
  async generateRollbackPlan(context) {
    const { deterministicCodingProvider } = await import("../coding/codingProvider.js");
    return deterministicCodingProvider.generateRollbackPlan(context);
  },
};

export default mockAIProvider;
