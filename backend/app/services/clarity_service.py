"""Clarity prediction service — EfficientNet-B0, 5 clarity grades."""
import io
import torch
import torch.nn as nn
from PIL import Image
from torchvision import transforms
from torchvision.models import efficientnet_v2_s

from app.config import CLARITY_MODEL_PATH

# ponytail: EfficientNetV2-S eval resolution. If clarity accuracy looks off,
# this is the first knob — set it to whatever the model was trained at.
IMG_SIZE = 384
_IMAGENET_MEAN = [0.485, 0.456, 0.406]
_IMAGENET_STD = [0.229, 0.224, 0.225]


class ClarityClassifier(nn.Module):
    """EfficientNetV2-S wrapped as `net` (matches checkpoint key prefix)."""
    def __init__(self, num_classes: int):
        super().__init__()
        self.net = efficientnet_v2_s(weights=None)
        in_f = self.net.classifier[1].in_features  # 1280
        self.net.classifier[1] = nn.Linear(in_f, num_classes)

    def forward(self, x):
        return self.net(x)


_clarity_model: ClarityClassifier | None = None
_clarity_transform: transforms.Compose | None = None
_clarity_classes: list[str] | None = None
_device: torch.device | None = None


def _pretty(label: str) -> str:
    """'Very_Very_Slightly_Included' -> 'Very Very Slightly Included'."""
    return label.replace("_", " ")


def load_clarity_model() -> None:
    global _clarity_model, _clarity_transform, _clarity_classes, _device
    if _clarity_model is not None:
        return
    _device = torch.device(
        "mps" if torch.backends.mps.is_available()
        else "cuda" if torch.cuda.is_available() else "cpu"
    )
    print(f"Loading clarity model from {CLARITY_MODEL_PATH} on {_device}...")
    ckpt = torch.load(CLARITY_MODEL_PATH, map_location=_device, weights_only=False)
    _clarity_classes = ckpt["classes"]
    _clarity_model = ClarityClassifier(len(_clarity_classes)).to(_device)
    _clarity_model.load_state_dict(ckpt["model_state_dict"])
    _clarity_model.eval()
    _clarity_transform = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(_IMAGENET_MEAN, _IMAGENET_STD),
    ])
    print(f"  clarity classes: {_clarity_classes}")


def predict_clarity_one(image: Image.Image) -> dict:
    if _clarity_model is None:
        load_clarity_model()
    x = _clarity_transform(image).unsqueeze(0).to(_device)
    with torch.no_grad():
        logits = _clarity_model(x)
    probs = torch.softmax(logits, dim=1)[0].cpu().numpy()
    return {"clarity_probs": {_pretty(n): float(probs[i]) for i, n in enumerate(_clarity_classes)}}


def predict_clarity_bytes(img_bytes: bytes) -> dict:
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    return predict_clarity_one(img)


def clarity_classes() -> list[str]:
    return [_pretty(c) for c in (_clarity_classes or [])]
