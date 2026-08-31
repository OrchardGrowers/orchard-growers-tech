import * as mobilenet from "@tensorflow-models/mobilenet";
import "@tensorflow/tfjs";

const FRUIT_WORDS = [
  "almond",
  "apple",
  "apricot",
  "avocado",
  "banana",
  "berry",
  "blackberry",
  "blueberry",
  "cantaloupe",
  "cherry",
  "coconut",
  "currant",
  "date",
  "dried fruit",
  "dragon fruit",
  "durian",
  "elderberry",
  "fig",
  "fruit",
  "grape",
  "guava",
  "kiwi",
  "lemon",
  "lime",
  "mango",
  "melon",
  "nut",
  "orange",
  "peach",
  "peanut",
  "pear",
  "pecan",
  "persimmon",
  "pistachio",
  "pineapple",
  "plum",
  "pomegranate",
  "raisin",
  "strawberry",
  "walnut",
];
const OBSTRUCTION_WORDS = [
  "arm",
  "carton",
  "hand",
  "person",
  "people",
  "tray",
  "box",
];

let modelPromise;

const getModel = () => {
  if (!modelPromise) {
    modelPromise = mobilenet.load();
  }

  return modelPromise;
};

export const warmUpFruitRecognition = () => {
  getModel().catch(() => undefined);
};

export const recognizeFruitImage = async (file) => {
  if (!file?.type?.startsWith("image/")) {
    return { accepted: false, label: "not an image" };
  }

  const image = await fileToImage(file);
  const result = await classifyElement(image);

  URL.revokeObjectURL(image.src);
  return result;
};

export const recognizeFruitVideo = async (file) => {
  if (!file?.type?.startsWith("video/")) {
    return { accepted: false, label: "not a video" };
  }

  const video = document.createElement("video");
  const url = URL.createObjectURL(file);
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";

  try {
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = reject;
    });

    video.currentTime = Math.min(1, video.duration || 0);

    await new Promise((resolve, reject) => {
      video.onseeked = resolve;
      video.onerror = reject;
    });

    return await classifyElement(video);
  } finally {
    URL.revokeObjectURL(url);
  }
};

const classifyElement = async (element) => {
  const model = await getModel();
  const predictions = await model.classify(element, 5);
  return summarizeFruitRecognitionPredictions(predictions);
};

export const summarizeFruitRecognitionPredictions = (predictions = []) => {
  const matched = predictions.find((prediction) =>
    FRUIT_WORDS.some((word) =>
      prediction.className.toLowerCase().includes(word)
    )
  );
  const obstruction = predictions.find((prediction) =>
    OBSTRUCTION_WORDS.some((word) => prediction.className.toLowerCase().includes(word))
  );
  const obstructionConfidence = Number(obstruction?.probability || 0);
  const fruitConfidence = Number(matched?.probability || 0);
  const significantObstruction = Boolean(
    obstruction && obstructionConfidence >= 0.45 && obstructionConfidence >= fruitConfidence * 0.8
  );

  if (matched) {
    return {
      accepted: !significantObstruction,
      label: matched.className,
      probability: matched.probability,
      obstruction: obstruction
        ? { label: obstruction.className, probability: obstructionConfidence, significant: significantObstruction }
        : null,
      warning: obstruction
        ? "Please keep hands and other objects away from the fruit before capturing."
        : "",
    };
  }

  return {
    accepted: false,
    label: predictions[0]?.className || "unknown object",
    probability: predictions[0]?.probability || 0,
    obstruction: obstruction
      ? { label: obstruction.className, probability: obstructionConfidence, significant: true }
      : null,
    warning: obstruction
      ? "Please keep hands and other objects away from the fruit before capturing."
      : "",
  };
};

const fileToImage = (file) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = URL.createObjectURL(file);
  });
