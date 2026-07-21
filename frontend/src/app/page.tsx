'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Gem, Shield, Search, Coins, Layers, Eye } from 'lucide-react';
import CutPredictionPage from '@/app/cut-prediction/page';

export default function Home() {
  const router = useRouter();
  const [activePortal, setActivePortal] = useState<'home' | 'rough'>('home');

  useEffect(() => {
    // Make sure we clear any stale flow state when arriving back on the main landing page
    if (activePortal === 'home') {
      sessionStorage.removeItem('faceted_flow_active');
      sessionStorage.removeItem('faceted_flow_step');
    }
  }, [activePortal]);

  const handleStartFacetedFlow = () => {
    sessionStorage.setItem('faceted_flow_active', 'true');
    sessionStorage.setItem('faceted_flow_step', '1');
    sessionStorage.removeItem('faceted_flow_image');
    sessionStorage.removeItem('faceted_flow_image_name');
    sessionStorage.removeItem('faceted_flow_auth_result');
    sessionStorage.removeItem('faceted_flow_identify_result');
    router.push('/authentication');
  };

  if (activePortal === 'rough') {
    return (
      <div className="animate-fade-in">
        <CutPredictionPage onBack={() => setActivePortal('home')} />
      </div>
    );
  }

  return (
    <>
      {/* Background Decor */}
      <div className="fixed -top-40 -right-40 h-96 w-96 rounded-full bg-purple-600/10 blur-[100px] pointer-events-none" />
      <div className="fixed -bottom-40 -left-40 h-96 w-96 rounded-full bg-blue-600/10 blur-[100px] pointer-events-none" />

      <div className="max-width-container pt-4 sm:pt-6 pb-16 sm:pb-20 relative animate-fade-in">

      {/* Hero Section */}
      <section className="mb-16 sm:mb-20 text-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-violet-500/15 to-cyan-500/15 text-cyan-300 border border-cyan-500/20 mb-5">
          <Gem className="w-3.5 h-3.5" />
          <span>Next-Generation Gemstone Analytics</span>
        </span>
        <h1 className="mb-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight text-white">
          True Value Estimation &{' '}
          <span className="gradient-text">
            AI Authentication
          </span>
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-base sm:text-lg text-gray-400 leading-relaxed">
          GemIntel uses state-of-the-art DINOv2 vision models, 3D visual hull reconstruction, 
          and ensemble ML regression to classify, authenticate, and value raw and finished gemstones.
        </p>
      </section>

      {/* Main Focus: 2 Gem Categories Split Portal */}
      <section className="mb-20">
        <div className="text-center mb-10">
          <h2 className="text-xl sm:text-2xl font-extrabold text-white mb-2 uppercase tracking-wider">
            Select Gemstone Category
          </h2>
          <p className="text-sm text-gray-400 max-w-lg mx-auto">
            Our system is tailored for two distinct states of gemstone lifecycle. 
            Choose the category to unlock appropriate analytics models.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
          {/* Rough Gems Panel */}
          <div 
            onClick={() => setActivePortal('rough')}
            className="glass-panel group p-8 flex flex-col justify-between items-start transition hover:-translate-y-1.5 duration-300 border border-white/10 hover:border-cyan-500/40 relative overflow-hidden bg-slate-950/20 hover:bg-slate-950/40 cursor-pointer shadow-xl"
          >
            {/* Glow Accent */}
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-cyan-500/5 blur-2xl group-hover:bg-cyan-500/10 transition-colors pointer-events-none" />

            <div className="w-full">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-2xl text-cyan-400 group-hover:scale-105 transition-transform duration-300">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-white group-hover:text-cyan-400 transition-colors">
                Rough Gems Portal
              </h3>
              <p className="text-sm leading-relaxed text-gray-400 mb-6">
                Designed for uncut, raw gemstone crystals. Perform 3D visual hull reconstruction from multi-angle snapshots, calculate volume metrics, and predict the optimal cutting configuration and raw yield percentage.
              </p>
              
              <div className="space-y-2.5 mb-8">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>3D Voxel Hull Visualizer</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>Optimal Cut Predictions</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>Carat Yield Estimation</span>
                </div>
              </div>
            </div>

            <button className="w-full btn-primary text-sm py-3 cursor-pointer group-hover:brightness-105">
              Analyze Rough Gem →
            </button>
          </div>

          {/* Faceted Gems Panel */}
          <div 
            onClick={handleStartFacetedFlow}
            className="glass-panel group p-8 flex flex-col justify-between items-start transition hover:-translate-y-1.5 duration-300 border border-white/10 hover:border-purple-500/40 relative overflow-hidden bg-slate-950/20 hover:bg-slate-950/40 cursor-pointer shadow-xl"
          >
            {/* Glow Accent */}
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-purple-500/5 blur-2xl group-hover:bg-purple-500/10 transition-colors pointer-events-none" />

            <div className="w-full">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 border border-purple-500/20 text-2xl text-purple-400 group-hover:scale-105 transition-transform duration-300">
                <Gem className="w-6 h-6" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-white group-hover:text-purple-400 transition-colors">
                Faceted Gems Portal
              </h3>
              <p className="text-sm leading-relaxed text-gray-400 mb-6">
                Designed for finished, cut gemstones. Start the multi-stage pipeline: authenticate microscopic features to detect lab-synthetics, execute DINOv2 color and shape classifiers, and estimate pricing based on live economic factors.
              </p>

              <div className="space-y-2.5 mb-8">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  <span>AI Generated & Synthetic Check</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  <span>DINOv2 Shape & Hue Extraction</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  <span>CCPI-Adjusted Value Estimator</span>
                </div>
              </div>
            </div>

            <button 
              className="w-full btn-primary text-sm py-3 cursor-pointer group-hover:brightness-105"
              style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)' }}
            >
              Start Guided Pipeline →
            </button>
          </div>
        </div>
      </section>
    </div>
  </>
);
}