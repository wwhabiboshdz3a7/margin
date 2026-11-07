import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, type GenerativeModel } from "firebase/ai";

/**
 * Three privacy postures, mapped straight onto Firebase AI Logic's hybrid inference modes.
 *   private → ONLY_ON_DEVICE   (nothing leaves the laptop; errors if Gemini Nano isn't there)
 *   auto    → PREFER_ON_DEVICE (on-device when possible, Gemini in the cloud otherwise)
 *   cloud   → ONLY_IN_CLOUD    (always Gemini in the cloud, for long notes or weak devices)
 */
export type Posture = "private" | "auto" | "cloud";

export const POSTURES: Record<Posture, { mode: InferenceMode; title: string; blurb: string }> = {
  private: { mode: InferenceMode.ONLY_ON_DEVICE, title: "Private", blurb: "On-device only. Works offline. Never leaves this machine." },
  auto: { mode: InferenceMode.PREFER_ON_DEVICE, title: "Auto", blurb: "On-device first, Gemini in the cloud when the device can't." },
  cloud: { mode: InferenceMode.ONLY_IN_CLOUD, title: "Cloud", blurb: "Always Gemini in the cloud. Best for long notes." },
};

const env = import.meta.env;

export const cloudConfigured = Boolean(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_APP_ID);
export const CLOUD_MODEL: string = env.VITE_CLOUD_MODEL || "gemini-2.5-flash";

let app: FirebaseApp | null = null;
function getApp() {
  if (!app) {
    app = initializeApp({
      apiKey: env.VITE_FIREBASE_API_KEY || "not-configured",
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID || "not-configured",
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: env.VITE_FIREBASE_APP_ID || "not-configured",
    });
  }
  return app;
}

const models = new Map<Posture, GenerativeModel>();

/** One hybrid model per posture. The SDK decides on-device vs cloud per request and tells us which it used. */
export function modelFor(posture: Posture): GenerativeModel {
  let m = models.get(posture);
  if (!m) {
    const ai = getAI(getApp(), { backend: new GoogleAIBackend() });
    m = getGenerativeModel(ai, {
      mode: POSTURES[posture].mode,
      inCloudParams: { model: CLOUD_MODEL, generationConfig: { temperature: 0.4 } },
      onDeviceParams: {
        createOptions: { expectedInputs: [{ type: "text" }], expectedOutputs: [{ type: "text" }] },
      },
    });
    models.set(posture, m);
  }
  return m;
}

/** What Chrome's built-in model says about itself. "available" means Gemini Nano is ready. */
export type OnDeviceStatus = "available" | "downloadable" | "downloading" | "unavailable" | "unsupported";

export async function onDeviceStatus(): Promise<OnDeviceStatus> {
  const LM = (globalThis as unknown as { LanguageModel?: { availability: (o?: unknown) => Promise<string> } }).LanguageModel;
  if (!LM) return "unsupported";
  try {
    const a = await LM.availability({ expectedInputs: [{ type: "text" }], expectedOutputs: [{ type: "text" }] });
    if (a === "available" || a === "downloadable" || a === "downloading" || a === "unavailable") return a;
    return "unavailable";
  } catch {
    return "unavailable";
  }
}
