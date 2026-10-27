export type RobotAction = 'sit' | 'stand' | 'roll' | 'kickL' | 'kickR' | 'groundpick' | 'recover';
import type { TrialState, Cosmetic, Quality } from '../../game-core/src/types';
export interface SimulationDiagnostics {
  simTime: number;
  simulationHz: number;
  rendererFps: number;
  inferenceMs: number;
  physicsMs: number;
  mode: string;
  paused: boolean;
  contacts: number;
  jointNames: string[];
  jointPositions: number[];
  jointLimits: [number, number][];
  position: [number, number, number];
  yaw: number;
  robotVersion: string;
  policyVersion: string;
  memoryBytes?: number;
  error?: string;
}
export interface SimulationProgress { completed: number; total: number; label: string; }
export interface Simulation {
  setCommand(vx: number, wz: number): void;
  action(action: RobotAction): Promise<void>;
  pause(paused: boolean): void;
  reset(): Promise<void>;
  startTrial(): Promise<void>;
  setCosmetic(cosmetic: Cosmetic): void;
  setQuality(quality: Quality): void;
  step(): Promise<void>;
  getState(): SimulationDiagnostics;
  screenshot(): Promise<Blob>;
  /** Returns a real canvas stream for MediaRecorder; choose a supported MIME type. */
  captureStream(fps?: number): MediaStream;
  setFollowCamera(follow: boolean): void;
  resetCamera(): void;
  addObject(kind: 'ball' | 'block' | 'ramp'): Promise<void>;
  /** Apply a physical impulse to test fall recovery. */
  perturb(): Promise<void>;
  dispose(): void;
}
export interface SimulationOptions {
  onProgress?: (progress: SimulationProgress) => void;
  onDiagnostics?: (diagnostics: SimulationDiagnostics) => void;
  onTrial?: (state: TrialState) => void;
  mode?: 'playground' | 'course';
  cosmetic?: Cosmetic;
  quality?: Quality;
  /** Original model and standing pose only. Full physics loads when false. */
  preview?: boolean;
  signal?: AbortSignal;
}
// JS implementation keeps the upstream loader readable and attributed.
// @ts-ignore The module exports the typed API above.
import { createSimulation as create } from './renderer.js';
export const createSimulation = create as unknown as (container: HTMLElement, options?: SimulationOptions) => Promise<Simulation>;
