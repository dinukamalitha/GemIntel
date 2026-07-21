'use client';

import { useRouter } from 'next/navigation';
import { Shield, Search, Coins, X } from 'lucide-react';

interface FacetedFlowTrackerProps {
  currentStep: 1 | 2 | 3;
}

export default function FacetedFlowTracker({ currentStep }: FacetedFlowTrackerProps) {
  const router = useRouter();

  const handleExitFlow = () => {
    sessionStorage.removeItem('faceted_flow_active');
    sessionStorage.removeItem('faceted_flow_step');
    sessionStorage.removeItem('faceted_flow_image');
    sessionStorage.removeItem('faceted_flow_image_name');
    sessionStorage.removeItem('faceted_flow_auth_result');
    sessionStorage.removeItem('faceted_flow_identify_result');
    router.push('/');
  };

  const steps = [
    {
      number: 1,
      name: 'Authentication',
      description: 'AI spoof & origin filter',
      icon: Shield,
    },
    {
      number: 2,
      name: 'Feature Identification',
      description: 'DINOv2 cut & color extraction',
      icon: Search,
      href: '/four-c',
    },
    {
      number: 3,
      name: 'Value Estimation',
      description: 'Market & economic valuation',
      icon: Coins,
    },
  ];

  return (
    <div className="w-full max-w-3xl mx-auto mb-8 animate-fade-in">
      <div className="glass-panel p-4 sm:p-6 bg-slate-950/40 relative overflow-hidden">
        {/* Glow Decor */}
        <div className="absolute -top-12 -left-12 w-24 h-24 rounded-full bg-cyan-500/10 blur-xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-24 h-24 rounded-full bg-purple-500/10 blur-xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-4 mb-4 sm:mb-6">
          <div className="flex items-center gap-2">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Guided Pipeline
            </span>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Faceted Gem Flow
            </h2>
          </div>
          <button
            onClick={handleExitFlow}
            className="flex items-center gap-1.5 self-start sm:self-auto text-xs text-gray-400 hover:text-rose-400 transition-colors bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg active:scale-95 cursor-pointer font-semibold"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancel Guided Flow</span>
          </button>
        </div>

        {/* Step progress track */}
        <div className="relative flex items-center justify-between gap-2 px-2 sm:px-6">
          {/* Background progress lines */}
          <div className="absolute top-5 left-12 right-12 h-0.5 bg-white/10 -z-10 hidden sm:block" />
          <div
            className="absolute top-5 left-12 h-0.5 bg-gradient-to-r from-cyan-500 to-purple-500 -z-10 transition-all duration-500 ease-out hidden sm:block"
            style={{
              width: currentStep === 1 ? '0%' : currentStep === 2 ? '50%' : '100%',
              right: currentStep === 1 ? 'auto' : currentStep === 2 ? '50%' : '12',
            }}
          />

          {steps.map((step) => {
            const Icon = step.icon;
            const isCompleted = step.number < currentStep;
            const isActive = step.number === currentStep;
            const isPending = step.number > currentStep;

            return (
              <div
                key={step.number}
                className="flex flex-col items-center text-center relative flex-1"
              >
                {/* Node circle */}
                <div
                  onClick={step.href ? () => router.push(step.href!) : undefined}
                  title={step.href ? `Open ${step.name}` : undefined}
                  className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all duration-300 ${
                    step.href ? 'cursor-pointer hover:scale-110 hover:border-cyan-400 hover:text-cyan-300' : ''
                  } ${
                    isActive
                      ? 'bg-gradient-to-br from-cyan-500 to-blue-600 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)] scale-110'
                      : isCompleted
                      ? 'bg-purple-950/40 border-purple-500/50 text-purple-400'
                      : 'bg-slate-900 border-white/10 text-gray-500'
                  }`}
                >
                  {isCompleted ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>

                <div className="mt-2.5">
                  <span
                    className={`block text-[11px] sm:text-xs font-bold leading-tight ${
                      isActive ? 'text-white' : isCompleted ? 'text-purple-300' : 'text-gray-500'
                    }`}
                  >
                    {step.name}
                  </span>
                  <span className="hidden md:block text-[9px] text-gray-500 mt-0.5 leading-normal max-w-[120px] mx-auto">
                    {step.description}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
