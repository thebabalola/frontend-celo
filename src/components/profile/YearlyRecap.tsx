"use client";

import { Address } from "viem";
import { Sparkles, Calendar, TrendingUp, Award, ArrowRight } from "lucide-react";
import { useState } from "react";

interface YearlyRecapProps {
  playerAddress: Address;
}

export default function YearlyRecap({ playerAddress }: YearlyRecapProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const currentYear = new Date().getFullYear();

  // Mock data for yearly recap
  const yearlyStats = {
    totalGames: 156,
    bestStreak: 8,
    biggestWin: "450 CELO",
    totalVolume: "2,450 CELO",
    growth: "+240%",
    topDay: "Friday",
    favoriteOpponent: "0x89...234",
  };

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-amber-900/40 to-orange-900/40 backdrop-blur-md rounded-2xl border border-amber-500/20 transition-all duration-500">
      
      {/* Background decorations */}
      <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
        <Sparkles className="w-64 h-64 text-amber-400" />
      </div>

      <div className="p-1">
        <div className="bg-black/40 rounded-[14px] p-6 backdrop-blur-sm relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full border border-amber-500/20 uppercase tracking-widest font-bold">
                  {currentYear} Wrapped
                </span>
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold text-white">Yearly Highlights</h2>
            </div>
            
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-4 py-2 bg-amber-500 text-black font-bold rounded-lg hover:bg-amber-400 transition-colors flex items-center gap-2 text-sm"
            >
              {isExpanded ? "Hide Recap" : "View Recap"}
              <ArrowRight className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? "rotate-90" : ""}`} />
            </button>
          </div>

          {/* Expanded Content */}
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 transition-all duration-500 overflow-hidden ${isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}>
            
            {/* Stat Card 1 */}
            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-4 flex flex-col items-center text-center group hover:scale-105 transition-transform">
              <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mb-3 group-hover:bg-amber-500/30 transition-colors">
                <Award className="w-6 h-6 text-amber-400" />
              </div>
              <p className="text-3xl font-bold text-white mb-1">{yearlyStats.bestStreak}</p>
              <p className="text-amber-200/70 text-sm">Best Winning Streak</p>
            </div>

            {/* Stat Card 2 */}
            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-4 flex flex-col items-center text-center group hover:scale-105 transition-transform">
              <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mb-3 group-hover:bg-amber-500/30 transition-colors">
                <TrendingUp className="w-6 h-6 text-amber-400" />
              </div>
              <p className="text-3xl font-bold text-white mb-1">{yearlyStats.growth}</p>
              <p className="text-amber-200/70 text-sm">Year over Year Growth</p>
            </div>

            {/* Stat Card 3 */}
            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-4 flex flex-col items-center text-center group hover:scale-105 transition-transform">
              <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mb-3 group-hover:bg-amber-500/30 transition-colors">
                <Calendar className="w-6 h-6 text-amber-400" />
              </div>
              <p className="text-2xl font-bold text-white mb-1">{yearlyStats.totalGames}</p>
              <p className="text-amber-200/70 text-sm">Games Played in {currentYear}</p>
            </div>

            {/* Stat Card 4 */}
            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-4 flex flex-col items-center text-center group hover:scale-105 transition-transform">
              <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mb-3 group-hover:bg-amber-500/30 transition-colors">
                <Sparkles className="w-6 h-6 text-amber-400" />
              </div>
              <p className="text-2xl font-bold text-white mb-1">{yearlyStats.biggestWin}</p>
              <p className="text-amber-200/70 text-sm">Biggest Single Win</p>
            </div>

            <div className="col-span-1 md:col-span-2 lg:col-span-4 mt-2">
              <div className="bg-black/30 rounded-lg p-3 text-center text-gray-400 text-sm">
                Check back at the end of the year for your full cinematic recap! 🎬
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
