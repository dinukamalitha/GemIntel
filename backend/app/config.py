import os

# Base directory of the project
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Model Paths & Hugging Face Hub Config
MODELS_DIR = os.path.join(BASE_DIR, "models")
HF_MODEL_REPO = os.getenv("HF_MODEL_REPO", "dmCoder/gemintel-models")
VALUE_MODELS_DIR = os.path.join(MODELS_DIR, "value")
EFF_MODEL_PATH = os.path.join(MODELS_DIR, "authentication", "efficientnet_b4.pth")
GEM_PIPELINE_PATH = os.path.join(MODELS_DIR, "authentication", "xgboost_model.pkl")

# Valuation Model Paths
# Deployment bundle containing the fitted price-per-carat voting ensemble,
# exact weights, feature contract, calibration residuals, and test metadata.
VALUATION_MODELS_DIR = os.path.join(MODELS_DIR, "valuation")
VALUATION_BUNDLE_PATH = os.path.join(
    VALUATION_MODELS_DIR, "ppc_voting_ensemble_bundle.joblib"
)
VALUATION_N_JOBS = max(1, int(os.getenv("VALUATION_N_JOBS", "1")))
VALUATION_DATA_DIR = os.path.join(BASE_DIR, "data", "valuation")
VALUATION_ECONOMIC_HISTORY_PATH = os.path.join(
    VALUATION_DATA_DIR, "monthly_economic_history.csv"
)

# Ensemble Weights
W_EFF = 0.6
W_XGB = 0.4

# AI Filter Configuration
AI_FILTER_MODEL_PATH = os.path.join(MODELS_DIR, "Filters", "ai-filter.pt")
GLOBAL_DOMAIN_FILTER_PATH = os.path.join(MODELS_DIR, "Filters", "global_domain_filter.pkl")
DOMAIN_FILTER_THRESHOLD = 0.09
AI_FILTER_THRESHOLD = 0.6
W_FREQ = 0.3
W_CNN = 0.4
W_META = 0.3


# Identification / 4C Model Paths (DINOv2 cut + color, EfficientNet clarity)
CUT_MODEL_PATH = os.path.join(MODELS_DIR, "4C", "cut-module.pt")
COLOR_MODEL_PATH = os.path.join(MODELS_DIR, "4C", "color-module.pt")
CLARITY_MODEL_PATH = os.path.join(MODELS_DIR, "4C", "clarity-module.pt")

# Gem types shown in the Identification dropdown.
# Color model is trained on blue varieties, so we restrict the list.
GEM_TYPES = [
    "Blue Sapphire",
    "Blue Spinel",
    "Blue Topaz",
]

# Color model classes, in the model's output index order (0..17).
# ponytail: order taken verbatim from the training label grid the user supplied.
# If color labels look scrambled, the training run indexed classes differently
# (e.g. alphabetical folder sort) — reorder this list to match, nothing else.
# Each class is a (Gem_Type, Hue, Intensity) triple. `gem_type` here uses the
# same display names as GEM_TYPES so we can filter by the selected variety.
COLOR_CLASSES = [
    {"gem_type": "Blue Sapphire", "hue": "Blue",        "intensity": "Light"},
    {"gem_type": "Blue Sapphire", "hue": "Blue",        "intensity": "Medium"},
    {"gem_type": "Blue Sapphire", "hue": "Blue",        "intensity": "Intense"},
    {"gem_type": "Blue Sapphire", "hue": "Blue",        "intensity": "Vivid"},
    {"gem_type": "Blue Sapphire", "hue": "Blue",        "intensity": "Deep"},
    {"gem_type": "Blue Topaz",    "hue": "Swiss Blue",  "intensity": "Light"},
    {"gem_type": "Blue Topaz",    "hue": "Swiss Blue",  "intensity": "Medium"},
    {"gem_type": "Blue Topaz",    "hue": "Swiss Blue",  "intensity": "Intense"},
    {"gem_type": "Blue Topaz",    "hue": "Swiss Blue",  "intensity": "Vivid"},
    {"gem_type": "Blue Topaz",    "hue": "Sky Blue",    "intensity": "Light"},
    {"gem_type": "Blue Topaz",    "hue": "Sky Blue",    "intensity": "Medium"},
    {"gem_type": "Blue Topaz",    "hue": "London Blue", "intensity": "Intense"},
    {"gem_type": "Blue Topaz",    "hue": "London Blue", "intensity": "Vivid"},
    {"gem_type": "Blue Topaz",    "hue": "London Blue", "intensity": "Dark"},
    {"gem_type": "Blue Spinel",   "hue": "Blue",        "intensity": "Light"},
    {"gem_type": "Blue Spinel",   "hue": "Blue",        "intensity": "Intense"},
    {"gem_type": "Blue Spinel",   "hue": "Blue",        "intensity": "Vivid"},
    {"gem_type": "Blue Spinel",   "hue": "Blue",        "intensity": "Dark"},
]
