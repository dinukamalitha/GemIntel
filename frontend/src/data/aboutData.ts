export interface ProblemItem {
  id: string;
  iconName: 'Eye' | 'Sparkles' | 'Scale' | 'TrendingUp' | 'Shield' | 'Scissors';
  title: string;
  desc: string;
}

export interface ObjectiveItem {
  num: string;
  title: string;
  iconName: 'Gem' | 'Shield' | 'Scissors' | 'TrendingUp';
  desc: string;
}

export interface GemTierItem {
  tier: string;
  name: string;
  description: string;
  colorClass: string;
}

export interface ModelArchitectureItem {
  iconName: 'Shield' | 'Cpu' | 'Gem' | 'Award';
  title: string;
  tech: string;
  desc: string;
}

export interface SupervisorItem {
  name: string;
  role: string;
  department: string;
  email: string;
  phone?: string;
}


export interface TeamMemberItem {
  id: string;
  name: string;
  scope: string;
  indexNo: string;
  imageUrl?: string;
}


export const ABOUT_PROJECT_INFO = {
  university: "University of Moratuwa",
  department: "Faulty of Information Technology",
  projectName: "GemIntel",
  teamName: "Team Ozone",
  tagline: "An AI-driven framework engineered for gem authentication, feature identification & 4C classification, market driven valuation and 3D cut & yield optimization.",
  backgroundParagraphs: [
    "Sri Lanka is internationally recognized for producing world-class blue and red gemstones such as sapphire, ruby, and spinel. However, traditional gemstone identification and valuation rely primarily on subjective visual inspection and expensive laboratory testing, which remain inaccessible to many industry stakeholders.",
    "The increasing market presence of synthetic, laboratory-grown, treated, and imitation stones heightens the risk of misclassification and financial exposure. Existing computational models are often restricted to basic image classification of isolated gem types and fail to deliver explainable, market-aware valuations or three-dimensional cut predictions.",
    "GemIntel bridges this technological gap by deploying an explainable, multi-modal artificial intelligence framework that serves as an objective, pre-laboratory screening tool for miners, gemologists, and traders."
  ]
};

export const PROBLEMS_DATA: ProblemItem[] = [
  {
    id: "color_profiles",
    iconName: "Eye",
    title: "Overlapping Colour Profiles",
    desc: "Visual ambiguity in identifying subtle hue, tone, and saturation boundaries across gem species."
  },
  {
    id: "clarity_granularity",
    iconName: "Sparkles",
    title: "Clarity Granularity",
    desc: "Human visual limitations in assessing microscopic internal inclusions and structural flaws."
  },
  {
    id: "human_bias",
    iconName: "Scale",
    title: "Human Bias & Subjectivity",
    desc: "Inconsistency and lack of standardized objectivity during traditional manual appraisal."
  },
  {
    id: "market_valuation",
    iconName: "TrendingUp",
    title: "Lack of Market-Aware Valuation",
    desc: "Static appraisal methods fail to reflect real-time economic indicators and market dynamics."
  },
  {
    id: "synthetic_risk",
    iconName: "Shield",
    title: "Natural vs. Synthetic Risk",
    desc: "Rising presence of lab-grown and treated stones increases misclassification and financial loss."
  },
  {
    id: "cut_assessment",
    iconName: "Scissors",
    title: "Inadequate Cut Assessment",
    desc: "Difficulty in evaluating 3D rough crystal geometry to predict optimal yield and cut quality."
  }
];

export const OBJECTIVES_DATA: ObjectiveItem[] = [
  {
    num: "01",
    title: "Automated 4C Analysis",
    iconName: "Gem",
    desc: "Objective deep-learning feature extraction to evaluate Colour, Clarity, Cut style, and Carat metrics."
  },
  {
    num: "02",
    title: "Image Based Authentication",
    iconName: "Shield",
    desc: "Explainable AI pipeline distinguishing natural gemstones from synthetic/imitation stones with transparent decision explanations."
  },
  {
    num: "03",
    title: "3D Cut & Yield Optimization",
    iconName: "Scissors",
    desc: "Visual hull reconstruction analyzing rough crystal geometry to recommend the most profitable cut while preserving brilliance."
  },
  {
    num: "04",
    title: "Market-Aware Value Estimation",
    iconName: "TrendingUp",
    desc: "Ensemble price estimation integrating gemological factors with live market dynamics, historical trends, and economic indicators."
  }
];

export const GEM_TIERS_DATA: GemTierItem[] = [
  {
    tier: "Premium Tier",
    name: "Blue Sapphire",
    description: "High-value investment grade",
    colorClass: "blue"
  },
  {
    tier: "Mid Tier",
    name: "Blue Spinel",
    description: "Secondary commercial market",
    colorClass: "purple"
  },
  {
    tier: "Accessible Tier",
    name: "Blue Topaz",
    description: "Commercial volume market",
    colorClass: "cyan"
  }
];

export const MODELS_DATA: ModelArchitectureItem[] = [
  {
    iconName: "Shield",
    title: "AI Authenticity Filter",
    tech: "CNN (EfficientNet-B0/B4) & FFT",
    desc: "Analyzes high-frequency pixel patterns and DCT frequencies to flag AI-generated synthetic images and detect microscopic fake structure anomalies."
  },
  {
    iconName: "Cpu",
    title: "DINOv2 Feature Classifier",
    tech: "Self-Supervised Vision Transformer",
    desc: "Extracts deep semantic embeddings from gemstone facets to classify cut shapes (e.g., Round, Cushion) and extract color coordinates."
  },
  {
    iconName: "Gem",
    title: "3D Visual Hull Reconstruction",
    tech: "Voxel Back-Projection & Marching Cubes",
    desc: "Processes multi-angle side views to reconstruct the raw crystal's 3D voxel grid. Computes exact volume, bounding box, and yield predictions."
  },
  {
    iconName: "Award",
    title: "Ensemble Price Estimator",
    tech: "XGBoost, LightGBM & Random Forest",
    desc: "Combines physical gem features with macroeconomic indices (like CCPI) to produce robust, live price estimations."
  }
];

export const SUPERVISORS_DATA: SupervisorItem[] = [
  {
    name: "Prof. (Mrs.) Thanuja Sandanayake",
    role: "IDS Supervisor",
    department: "Department of Interdisciplinary Studies, Faculty of Information Technology, University of Moratuwa",
    email: "thanujas@uom.lk"
  },
  {
    name: "Dr.Thilina Thanthiriwatta",
    role: "IT Supervisor",
    department: "Department of Information Technology, Faculty of Information Technology, University of Moratuwa",
    email: "thilinat@uom.lk"
  },
  {
    name: "Prof. Ranjith Premasiri ",
    role: "External Supervisor",
    department: "Department of Earth Resources Engineering, Faculty of Engineering, University of Moratuwa",
    email: "ranjith@uom.lk"
  }
];

export const TEAM_MEMBERS_DATA: TeamMemberItem[] = [
  {
    id: "mem1",
    name: "Bandarigoda D.M.",
    scope: "Gemstone Authentication",
    indexNo: "215016G"
  },
  {
    id: "mem2",
    name: "Aramandeniya A.G.H.N.",
    scope: "Feature Identification",
    indexNo: "215013U"
  },
  {
    id: "mem3",
    name: "Ekanayake E.M.T.L.",
    scope: "Market-driven Valuation",
    indexNo: "215035M"
  },
  {
    id: "mem4",
    name: "Imesh B.A.A.",
    scope: "Optimal Yield Prediction & 3D Modeling",
    indexNo: "215054U"
  }
];

