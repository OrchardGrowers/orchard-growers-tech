import { describe, expect, it } from "vitest";
import { summarizeFruitRecognitionPredictions } from "./fruitRecognition";

describe("fruit capture recognition gate", () => {
  it("accepts a confident fruit image without an obstruction label", () => {
    expect(summarizeFruitRecognitionPredictions([
      { className: "Granny Smith apple", probability: 0.82 },
      { className: "fruit", probability: 0.1 },
    ])).toMatchObject({ accepted: true, obstruction: null });
  });

  it("never treats a significant person/hand prediction as fruit", () => {
    const result = summarizeFruitRecognitionPredictions([
      { className: "person", probability: 0.68 },
      { className: "Granny Smith apple", probability: 0.62 },
    ]);
    expect(result.accepted).toBe(false);
    expect(result.obstruction).toMatchObject({ significant: true });
    expect(result.warning).toMatch(/hands and other objects/i);
  });

  it("rejects carton/background classification when no fruit is recognized", () => {
    const result = summarizeFruitRecognitionPredictions([
      { className: "carton", probability: 0.75 },
      { className: "table", probability: 0.2 },
    ]);
    expect(result.accepted).toBe(false);
    expect(result.label).toBe("carton");
  });
});
