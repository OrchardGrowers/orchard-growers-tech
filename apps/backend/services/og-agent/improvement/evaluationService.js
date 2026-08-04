import OGAgentEvaluationDataset from "../../../models/OGAgentEvaluationDataset.js";
import OGAgentEvaluationRun from "../../../models/OGAgentEvaluationRun.js";

export const createEvaluationRun = async ({ input, actorId }) => {
  const dataset = await OGAgentEvaluationDataset.findById(input.datasetId);
  if (!dataset || dataset.status !== "ACTIVE" || !dataset.cases.length) { const error = new Error("A locked, active, non-empty evaluation dataset is required"); error.statusCode = 409; throw error; }
  return OGAgentEvaluationRun.create({ ...input, status: "QUEUED", createdBy: actorId });
};

export const executeDeterministicEvaluation = async ({ runId, evaluator }) => {
  const run = await OGAgentEvaluationRun.findOneAndUpdate({ _id: runId, status: "QUEUED" }, { $set: { status: "RUNNING", startedAt: new Date() } }, { new: true });
  if (!run) { const error = new Error("Evaluation is not queued"); error.statusCode = 409; throw error; }
  try {
    const dataset = await OGAgentEvaluationDataset.findById(run.datasetId);
    const results = [];
    for (const testCase of dataset.cases) results.push({ caseId: testCase._id, ...(await evaluator(testCase, run)) });
    const totalWeight = dataset.cases.reduce((sum, item) => sum + item.weight, 0);
    const aggregateScore = results.reduce((sum, result, index) => sum + result.score * dataset.cases[index].weight, 0) / totalWeight;
    run.results = results; run.aggregateScore = aggregateScore; run.regressionDetected = run.baselineScore != null && aggregateScore < run.baselineScore; run.status = "COMPLETED"; run.completedAt = new Date();
    return run.save();
  } catch (cause) { run.status = "FAILED"; run.failureReason = String(cause.message || cause).slice(0, 4000); run.completedAt = new Date(); await run.save(); throw cause; }
};
