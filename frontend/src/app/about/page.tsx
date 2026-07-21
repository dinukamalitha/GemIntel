import React from 'react';
import {
  Gem,
  Shield,
  Code,
  Cpu,
  Award,
  GraduationCap,
  Target,
  Compass,
  TrendingUp,
  Sparkles,
  Scale,
  Eye,
  Scissors,
  User,
  Phone,
  Mail
} from 'lucide-react';
import {
  ABOUT_PROJECT_INFO,
  PROBLEMS_DATA,
  OBJECTIVES_DATA,
  GEM_TIERS_DATA,
  MODELS_DATA,
  SUPERVISORS_DATA,
  TEAM_MEMBERS_DATA
} from '@/data/aboutData';

const renderIcon = (iconName: string, className = "w-5 h-5") => {
  switch (iconName) {
    case 'Eye': return <Eye className={className} />;
    case 'Sparkles': return <Sparkles className={className} />;
    case 'Scale': return <Scale className={className} />;
    case 'TrendingUp': return <TrendingUp className={className} />;
    case 'Shield': return <Shield className={className} />;
    case 'Scissors': return <Scissors className={className} />;
    case 'Gem': return <Gem className={className} />;
    case 'Cpu': return <Cpu className={className} />;
    case 'Award': return <Award className={className} />;
    default: return <Sparkles className={className} />;
  }
};

export default function AboutPage() {
  return (
    <>
      {/* Background Ambient Decor */}
      <div className="fixed -top-40 -right-40 h-96 w-96 rounded-full bg-purple-600/5 blur-[100px] pointer-events-none" />
      <div className="fixed -bottom-40 -left-40 h-96 w-96 rounded-full bg-blue-600/5 blur-[100px] pointer-events-none" />

      <div className="max-width-container pt-4 sm:pt-6 pb-16 sm:pb-20 relative animate-fade-in z-10 space-y-16 sm:space-y-20">

        {/* Hero Header */}
        <header className="text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-violet-500/15 to-cyan-500/15 text-cyan-300 border border-cyan-500/20 mb-5 shadow-sm">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>{ABOUT_PROJECT_INFO.university} Research Project</span>
          </span>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight mb-4">
            About <span className="gradient-text">{ABOUT_PROJECT_INFO.projectName}</span>
          </h1>
          <p className="max-w-3xl mx-auto text-sm sm:text-base text-gray-300 leading-relaxed">
            {ABOUT_PROJECT_INFO.tagline}
          </p>
        </header>

        {/* Section 1: Introduction */}
        <section className="max-w-5xl mx-auto">
          <div className="glass-panel p-6 sm:p-10 border border-white/10 bg-slate-950/40 shadow-2xl relative overflow-hidden space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
                <Compass className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                Research Background & Motivation
              </h2>
            </div>
            <div className="space-y-4 text-xs sm:text-sm text-gray-300 leading-relaxed pt-2">
              {ABOUT_PROJECT_INFO.backgroundParagraphs.map((paragraph, idx) => {
                const isHighlight = idx === ABOUT_PROJECT_INFO.backgroundParagraphs.length - 1;
                return (
                  <p
                    key={idx}
                    className={isHighlight ? "text-cyan-300 font-medium bg-cyan-500/5 p-4 rounded-xl border border-cyan-500/10" : ""}
                  >
                    {paragraph}
                  </p>
                );
              })}
            </div>
          </div>
        </section>

        {/* Section 2: Problem Statement */}
        <section className="max-w-5xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl sm:text-3xl font-extrabold text-white">
              Core Industry Challenges
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 max-w-xl mx-auto">
              Key bottlenecks in traditional gemstone evaluation that {ABOUT_PROJECT_INFO.projectName} addresses through computer vision and explainable ML.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {PROBLEMS_DATA.map((p) => (
              <div key={p.id} className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all flex flex-col gap-3">
                <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl w-fit">
                  {renderIcon(p.iconName)}
                </div>
                <h3 className="text-sm font-bold text-white">{p.title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Aim & Scope */}
        <section className="max-w-5xl mx-auto">
          <div className="glass-panel p-6 sm:p-10 border border-violet-500/20 bg-gradient-to-br from-violet-950/20 via-slate-950/40 to-cyan-950/20 shadow-2xl relative overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-2xl font-bold text-white">Project Aim & Gemstone Spectrum</h2>
                <p className="text-xs text-gray-400">Targeting the full economic valuation spectrum of Sri Lankan gemstones</p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed mb-6">
              {ABOUT_PROJECT_INFO.projectName} establishes a unified AI framework for automated 4C classification, valuation, cut yield prediction, and authentication covering three representative gemstone species:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {GEM_TIERS_DATA.map((t, idx) => {
                const badgeColor = t.colorClass === 'blue' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : t.colorClass === 'purple' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400';
                return (
                  <div key={idx} className={`p-4 rounded-xl border text-center space-y-1 ${badgeColor}`}>
                    <div className="text-xs font-extrabold uppercase tracking-wider">{t.tier}</div>
                    <div className="text-base font-bold text-white">{t.name}</div>
                    <div className="text-[11px] text-gray-400">{t.description}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Section 4: Key Objectives */}
        <section className="max-w-5xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl sm:text-3xl font-extrabold text-white">
              Research Objectives
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 max-w-xl mx-auto">
              Four core pillars defining the technical scope of the {ABOUT_PROJECT_INFO.projectName} system.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {OBJECTIVES_DATA.map((obj, idx) => (
              <div key={idx} className="p-6 rounded-2xl bg-slate-950/40 border border-white/10 flex gap-4 items-start hover:border-white/20 transition-all shadow-lg">
                <div className="text-2xl font-black text-cyan-400/40 font-mono shrink-0 pt-0.5">{obj.num}</div>
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 text-cyan-400">
                    {renderIcon(obj.iconName, "w-5 h-5")}
                    <h3 className="text-base font-bold text-white">{obj.title}</h3>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">{obj.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 5: AI Architecture */}
        <section className="max-w-5xl mx-auto space-y-6">
          <h2 className="text-xl sm:text-3xl font-extrabold text-white text-center">
            AI Architecture & Model Breakdown
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            {MODELS_DATA.map((m, idx) => (
              <div key={idx} className="glass-panel p-6 flex gap-4 items-start border border-white/5 bg-slate-950/20 shadow-lg">
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl shrink-0 text-cyan-400">
                  {renderIcon(m.iconName, "w-6 h-6")}
                </div>
                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg font-bold text-white">{m.title}</h3>
                  <span className="inline-block text-[10px] sm:text-xs font-semibold text-cyan-400 bg-cyan-500/5 px-2 py-0.5 rounded border border-cyan-500/10">
                    {m.tech}
                  </span>
                  <p className="text-xs sm:text-sm text-gray-400 leading-relaxed pt-1.5">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 6: Research Guidance & Project Team */}
        <section className="max-w-5xl mx-auto space-y-10">

          {/* Supervisors Subsection */}
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-xl sm:text-3xl font-extrabold text-white">
                Research Guidance & Supervisors
              </h2>
              <p className="text-xs sm:text-sm text-gray-400">
                Academic supervision by the {ABOUT_PROJECT_INFO.department}, {ABOUT_PROJECT_INFO.university}.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">

              {SUPERVISORS_DATA.map((sup, idx) => (
                <div key={idx} className="glass-panel p-6 border border-cyan-500/20 bg-slate-950/40 rounded-2xl flex flex-col justify-between gap-4 shadow-xl">
                  <div className="space-y-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-white truncate">{sup.name}</h3>
                    <p className="text-xs font-semibold text-cyan-400">{sup.role}</p>
                    <p className="text-[11px] text-gray-400">{sup.department}</p>
                  </div>

                  <div className="pt-3 border-t border-white/5 space-y-1 text-xs text-gray-300">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <a href={`mailto:${sup.email}`} className="hover:underline text-gray-300 truncate">{sup.email}</a>
                    </div>
                    {sup.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="font-mono text-gray-300">{sup.phone}</span>
                      </div>
                    )}
                  </div>

                </div>
              ))}
            </div>
          </div>

          {/* Team Members Subsection */}
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-xl sm:text-3xl font-extrabold text-white">
                {ABOUT_PROJECT_INFO.teamName}
              </h2>
              <p className="text-xs sm:text-sm text-gray-400">
                Final Year Research Team • {ABOUT_PROJECT_INFO.department}, {ABOUT_PROJECT_INFO.university}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {TEAM_MEMBERS_DATA.map((mem) => (
                <div key={mem.id} className="glass-panel p-4 border border-white/10 bg-slate-950/40 hover:border-white/20 transition-all rounded-2xl flex flex-col gap-4 shadow-xl">
                  {/* Enlarged Member Photo Container */}
                  <div className="w-full h-48 sm:h-56 rounded-xl overflow-hidden bg-gradient-to-br from-violet-950/40 via-slate-900 to-cyan-950/40 border border-white/10 flex items-center justify-center relative shadow-inner group">
                    {mem.imageUrl ? (
                      <img src={mem.imageUrl} alt={mem.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-cyan-400/50 group-hover:scale-105 transition-transform duration-300">
                        <User className="w-16 h-16 stroke-[1.2]" />
                        <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Photo</span>
                      </div>
                    )}
                    <span className="absolute top-2.5 right-2.5 text-[10px] font-mono font-bold text-cyan-300 bg-slate-950/80 backdrop-blur-md border border-cyan-500/30 px-2.5 py-1 rounded-lg shadow-md">
                      {mem.indexNo}
                    </span>
                  </div>

                  {/* Details Underneath */}
                  <div className="space-y-1 px-1 pb-1">
                    <h3 className="text-base font-bold text-white leading-snug">{mem.name}</h3>
                    <p className="text-xs text-cyan-400 font-medium leading-relaxed">{mem.scope}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 7: Team Ozone Footer Card */}
        <section className="max-w-3xl mx-auto text-center glass-panel p-8 sm:p-12 border border-white/5 bg-slate-950/20 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-cyan-500/5 blur-3xl pointer-events-none" />

          <div className="flex justify-center mb-6">
            <div className="p-4 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-2xl text-cyan-400">
              <Code className="w-8 h-8" />
            </div>
          </div>

          <h2 className="text-xl sm:text-3xl font-extrabold text-white mb-3">
            Developed by {ABOUT_PROJECT_INFO.teamName}
          </h2>
          <p className="text-xs sm:text-sm text-cyan-400 font-semibold mb-6 uppercase tracking-wider">
            {ABOUT_PROJECT_INFO.department} • {ABOUT_PROJECT_INFO.university}
          </p>

          <p className="text-sm sm:text-base text-gray-300 leading-relaxed max-w-xl mx-auto">
            {ABOUT_PROJECT_INFO.projectName} is built as a Final Year Research Project by {ABOUT_PROJECT_INFO.teamName} at the {ABOUT_PROJECT_INFO.university}. The project focuses on bridging the gap between gemology and computer vision to deliver highly accurate, automated gemstone analytics.
          </p>
        </section>

      </div>
    </>
  );
}
