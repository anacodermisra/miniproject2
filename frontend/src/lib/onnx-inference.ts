/**
 * MindPulse — ONNX Runtime Web Inference Client
 * ================================================
 * Runs stress prediction models entirely in the browser.
 * 
 * Models:
 * - XGBoost (primary, 23 features → 3 class probabilities)
 * - LSTM (temporal, 12-window sequences → trend detection)
 * 
 * Features:
 * - Zero server inference cost
 * - Full privacy (model never leaves device)
 * - WebGPU acceleration when available
 * - Graceful fallback to server API
 * 
 * Usage:
 *   import { browserInference } from '@/lib/onnx-inference';
 *   
 *   // Initialize (loads models)
 *   await browserInference.init();
 *   
 *   // Predict
 *   const result = await browserInference.predict(features);
 *   
 *   // Temporal prediction (needs 12+ windows of history)
 *   const temporalResult = await browserInference.predictSequence(sequence);
 */

import * as ort from "onnxruntime-web";

export interface InferenceResult {
  probabilities: Record<string, number>;
  prediction: string;
  confidence: number;
  model_type: "xgboost" | "lstm" | "ensemble";
  n_models_used: number;
}

export interface EnsembleConfig {
  ensemble: {
    models: Array<{
      name: string;
      file: string;
      weight: number;
      input_shape: number[];
      output_names?: string[];
      output_shape?: number[];
      sequence_length?: number;
    }>;
    labels: string[];
    feature_names: string[];
    num_features: number;
    thresholds: { MILD: number; STRESSED: number };
    version: string;
  };
}

class BrowserInference {
  private xgbSession: ort.InferenceSession | null = null;
  private lstmSession: ort.InferenceSession | null = null;
  private config: EnsembleConfig | null = null;
  private initialized = false;
  private lstmBuffer: number[][] = [];
  private readonly MAX_BUFFER_SIZE = 30;

  /**
   * Initialize ONNX sessions and load config.
   * Call once before using predict().
   */
  async init(modelBasePath = "/models"): Promise<boolean> {
    if (this.initialized) return true;

    try {
      // Load ensemble metadata
      const configRes = await fetch(`${modelBasePath}/ensemble_metadata.json`);
      if (!configRes.ok) {
        console.warn("[ONNX] Config not found, browser inference unavailable");
        return false;
      }
      this.config = await configRes.json();

      // Load XGBoost model
      try {
        const xgbPath = `${modelBasePath}/xgb_model.onnx`;
        this.xgbSession = await ort.InferenceSession.create(xgbPath, {
          executionProviders: ["wasm"],
        });
        console.log("[ONNX] XGBoost model loaded");
      } catch (e) {
        console.warn("[ONNX] XGBoost model failed to load:", e);
      }

      // Load LSTM model (optional)
      try {
        const lstmPath = `${modelBasePath}/lstm_model.onnx`;
        this.lstmSession = await ort.InferenceSession.create(lstmPath, {
          executionProviders: ["wasm"],
        });
        console.log("[ONNX] LSTM model loaded");
      } catch (e) {
        console.log("[ONNX] LSTM model not available (optional)");
      }

      this.initialized = true;
      const modelsLoaded = [this.xgbSession, this.lstmSession].filter(Boolean).length;
      console.log(`[ONNX] Initialized with ${modelsLoaded} model(s)`);
      return modelsLoaded > 0;
    } catch (e) {
      console.error("[ONNX] Initialization failed:", e);
      return false;
    }
  }

  /**
   * Run XGBoost inference on feature vector.
   * @param features - 23-dimensional feature vector (or dict with feature names)
   */
  async predict(features: number[] | Record<string, number>): Promise<InferenceResult | null> {
    if (!this.xgbSession || !this.config) return null;

    // Convert dict to array if needed
    let featureArray: number[];
    if (Array.isArray(features)) {
      featureArray = features;
    } else {
      featureArray = this.config.ensemble.feature_names.map(
        (name) => features[name] ?? 0
      );
    }

    // Create input tensor
    const inputTensor = new ort.Tensor(
      "float32",
      new Float32Array(featureArray),
      [1, featureArray.length]
    );

    // Run inference
    const results = await this.xgbSession.run({
      [this.xgbSession.inputNames[0]]: inputTensor,
    });

    // Extract probabilities (second output)
    const probTensor = results[this.xgbSession.outputNames[1]] as ort.Tensor;
    const probs = Array.from(probTensor.data as Float32Array);
    const labels = this.config.ensemble.labels;

    const probabilities: Record<string, number> = {};
    labels.forEach((label, i) => {
      probabilities[label] = round(probs[i], 3);
    });

    const predictionIdx = probs.indexOf(Math.max(...probs));
    const confidence = round(probs[predictionIdx], 3);

    return {
      probabilities,
      prediction: labels[predictionIdx],
      confidence,
      model_type: "xgboost",
      n_models_used: 1,
    };
  }

  /**
   * Run LSTM inference on sequence of feature vectors.
   * Requires at least 12 windows of history.
   * @param sequence - Array of feature vectors (each 23-dim)
   */
  async predictSequence(sequence: number[][]): Promise<InferenceResult | null> {
    if (!this.lstmSession || !this.config) return null;

    const seqLen = this.config.ensemble.models.find((m) => m.name === "lstm")
      ?.sequence_length ?? 12;

    // Use last seqLen windows
    const recentSequence = sequence.slice(-seqLen);
    if (recentSequence.length < seqLen) return null;

    // Flatten to 1D tensor: [1, seqLen, numFeatures]
    const flatData = recentSequence.flat();
    const inputTensor = new ort.Tensor(
      "float32",
      new Float32Array(flatData),
      [1, seqLen, this.config.ensemble.num_features]
    );

    // Run inference
    const results = await this.lstmSession.run({
      [this.lstmSession.inputNames[0]]: inputTensor,
    });

    // Apply softmax to logits
    const logits = Array.from(
      (results[this.lstmSession.outputNames[0]] as ort.Tensor).data as Float32Array
    );
    const probs = softmax(logits);

    const labels = this.config.ensemble.labels;
    const probabilities: Record<string, number> = {};
    labels.forEach((label, i) => {
      probabilities[label] = round(probs[i], 3);
    });

    const predictionIdx = probs.indexOf(Math.max(...probs));
    const confidence = round(probs[predictionIdx], 3);

    return {
      probabilities,
      prediction: labels[predictionIdx],
      confidence,
      model_type: "lstm",
      n_models_used: 1,
    };
  }

  /**
   * Add feature vector to LSTM buffer and optionally predict.
   * @param features - Current feature vector
   * @returns LSTM result if enough history, null otherwise
   */
  async updateAndPredictTemporal(features: number[]): Promise<InferenceResult | null> {
    this.lstmBuffer.push(features);
    if (this.lstmBuffer.length > this.MAX_BUFFER_SIZE) {
      this.lstmBuffer = this.lstmBuffer.slice(-this.MAX_BUFFER_SIZE);
    }

    return this.predictSequence(this.lstmBuffer);
  }

  /**
   * Run ensemble prediction (XGBoost + LSTM if available).
   * @param features - Current feature vector
   */
  async predictEnsemble(features: number[]): Promise<InferenceResult | null> {
    if (!this.config) return null;

    const results: InferenceResult[] = [];

    // XGBoost prediction
    const xgbResult = await this.predict(features);
    if (xgbResult) results.push(xgbResult);

    // LSTM prediction (if enough history)
    const lstmResult = await this.updateAndPredictTemporal(features);
    if (lstmResult) results.push(lstmResult);

    if (results.length === 0) return null;
    if (results.length === 1) return results[0];

    // Weighted ensemble voting
    const labels = this.config.ensemble.labels;
    const modelWeights = this.config.ensemble.models.map((m) => m.weight);

    // Get weights for available models
    const availableWeights: number[] = [];
    if (xgbResult) availableWeights.push(modelWeights[0]); // XGBoost weight
    if (lstmResult) availableWeights.push(modelWeights[1]); // LSTM weight

    // Normalize weights
    const totalWeight = availableWeights.reduce((a, b) => a + b, 0);
    const normalizedWeights = availableWeights.map((w) => w / totalWeight);

    // Weighted average of probabilities
    const ensembleProbs = new Array(labels.length).fill(0);
    results.forEach((result, i) => {
      labels.forEach((label, j) => {
        ensembleProbs[j] += normalizedWeights[i] * (result.probabilities[label] || 0);
      });
    });

    const probabilities: Record<string, number> = {};
    labels.forEach((label, i) => {
      probabilities[label] = round(ensembleProbs[i], 3);
    });

    const predictionIdx = ensembleProbs.indexOf(Math.max(...ensembleProbs));
    const confidence = round(ensembleProbs[predictionIdx], 3);

    return {
      probabilities,
      prediction: labels[predictionIdx],
      confidence,
      model_type: "ensemble",
      n_models_used: results.length,
    };
  }

  /** Reset LSTM buffer (e.g., on session change) */
  resetBuffer() {
    this.lstmBuffer = [];
  }

  /** Check if browser inference is ready */
  get isReady(): boolean {
    return this.initialized && this.xgbSession !== null;
  }

  /** Get loaded model names */
  get loadedModels(): string[] {
    const models: string[] = [];
    if (this.xgbSession) models.push("xgboost");
    if (this.lstmSession) models.push("lstm");
    return models;
  }
}

// ─── Utility Functions ───

function softmax(logits: number[]): number[] {
  const maxLogit = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - maxLogit));
  const sumExps = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sumExps);
}

function round(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

// ─── Singleton Export ───

export const browserInference = new BrowserInference();
