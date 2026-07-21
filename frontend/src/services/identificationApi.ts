const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface LabelResult {
  label: string;
  confidence: number;
}

export interface CutBlock {
  shape: LabelResult;
  cut_style: LabelResult;
  shape_probs: Record<string, number>;
  cut_style_probs: Record<string, number>;
}

export interface ColorBlock {
  hue: LabelResult;
  intensity: LabelResult;
  hue_probs: Record<string, number>;
  intensity_probs: Record<string, number>;
}

export interface ClarityBlock {
  grade: LabelResult;
  clarity_probs: Record<string, number>;
}

export interface IdentifyResponse {
  status: string;
  gem_type: string;
  image_count: number;
  aggregate: { cut: CutBlock; color: ColorBlock; clarity: ClarityBlock };
  per_image: Array<{ filename: string; cut: CutBlock; color: ColorBlock; clarity: ClarityBlock }>;
}

export interface IdentifyClasses {
  cut: { shape: string[]; cut_style: string[] };
  color: { hue: string[]; intensity: string[]; combined: string[] };
  clarity: string[];
}


export async function fetchGemTypes(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/gem-types`);

  if (!res.ok) {
    throw new Error(`Failed to fetch gem types: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data.gem_types;
}


export async function fetchIdentifyClasses(): Promise<IdentifyClasses> {
  const res = await fetch(`${API_BASE}/identify/classes`);

  if (!res.ok) {
    throw new Error(`Failed to fetch identify classes: ${res.status} ${res.statusText}`);
  }

  return res.json();
}


export async function identifyGem(
  gemType: string,
  images: File[]
): Promise<IdentifyResponse> {
  const formData = new FormData();
  formData.append("gem_type", gemType);
  images.forEach((img) => formData.append("files", img, img.name));

  const res = await fetch(`${API_BASE}/identify`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail || `Identification failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}
