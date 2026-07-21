const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

export interface CaratResult {
  gem_type: string;
  cut_shape: string;
  coin_diameter_mm: number;
  dimensions_mm: { length: number; width: number; depth: number };
  carat: number;
  specific_gravity: number;
  shape_factor: number;
  scale_px_per_mm: { top: number; side: number };
  warnings: string[];
}

export interface CaratOptions {
  gem_types: string[];
  cut_shapes: string[];
}

export async function fetchCaratOptions(): Promise<CaratOptions> {
  const res = await fetch(`${API_BASE}/api/carat/options`);
  if (!res.ok) throw new Error(`Failed to load options: ${res.status}`);
  return res.json();
}

export async function estimateCarat(params: {
  topImage: File;
  sideImage: File;
  gemType: string;
  cutShape: string;
  coinDiameterMm: number;
}): Promise<CaratResult> {
  const form = new FormData();
  form.append("top_image", params.topImage);
  form.append("side_image", params.sideImage);
  form.append("gem_type", params.gemType);
  form.append("cut_shape", params.cutShape);
  form.append("coin_diameter_mm", String(params.coinDiameterMm));

  const res = await fetch(`${API_BASE}/api/carat/estimate`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail || `Estimation failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
