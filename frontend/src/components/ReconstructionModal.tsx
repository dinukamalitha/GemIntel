"use client";

import type { PipelineStatus } from "@/services/cutApi";

interface StepIconProps {
  state: "pending" | "active" | "completed" | "error";
  type: "upload" | "mask" | "reconstruct" | "predict" | "preview";
}

const StepIcon = ({ state, type }: StepIconProps) => {
  if (state === "completed") {
    return (
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 scale-100 transition-all duration-300 shrink-0">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse shrink-0">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    );
  }

  if (state === "pending") {
    return (
      <div className="flex items-center justify-center w-6 h-6 rounded-full border border-white/10 text-white/20 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
      </div>
    );
  }

  switch (type) {
    case "upload":
      return (
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-[0_0_12px_rgba(59,130,246,0.2)] shrink-0">
          <svg className="w-3.5 h-3.5 animate-[bounce_1s_infinite]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </div>
      );
    case "mask":
      return (
        <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.2)] overflow-hidden shrink-0">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <div className="absolute inset-x-0 h-[1.5px] bg-purple-400 shadow-[0_0_4px_#c084fc] top-0 animate-scan" />
        </div>
      );
    case "reconstruct":
      return (
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.2)] shrink-0">
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
      );
    case "predict":
      return (
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-pink-500/20 text-pink-400 border border-pink-500/30 shadow-[0_0_12px_rgba(236,72,153,0.2)] shrink-0">
          <svg className="w-3.5 h-3.5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
      );
    case "preview":
      return (
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.2)] shrink-0">
          <svg className="w-3.5 h-3.5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
      );
    default:
      return null;
  }
};

interface ReconstructionModalProps {
  isOpen: boolean;
  status: PipelineStatus;
  error: string | null;
  failedStep: number | null;
  isProcessing: boolean;
  onStop: () => void;
  onClose: () => void;
}

export default function ReconstructionModal({
  isOpen,
  status,
  error,
  failedStep,
  isProcessing,
  onStop,
  onClose,
}: ReconstructionModalProps) {
  if (!isOpen) return null;

  const getStepStatus = (stepIndex: number): "pending" | "active" | "completed" | "error" => {
    if (status === "idle") return "pending";

    if (status === "error") {
      if (failedStep === stepIndex) return "error";
      return failedStep !== null && failedStep > stepIndex ? "completed" : "pending";
    }

    switch (stepIndex) {
      case 1:
        if (status === "uploading") return "active";
        return "completed";
      case 2:
        if (["uploading"].includes(status)) return "pending";
        if (["processing", "generating_masks"].includes(status)) return "active";
        return "completed";
      case 3:
        if (["uploading", "processing", "generating_masks"].includes(status)) return "pending";
        if (status === "reconstructing") return "active";
        return "completed";
      case 4:
        if (["uploading", "processing", "generating_masks", "reconstructing"].includes(status)) return "pending";
        if (status === "predicting") return "active";
        return "completed";
      case 5:
        if (status === "done") return "completed";
        return "pending";
      default:
        return "pending";
    }
  };

  return (
    <div className="fixed inset-0 z-[99999999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in-pure">
      <div className="hide-nav-footer-trigger hidden" />
      <div className="bg-[#0c0d18]/98 border border-white/30 rounded-2xl p-6 w-full max-w-lg relative overflow-hidden shadow-[0_0_50px_-12px_rgba(0,0,0,0.8),0_0_20px_rgba(255,255,255,0.05)] animate-fade-in">
        {/* Glowing top line */}
        <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${
          status === "error" 
            ? "from-rose-500 via-red-500 to-amber-500" 
            : status === "done" 
            ? "from-emerald-500 via-teal-500 to-cyan-500"
            : "from-blue-500 via-purple-500 to-cyan-500 animate-pulse"
        }`} />

        <h3 className="text-xs font-semibold uppercase tracking-widest pb-4 mb-3 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {status === "error" ? (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
              </span>
            ) : status === "done" ? (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            ) : (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
            )}
            <span className={status === "error" ? "text-rose-400" : status === "done" ? "text-emerald-400" : "text-blue-400"}>
              {status === "error" 
                ? "3D Reconstruction Failed" 
                : status === "done" 
                ? "3D Reconstruction Complete" 
                : "3D Reconstruction Pipeline"}
            </span>
          </div>
          
          {/* Dismiss button for finished/failed states */}
          {(status === "error" || status === "done") && (
            <button 
              onClick={onClose}
              className="text-white/40 hover:text-white/80 transition text-lg font-bold px-2 py-0.5 rounded hover:bg-white/5 cursor-pointer"
            >
              ×
            </button>
          )}
        </h3>

        <div className="flex flex-col divide-y divide-white/5 mb-5">
          {[
            {
              id: 1,
              type: "upload" as const,
              label: "Uploading side-view snaps...",
              activeLabel: "Uploading side-view snaps...",
              completedLabel: "Side-view snaps uploaded",
            },
            {
              id: 2,
              type: "mask" as const,
              label: "Removing backgrounds & creating masks...",
              activeLabel: "Removing backgrounds & creating masks...",
              completedLabel: "Backgrounds removed & masks created",
            },
            {
              id: 3,
              type: "reconstruct" as const,
              label: "Reconstructing 3D digital twin & Extracting Features...",
              activeLabel: "Reconstructing 3D digital twin & Extracting Features...",
              completedLabel: "3D digital twin reconstructed & Features Extracted",
            },
            {
              id: 4,
              type: "predict" as const,
              label: "Predicting optimal cut shape & yield estimation...",
              activeLabel: "Predicting optimal cut shape & yield estimation...",
              completedLabel: "Optimal cut shape & yield estimated",
            },
            {
              id: 5,
              type: "preview" as const,
              label: "Previewing live 3D cut...",
              activeLabel: "Generating live 3D cut preview...",
              completedLabel: "Live 3D cut ready",
            },
          ].map((step) => {
            const stepState = getStepStatus(step.id);
            const isStepActive = stepState === "active";
            const isStepCompleted = stepState === "completed";
            const isStepError = stepState === "error";

            let textClass = "text-white/20";
            let statusLabelText = "Pending";

            if (isStepActive) {
              textClass = "text-blue-400 font-semibold drop-shadow-[0_0_8px_rgba(96,165,250,0.3)]";
              statusLabelText = "Active";
            } else if (isStepCompleted) {
              textClass = "text-white/70";
              statusLabelText = "Completed";
            } else if (isStepError) {
              textClass = "text-rose-400 font-semibold";
              statusLabelText = "Failed";
            }

            return (
              <div
                key={step.id}
                className={`flex items-center justify-between gap-2 py-3 sm:py-3.5 transition-all duration-300 ${
                  isStepActive ? "bg-white/[0.01] -mx-2 px-2 rounded-lg" : ""
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <StepIcon state={stepState} type={step.type} />
                  <span className={`text-[10px] sm:text-xs transition-colors duration-300 break-words ${textClass}`}>
                    {isStepCompleted ? step.completedLabel : isStepActive ? step.activeLabel : step.label}
                  </span>
                </span>
                <span className={`text-[9px] sm:text-[10px] font-mono uppercase tracking-wider transition-colors duration-300 hidden sm:inline shrink-0 ${
                  isStepActive 
                    ? "text-blue-400 animate-pulse font-bold" 
                    : isStepCompleted 
                    ? "text-emerald-400" 
                    : isStepError 
                    ? "text-rose-400" 
                    : "text-white/10"
                }`}>
                  {statusLabelText}
                </span>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-300 break-words">
            {error}
          </div>
        )}

        {/* Action Buttons in Modal */}
        <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
          {isProcessing && (
            <button
              onClick={onStop}
              className="w-full px-5 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-[0.98] transition font-medium flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
              <span>Stop Process</span>
            </button>
          )}

          {status === "error" && (
            <button
              onClick={onClose}
              className="w-full px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition font-medium text-sm cursor-pointer"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
