// Quality heuristics only; these do not identify or authenticate a document.
export function checkCaptureQuality({ data, width, height }, sourceWidth, sourceHeight) {
  if (Math.min(sourceWidth, sourceHeight) < 720) return "Move closer or use a higher resolution camera";
  let sum = 0, dark = 0, light = 0, edges = 0, edgeSquares = 0, count = 0;
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const v = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;
    gray[i] = v; sum += v; dark += v < 35; light += v > 248;
  }
  if (sum / gray.length < 65 || dark / gray.length > 0.65) return "Improve lighting";
  if (sum / gray.length > 235 || light / gray.length > 0.65) return "Reduce glare";
  const regions = [0, 0, 0, 0];
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x;
    const edge = gray[i - 1] + gray[i + 1] + gray[i - width] + gray[i + width] - 4 * gray[i];
    if (Math.abs(edge) > 25) regions[(y >= height / 2 ? 2 : 0) + (x >= width / 2 ? 1 : 0)]++;
    edges += edge; edgeSquares += edge * edge; count++;
  }
  if (!count || edgeSquares / count - (edges / count) ** 2 < 90) return "Image is blurred. Hold camera steady";
  if (regions.filter((amount) => amount > count * 0.005).length < 3) return "Move document inside frame";
  return "";
}
