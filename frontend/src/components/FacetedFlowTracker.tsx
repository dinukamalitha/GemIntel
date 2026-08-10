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
    sessionStorage.removeItem('faceted_flow_gem_type');
    sessionStorage.removeItem('faceted_flow_image');
    sessionStorage.removeItem('faceted_flow_image_name');
    sessionStorage.removeItem('faceted_flow_auth_result');
    sessionStorage.removeItem('faceted_flow_identify_result');
    sessionStorage.removeItem('faceted_flow_carat_result');
    sessionStorage.removeItem('faceted_flow_valuation_result');
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
      <div className="glass-panel p-4 sm:p-6 bg-slate-900/90 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4 mb-4 sm:mb-6">
          <div className="flex items-center gap-2">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-blue-950/60 text-blue-400 border border-blue-800/60">
              Guided Pipeline
            </span>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Faceted Gem Flow
            </h2>
          </div>
          <button
            onClick={handleExitFlow}
            className="flex items-center gap-1.5 self-start sm:self-auto text-xs text-slate-400 hover:text-red-400 transition-colors bg-slate-850 border border-slate-800 px-3 py-1.5 rounded-lg active:scale-95 cursor-pointer font-semibold"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancel Guided Flow</span>
          </button>
        </div>

        {/* Step progress track */}
        <div className="relative flex items-center justify-between gap-2 px-2 sm:px-6">
          {/* Background progress lines */}
          <div className="absolute top-5 left-12 right-12 h-0.5 bg-slate-800 -z-10 hidden sm:block" />
          <div
            className="absolute top-5 left-12 h-0.5 bg-blue-500 -z-10 transition-all duration-500 ease-out hidden sm:block"
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
                  className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all duration-200 ${
                    step.href ? 'cursor-pointer hover:border-blue-400 hover:text-blue-300' : ''
                  } ${
                    isActive
                      ? 'bg-blue-600 border-blue-400 text-white shadow-md scale-105'
                      : isCompleted
                      ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-400'
                      : 'bg-slate-900 border-slate-800 text-slate-500'
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
                      isActive ? 'text-slate-100' : isCompleted ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    {step.name}
                  </span>
                  <span className="hidden md:block text-[9px] text-slate-400 mt-0.5 leading-normal max-w-[120px] mx-auto">
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
