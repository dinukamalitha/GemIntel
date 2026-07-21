const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface PredictionResult {
  session_id: string;
  stone_id: string;
  gem_type: string;
  dimensions: { length_mm: number; width_mm: number; depth_mm: number };
  prediction: {
    cut: string;
    yield_pct: number;
    confidence: number;
    probabilities: Record<string, number>;
  };
  rough_bbox: { x: number; y: number; z: number };
  rough_mesh: {
    vertices: number[];
    indices: number[];
    vertex_count: number;
    face_count: number;
  };
}

export type PipelineStatus =
  | "idle"
  | "uploading"
  | "uploaded"
  | "processing"
  | "generating_masks"
  | "reconstructing"
  | "predicting"
  | "done"
  | "error";


export async function uploadGemImages(
  gemType: string,
  weight: number,
  images: File[]
): Promise<string> {
  const formData = new FormData();
  formData.append("gem_type", gemType);
  formData.append("weight_ct", String(weight));
  images.forEach((img) => formData.append("images", img));

  const res = await fetch(`${API_BASE}/api/cut/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new Error(errBody?.detail || `Upload failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (data && data.score !== undefined) {
    console.log(`[Telemetry] Score: ${data.score}`);
  }
  if (data.status === "invalid input") {
    throw new Error(data.message || "The image entered is not a gem. Please input valid gem images.");
  }
  return data.session_id;
}


export async function startProcessingPipeline(sessionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/cut/process/${sessionId}`, {
    method: "POST",
  });

  if (!res.ok) {
    throw new Error(`Failed to start processing pipeline: ${res.status} ${res.statusText}`);
  }
}


export async function checkPipelineStatus(
  sessionId: string
): Promise<{ status: PipelineStatus; error?: string }> {
  const res = await fetch(`${API_BASE}/api/cut/status/${sessionId}`);

  if (!res.ok) {
    throw new Error(`Failed to fetch pipeline status: ${res.status} ${res.statusText}`);
  }

  return res.json();
}


export async function getPredictionResult(sessionId: string): Promise<PredictionResult> {
  const res = await fetch(`${API_BASE}/api/cut/result/${sessionId}`);

  if (!res.ok) {
    throw new Error(`Failed to fetch prediction results: ${res.status} ${res.statusText}`);
  }

  return res.json();
}


export async function cancelProcessingPipeline(sessionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/cut/cancel/${sessionId}`, {
    method: "POST",
  });

  if (!res.ok) {
    throw new Error(`Failed to cancel processing pipeline: ${res.status} ${res.statusText}`);
  }
}
