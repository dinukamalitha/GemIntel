"""Cut prediction service — DINOv2 multi-task (shape + cut style)."""
import io
import torch
import torch.nn as nn
from PIL import Image
from torchvision import transforms
from transformers import Dinov2Model
from app.config import CUT_MODEL_PATH

IMG_SIZE = 518
_IMAGENET_MEAN = [0.485, 0.456, 0.406]
_IMAGENET_STD = [0.229, 0.224, 0.225]


class MultiTaskCutClassifier(nn.Module):
    def __init__(self, num_shapes: int, num_cuts: int, dropout: float = 0.3):
        super().__init__()
        self.backbone = Dinov2Model.from_pretrained("facebook/dinov2-base")
        for p in self.backbone.parameters():
            p.requires_grad = False
        h = 768
        self.shape_head = nn.Sequential(
            nn.Linear(h, 512), nn.BatchNorm1d(512), nn.ReLU(),
            nn.Dropout(dropout), nn.Linear(512, 256), nn.ReLU(),
            nn.Dropout(dropout * 0.5), nn.Linear(256, num_shapes),
        )
        self.cut_head = nn.Sequential(
            nn.Linear(h, 256), nn.BatchNorm1d(256), nn.ReLU(),
            nn.Dropout(dropout), nn.Linear(256, num_cuts),
        )

    def forward(self, x):
        feats = self.backbone(x).last_hidden_state[:, 0]
        return self.shape_head(feats), self.cut_head(feats)


_cut_model: MultiTaskCutClassifier | None = None
_cut_transform: transforms.Compose | None = None
_shape_classes: list[str] | None = None
_cut_classes: list[str] | None = None
_device: torch.device | None = None


def load_cut_model() -> None:
    global _cut_model, _cut_transform, _shape_classes, _cut_classes, _device
    if _cut_model is not None:
        return
    _device = torch.device(
        "mps" if torch.backends.mps.is_available()
        else "cuda" if torch.cuda.is_available() else "cpu"
    )
    print(f"Loading cut model from {CUT_MODEL_PATH} on {_device}...")
    ckpt = torch.load(CUT_MODEL_PATH, map_location=_device, weights_only=False)
    _shape_classes = ckpt["shape_classes"]
    _cut_classes = ckpt["cut_classes"]
    _cut_model = MultiTaskCutClassifier(len(_shape_classes), len(_cut_classes)).to(_device)
    _cut_model.load_state_dict(ckpt["model_state_dict"])
    _cut_model.eval()
    _cut_transform = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(_IMAGENET_MEAN, _IMAGENET_STD),
    ])
    print(f"  shapes: {_shape_classes}")
    print(f"  cut styles: {_cut_classes}")


def predict_cut_one(image: Image.Image) -> dict:
    if _cut_model is None:
        load_cut_model()
    x = _cut_transform(image).unsqueeze(0).to(_device)
    with torch.no_grad():
        shape_logits, cut_logits = _cut_model(x)
    shape_probs = torch.softmax(shape_logits, dim=1)[0].cpu().numpy()
    cut_probs = torch.softmax(cut_logits, dim=1)[0].cpu().numpy()
    return {
        "shape_probs": {n: float(shape_probs[i]) for i, n in enumerate(_shape_classes)},
        "cut_style_probs": {n: float(cut_probs[i]) for i, n in enumerate(_cut_classes)},
    }


def predict_cut_bytes(img_bytes: bytes) -> dict:
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    return predict_cut_one(img)


def cut_classes() -> dict:
    return {"shape": _shape_classes or [], "cut_style": _cut_classes or []}
