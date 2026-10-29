import "../vendor/magika/license";
import "@tensorflow/tfjs-backend-cpu";
import { MathBackendWebGL } from "@tensorflow/tfjs-backend-webgl";
import { type GraphModel, loadGraphModelSync } from "@tensorflow/tfjs-converter";
import {
  backend, dispose, env, findBackendFactory, getKernelsForBackend, io, ready, removeBackend, type Tensor, tensor2d,
  unregisterKernel,
} from "@tensorflow/tfjs-core";
import config from "../vendor/magika/config.min.json";
import weights from "../vendor/magika/group1-shard1of1.bin";
import modelJson from "../vendor/magika/model.json";

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
    const model = new MagikaModel(loadGraphModelSync([modelJson as io.ModelJSON, weights.slice().buffer]));
    const webgl = backend();
    if (webgl instanceof MathBackendWebGL) {
      await model.compileShaders(webgl);
    }
    return model;
  }

  /**
   * Top content type for trimmed text, e.g. "python" or "txt", or null when Magika is below its
   * own threshold for it. Google tuned those per type, which a single user threshold can't beat.
   */
  async predict(text: string): Promise<string | null> {
    const scores = await this.score(text);
    let best = 0;
    for (let i = 1; i < scores.length; i++) {
      if (scores[i] > scores[best]) best = i;
    }
    const label = config.target_labels_space[best];
    return scores[best] >= (thresholds[label] ?? config.medium_confidence_threshold) ? label : null;
  }

  /**
   * Frees the model, and the backends and kernels TensorFlow.js keeps on the global window, which
   * outlive the plugin: the WebGL backend's GPU memory, and kernels the next load would register
   * again with hundreds of warnings. Only for unload: this copy of TensorFlow.js can't run again.
   */
  dispose(): void {
    this.model.dispose();
    for (const name of ["webgl", "cpu"]) {
      if (findBackendFactory(name)) removeBackend(name);
      for (const { kernelName } of getKernelsForBackend(name)) unregisterKernel(kernelName, name);
    }
  }

  private async score(text: string): Promise<ArrayLike<number>> {
    const features = extractFeatures(text);
    const input = tensor2d(features, [1, features.length], "int32");
    const output = (await this.model.executeAsync(input)) as Tensor;
    const scores = await output.data();
    dispose([input, output]);
    return scores;
  }

  /**
   * Compiles the GPU shaders in the background. A plain first prediction compiles them on the
   * main thread, which froze Obsidian for up to 5 seconds the first time; this leaves ~0.1 s.
   */
  private async compileShaders(webgl: MathBackendWebGL): Promise<void> {
    env().set("ENGINE_COMPILE_ONLY", true);
    try {
      // A whole prediction, reading the scores too, so the shaders that fetch them compile as well.
      await this.score("");
    } finally {
      env().set("ENGINE_COMPILE_ONLY", false);
    }
    await webgl.checkCompileCompletionAsync();
    webgl.getUniformLocations();
  }
}
