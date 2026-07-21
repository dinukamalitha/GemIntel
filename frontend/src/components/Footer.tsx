'use client';

export default function Footer() {
  return (
    <footer className="border-t border-white/15 bg-slate-950/80 backdrop-blur-lg mt-auto min-h-[60px] flex justify-center items-center py-4 sm:py-0">
      <div className="max-width-container flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left text-sm md:text-[15px] text-gray-500">
        <div className="transition-colors hover:text-gray-400">
          © {new Date().getFullYear()} GemIntel Systems Inc. All rights reserved.
        </div>
        <div className="transition-colors hover:text-gray-400">
          Developed by <span className="text-cyan-400/90 hover:text-cyan-400 font-semibold transition-colors">Team Ozone</span> @ University of Moratuwa
        </div>
      </div>
    </footer>
  );
}
