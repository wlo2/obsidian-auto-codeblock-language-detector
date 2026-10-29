import "../vendor/magika/license";
import "@tensorflow/tfjs-backend-cpu";
import "@tensorflow/tfjs-backend-webgl";
import { type GraphModel, loadGraphModelSync } from "@tensorflow/tfjs-converter";
import { dispose, io, ready, type Tensor, tensor2d } from "@tensorflow/tfjs-core";
import config from "../vendor/magika/config.min.json";
import weights from "../vendor/magika/group1-shard1of1.bin";
import modelJson from "../vendor/magika/model.json";

export interface MagikaPrediction {
  label: string; // Magika content type, e.g. "python" or "txt"
  score: number;
}

const thresholds: Partial<Record<string, number>> = config.thresholds;

/**
 * Magika's input: the first bytes left-aligned, then the last bytes right-aligned, each padded
 * to a fixed size. Expects trimmed text, which covers the whitespace Magika strips first.
 */
export function extractFeatures(text: string): Int32Array {
  const bytes = new TextEncoder().encode(text);
  const features = new Int32Array(config.beg_size + config.end_size).fill(config.padding_token);
  features.set(bytes.subarray(0, config.beg_size));
  const end = bytes.subarray(Math.max(0, bytes.length - config.end_size));
  features.set(end, features.length - end.length);
  return features;
}

/** Google's Magika content-type model, run with TensorFlow.js. */
export class MagikaModel {
  private constructor(private readonly model: GraphModel<io.IOHandlerSync>) {}

  static async load(): Promise<MagikaModel> {
    await ready(); // WebGL when the device has it, else the CPU backend
    // slice(): exactly the weight bytes, whatever buffer esbuild decoded them into.
    return new MagikaModel(loadGraphModelSync([modelJson as io.ModelJSON, weights.slice().buffer]));
  }

  /** Top content type for trimmed text, or null when Magika is below its own threshold for it. */
  async predict(text: string): Promise<MagikaPrediction | null> {
    const features = extractFeatures(text);
    const input = tensor2d(features, [1, features.length], "int32");
    const output = (await this.model.executeAsync(input)) as Tensor;
    const scores = await output.data();
    dispose([input, output]);

    let best = 0;
    for (let i = 1; i < scores.length; i++) {
      if (scores[i] > scores[best]) best = i;
    }
    const label = config.target_labels_space[best];
    const score = scores[best];
    return score >= (thresholds[label] ?? config.medium_confidence_threshold) ? { label, score } : null;
  }

  dispose(): void {
    this.model.dispose();
  }
}
