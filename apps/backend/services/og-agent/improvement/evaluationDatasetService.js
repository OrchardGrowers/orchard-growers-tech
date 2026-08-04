import OGAgentEvaluationDataset from "../../../models/OGAgentEvaluationDataset.js";
export const createEvaluationDataset = ({ input, actorId }) => OGAgentEvaluationDataset.create({ ...input, status: "DRAFT", createdBy: actorId });
export const addEvaluationCase = async ({ datasetId, testCase }) => {
  const dataset = await OGAgentEvaluationDataset.findById(datasetId);
  if (!dataset) { const error = new Error("Evaluation dataset was not found"); error.statusCode = 404; throw error; }
  if (dataset.status === "ARCHIVED") { const error = new Error("Archived datasets cannot be changed"); error.statusCode = 409; throw error; }
  dataset.cases.push(testCase); dataset.version += 1; return dataset.save();
};
