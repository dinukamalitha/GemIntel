import os
import joblib
import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from torchvision import transforms
import torchvision.models as models
from app.config import GLOBAL_DOMAIN_FILTER_PATH, DOMAIN_FILTER_THRESHOLD

class GemFeatureExtractor:
    """
    Step 1: Converts input PIL Image into a 1280-dimensional numerical embedding vector
    using standard ImageNet pre-trained EfficientNet-B0 backbone.
    """
    def __init__(self, device: torch.device = None):
        self.device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # Load standard ImageNet pre-trained EfficientNet-B0
        model = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.DEFAULT)
        model.eval()
        
        # Replace classification head with Identity to output raw 1280-dim feature vector
        model.classifier = nn.Identity()
        self.model = model.to(self.device)
        
        # Standard ImageNet preprocessing transform matching Colab training setup
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])

    def extract(self, image: Image.Image) -> np.ndarray:
        """Transforms PIL Image and extracts 1280-dim feature embedding array."""
        if not isinstance(image, Image.Image):
            image = Image.fromarray(image)

        tensor = self.transform(image).unsqueeze(0).to(self.device)
        with torch.no_grad():
            embedding = self.model(tensor).cpu().numpy()
        return embedding


class GlobalDomainFilterGate:
    """
    Step 2: Runtime Gate using the pre-trained One-Class SVM model profile (global_domain_filter.pkl)
    to classify incoming feature vectors into Gemstone vs Non-Gemstone domain.
    """
    def __init__(self, model_profile_path: str = GLOBAL_DOMAIN_FILTER_PATH, threshold: float = DOMAIN_FILTER_THRESHOLD):
        self.feature_extractor = GemFeatureExtractor()
        self.threshold = threshold
        
        if os.path.exists(model_profile_path):
            self.oc_svm = joblib.load(model_profile_path)
            print(f"[GlobalDomainFilterGate] Loaded pretrained OneClassSVM profile from: {model_profile_path}")
        else:
            self.oc_svm = None
            print(f"[GlobalDomainFilterGate] Warning: Model file not found at {model_profile_path}")

    def verify_is_gem(self, image: Image.Image) -> tuple[bool, float]:
        """
        Calculates raw distance score from the pre-trained One-Class SVM decision function.
        Returns:
            is_valid (bool): True if raw_score >= threshold (0.0), False if non-gem outlier (< 0.0).
            raw_score (float): Distance to the separating hyperplane.
        """
        if self.oc_svm is None:
            return True, 0.0

        # 1. Extract 1280-D feature embedding vector
        features = self.feature_extractor.extract(image)
        
        # 2. Compute distance score from the pre-trained OneClassSVM model profile
        raw_score = float(self.oc_svm.decision_function(features)[0])
        prediction = int(self.oc_svm.predict(features)[0])
        
        # 3. Determine validity (Score >= 0.0 is inside gemstone domain boundary)
        is_valid = bool(prediction == 1 and raw_score >= self.threshold)
        print(f"[GlobalDomainFilterGate] Distance Score: {raw_score:.8f}, Prediction: {prediction}, Valid Gem: {is_valid}")
        
        return is_valid, raw_score


# Singleton instance
_gate_instance = None

def load_domain_filter_models():
    """Startup hook to pre-load feature extractor and OCSVM model profile."""
    global _gate_instance
    if _gate_instance is None:
        _gate_instance = GlobalDomainFilterGate()

def validate_gem_image(image: Image.Image) -> tuple[bool, float]:
    """Public validation interface called by routes.py."""
    global _gate_instance
    if _gate_instance is None:
        load_domain_filter_models()
    return _gate_instance.verify_is_gem(image)
