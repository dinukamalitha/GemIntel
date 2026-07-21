"""
Carat (weight) estimation from two calibrated photos.

This is a physics measurement pipeline, NOT a trained model. Weight is
deterministic: carat = volume x density. Each photo carries a coin of known
diameter as a scale reference, which cancels camera distance and focal length.

    TOP view  -> stone L, W (mm)     via that image's coin scale
    SIDE view -> stone D / depth (mm) via that image's coin scale
    carat = L * W * D * SG * shape_factor   (round/cushion use Diameter^2)

Species (gem_type) only supplies the specific gravity (SG) lookup.
"""

import io
import cv2
import numpy as np
from PIL import Image, ImageOps

# Optional HEIC/HEIF (iPhone) support. If pillow-heif is installed, register it
# so decode_image() can read .heic uploads; otherwise HEIC simply fails with a
# clear message and the other formats keep working.
try:
    import pillow_heif  # type: ignore
    pillow_heif.register_heif_opener()
    _HEIC_OK = True
except Exception:
    _HEIC_OK = False


# --- Physics constants ------------------------------------------------------
# Specific gravity per species (point values within the accepted ranges).
# Keyed by the API's gem_type values.
SG = {
    "blue_sapphire": 4.00,
    "spinel":        3.60,
    "topaz":         3.53,
}

# International Gem Society weight-estimation shape factors (dimensions in mm,
# result in carats — the factor already folds in the unit scaling).
SHAPE_FACTOR = {
    "round":    0.0018,
    "oval":     0.0020,
    "cushion":  0.0018,
    "pear":     0.0018,
    "square":   0.0023,
    "marquise": 0.0016,
    "octagon":  0.0025,
    "heart":    0.0021,
}

# Shapes whose girdle outline is measured as a diameter, not L x W.
USE_DIAMETER_SQUARED = {"round", "cushion"}

# Native-cut correction (Sri Lankan cuts bulge vs ideal proportions the shape
# factors assume). 1.00 = ideal; calibrate ~1.05-1.12 against weighed stones.
NATIVE_CUT_FACTOR = 1.00

# Below this the pixel-edge uncertainty dominates the measurement.
MIN_PPM = 30.0   # pixels per mm


def decode_image(raw_bytes: bytes) -> np.ndarray:
    """Decode any common image (incl. iPhone HEIC) to a BGR numpy array,
    applying EXIF rotation so sideways phone photos don't swap L and W."""
    try:
        pil = Image.open(io.BytesIO(raw_bytes))
        pil = ImageOps.exif_transpose(pil).convert("RGB")
        return cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
    except Exception as e:
        img = cv2.imdecode(np.frombuffer(raw_bytes, np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            hint = "" if _HEIC_OK else " (HEIC support not installed: pip install pillow-heif)"
            raise ValueError(f"Could not decode image{hint}: {e}")
        return img


def detect_coin(img: np.ndarray, work_max: int = 1200):
    """Detect the coin via HoughCircles on a downscaled copy (fast on large
    phone photos), returning (cx, cy, r) at full resolution, or None.

    Robust to low-contrast / dark / slightly-angled coins on fabric: contrast is
    boosted with CLAHE and the accumulator threshold is swept from strict to
    permissive, taking the largest circle found."""
    h, w = img.shape[:2]
    scale = min(1.0, work_max / max(h, w))
    small = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    gray = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)  # boost contrast
    gray = cv2.medianBlur(gray, 5)
    min_dim = min(gray.shape[:2])

    # Sweep param2 (accumulator threshold) strict -> permissive so a faint coin
    # still registers; the largest detected circle is taken as the coin.
    for param2 in (60, 45, 35, 28, 22):
        circles = cv2.HoughCircles(
            gray, cv2.HOUGH_GRADIENT, dp=1.2, minDist=min_dim,
            param1=120, param2=param2,
            minRadius=int(min_dim * 0.05), maxRadius=int(min_dim * 0.55),
        )
        if circles is not None:
            cx, cy, r = max(np.round(circles[0, :]).astype(int), key=lambda c: c[2])
            return (int(cx / scale), int(cy / scale), int(r / scale))
    return None


def segment_stone(img: np.ndarray, coin, label: str):
    """Segment the stone against a plain background (Otsu, both polarities,
    coin masked out) and return its cv2.minAreaRect."""
    cx, cy, r = coin
    gray = cv2.GaussianBlur(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), (5, 5), 0)

    coin_mask = np.zeros(gray.shape, dtype=np.uint8)
    cv2.circle(coin_mask, (cx, cy), int(r * 1.15), 255, -1)

    _, th_dark = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    _, th_light = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    best = None
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    for th in (th_dark, th_light):
        m = th.copy()
        m[coin_mask > 0] = 0
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, kernel, iterations=2)
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, kernel, iterations=2)
        cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not cnts:
            continue
        c = max(cnts, key=cv2.contourArea)
        frac = cv2.contourArea(c) / (gray.shape[0] * gray.shape[1])
        if frac > 0.85 or frac < 0.001:
            continue
        if best is None or cv2.contourArea(c) > best[0]:
            best = (cv2.contourArea(c), c)

    if best is None:
        raise ValueError(
            f"Could not segment the stone in the {label} image. "
            "Use a plainer background / better lighting."
        )
    return cv2.minAreaRect(best[1])


def _rect_sides(rect):
    """Return (long_px, short_px) of a minAreaRect."""
    (_, _), (w_px, h_px), _ = rect
    return max(w_px, h_px), min(w_px, h_px)


def estimate_carat(
    top_bytes: bytes,
    side_bytes: bytes,
    gem_type: str,
    cut_shape: str,
    coin_diameter_mm: float,
) -> dict:
    """Full pipeline: two images + coin diameter -> carat estimate."""
    if gem_type not in SG:
        raise ValueError(f"gem_type must be one of {sorted(SG)}")
    if cut_shape not in SHAPE_FACTOR:
        raise ValueError(f"cut_shape must be one of {sorted(SHAPE_FACTOR)}")
    if coin_diameter_mm <= 0:
        raise ValueError("coin_diameter_mm must be positive")

    warnings = []

    top_img = decode_image(top_bytes)
    side_img = decode_image(side_bytes)

    top_coin = detect_coin(top_img)
    side_coin = detect_coin(side_img)
    if top_coin is None:
        raise ValueError("Coin not found in the TOP image. Use a plain background and keep the whole coin in frame.")
    if side_coin is None:
        raise ValueError("Coin not found in the SIDE image. Use a plain background and keep the whole coin in frame.")

    top_ppm = (2.0 * top_coin[2]) / coin_diameter_mm
    side_ppm = (2.0 * side_coin[2]) / coin_diameter_mm
    for lbl, ppm in (("TOP", top_ppm), ("SIDE", side_ppm)):
        if ppm < MIN_PPM:
            warnings.append(f"{lbl} resolution low ({ppm:.0f} px/mm); fill more of the frame for a reliable result.")
    if abs(top_ppm - side_ppm) / min(top_ppm, side_ppm) > 0.5:
        warnings.append("TOP and SIDE scales differ a lot — likely a coin misdetection; verify the photos.")

    top_rect = segment_stone(top_img, top_coin, "TOP")
    side_rect = segment_stone(side_img, side_coin, "SIDE")

    long_px, short_px = _rect_sides(top_rect)
    L_mm = long_px / top_ppm
    W_mm = short_px / top_ppm
    # Depth = short side of the side-view rect (orientation-invariant thickness).
    D_mm = _rect_sides(side_rect)[1] / side_ppm

    if D_mm > max(L_mm, W_mm):
        # Faceted stones have depth < footprint; this usually means the SIDE
        # photo's orientation or axis was misread.
        warnings.append("Depth exceeds the footprint — check the SIDE photo orientation.")

    if cut_shape in USE_DIAMETER_SQUARED:
        area_term = ((L_mm + W_mm) / 2.0) ** 2
    else:
        area_term = L_mm * W_mm

    carat = area_term * D_mm * SG[gem_type] * SHAPE_FACTOR[cut_shape] * NATIVE_CUT_FACTOR

    return {
        "gem_type": gem_type,
        "cut_shape": cut_shape,
        "coin_diameter_mm": coin_diameter_mm,
        "dimensions_mm": {
            "length": round(L_mm, 2),
            "width": round(W_mm, 2),
            "depth": round(D_mm, 2),
        },
        "carat": round(carat, 2),
        "specific_gravity": SG[gem_type],
        "shape_factor": SHAPE_FACTOR[cut_shape],
        "scale_px_per_mm": {"top": round(top_ppm, 2), "side": round(side_ppm, 2)},
        "warnings": warnings,
    }
