"""Color prediction service — DINOv2 single-head 18-class (Gem×Hue×Intensity)."""
import io
import torch
import torch.nn as nn
from PIL import Image
from torchvision import transforms
from transformers import Dinov2Model

from app.config import COLOR_MODEL_PATH, COLOR_CLASSES

IMG_SIZE = 518
_IMAGENET_MEAN = [0.485, 0.456, 0.406]
_IMAGENET_STD = [0.229, 0.224, 0.225]


class ColorClassifier(nn.Module):
    """DINOv2 backbone + single classification head over the 18 color classes.
    Head layout matches the checkpoint: LayerNorm(768) → Linear(768,512) →
    ReLU → Dropout → Linear(512, num_classes)."""
    def __init__(self, num_classes: int, dropout: float = 0.3):
        super().__init__()
        self.backbone = Dinov2Model.from_pretrained("facebook/dinov2-base")
        for p in self.backbone.parameters():
            p.requires_grad = False
        h = 768
        self.head = nn.Sequential(
            nn.LayerNorm(h), nn.Linear(h, 512), nn.ReLU(),
            nn.Dropout(dropout), nn.Linear(512, num_classes),
        )

    def forward(self, x):
        feats = self.backbone(x).last_hidden_state[:, 0]
        return self.head(feats)


_color_model: ColorClassifier | None = None
_color_transform: transforms.Compose | None = None
_device: torch.device | None = None


def color_label(cls: dict) -> str:
    """Combined display label, e.g. 'Swiss Blue Vivid'."""
    return f"{cls['hue']} {cls['intensity']}"


def load_color_model() -> None:
    global _color_model, _color_transform, _device
    if _color_model is not None:
        return
    _device = torch.device(
        "mps" if torch.backends.mps.is_available()
        else "cuda" if torch.cuda.is_available() else "cpu"
    )
    print(f"Loading color model from {COLOR_MODEL_PATH} on {_device}...")
    ckpt = torch.load(COLOR_MODEL_PATH, map_location=_device, weights_only=False)
    state = ckpt.get("model_state", ckpt.get("model_state_dict", ckpt))
    _color_model = ColorClassifier(len(COLOR_CLASSES)).to(_device)
    _color_model.load_state_dict(state)
    _color_model.eval()
    _color_transform = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(_IMAGENET_MEAN, _IMAGENET_STD),
    ])
    print(f"  color classes: {[color_label(c) for c in COLOR_CLASSES]}")


def predict_color_one(image: Image.Image) -> list[float]:
    """Return the raw 18-way probability list, aligned to COLOR_CLASSES order."""
    if _color_model is None:
        load_color_model()
    x = _color_transform(image).unsqueeze(0).to(_device)
    with torch.no_grad():
        logits = _color_model(x)
    return torch.softmax(logits, dim=1)[0].cpu().tolist()


def summarize_color(probs: list[float], gem_type: str) -> dict:
    """Filter the 18-way distribution to the selected gem variety, renormalize,
    and split into Hue and Intensity marginals (+ the top combined class)."""
    idx = [i for i, c in enumerate(COLOR_CLASSES) if c["gem_type"] == gem_type]
    if not idx:  # unknown gem type -> fall back to all classes
        idx = list(range(len(COLOR_CLASSES)))
    total = sum(probs[i] for i in idx) or 1.0

    hue: dict[str, float] = {}
    intensity: dict[str, float] = {}
    combined: dict[str, float] = {}
    for i in idx:
        p = probs[i] / total
        c = COLOR_CLASSES[i]
        hue[c["hue"]] = hue.get(c["hue"], 0.0) + p
        intensity[c["intensity"]] = intensity.get(c["intensity"], 0.0) + p
        combined[color_label(c)] = combined.get(color_label(c), 0.0) + p
    return {"hue_probs": hue, "intensity_probs": intensity, "combined_probs": combined}


def predict_color_bytes(img_bytes: bytes) -> list[float]:
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    return predict_color_one(img)


def color_classes() -> dict:
    """Grouped label lists for the /identify/classes endpoint."""
    hues, intensities = [], []
    for c in COLOR_CLASSES:
        if c["hue"] not in hues:
            hues.append(c["hue"])
        if c["intensity"] not in intensities:
            intensities.append(c["intensity"])
    return {"hue": hues, "intensity": intensities, "combined": [color_label(c) for c in COLOR_CLASSES]}
