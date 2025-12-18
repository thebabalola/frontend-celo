"use client";

import { Address } from "viem";
import { TrendingUp, PieChart, Activity, Clock } from "lucide-react";

interface AnalyticsChartsProps {
  playerAddress: Address;
}

export default function AnalyticsCharts({ playerAddress }: AnalyticsChartsProps) {
  // In a real implementation, this data would come from an indexer or API
  // mocking data for UI demonstration purposes
  const mockWinRateData = [45, 48, 52, 50, 55, 58, 62];
  const mockActivityData = [12, 19, 3, 5, 2, 3, 15]; // Games per day
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Performance Trend */}
      <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 backdrop-blur-md rounded-2xl p-6 border border-purple-500/20">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-bold text-white">Win Rate Trend</h3>
          </div>
          <span className="text-xs text-gray-400 bg-black/30 px-2 py-1 rounded">Last 7 Days</span>
        </div>
        
        {/* Simple SVG Line Chart */}
        <div className="h-48 flex items-end justify-between gap-2 px-2 relative">
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
            <div className="border-t border-gray-400 w-full h-0"></div>
            <div className="border-t border-gray-400 w-full h-0"></div>
            <div className="border-t border-gray-400 w-full h-0"></div>
            <div className="border-t border-gray-400 w-full h-0"></div>
            <div className="border-t border-gray-400 w-full h-0"></div>
          </div>
          
          {mockWinRateData.map((value, i) => (
            <div key={i} className="flex flex-col items-center gap-2 w-full group relative z-10">
              <div 
                className="w-full max-w-[24px] bg-gradient-to-t from-purple-600 to-blue-500 rounded-t-sm transition-all duration-500 group-hover:from-purple-500 group-hover:to-blue-400"
                style={{ height: `${value}%` }}
              >
                <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap border border-white/10 transition-opacity">
                  {value}% Win Rate
                </div>
              </div>
              <span className="text-[10px] text-gray-400">Day {i + 1}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Board Size Preference */}
      <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 backdrop-blur-md rounded-2xl p-6 border border-purple-500/20">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-bold text-white">Board Preference</h3>
          </div>
        </div>

        <div className="space-y-4">
          {/* 3x3 */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-300">3x3 Classic</span>
              <span className="text-gray-400">65%</span>
            </div>
            <div className="h-2 bg-black/30 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 w-[65%] rounded-full"></div>
            </div>
          </div>

          {/* 5x5 */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-300">5x5 Advanced</span>
              <span className="text-gray-400">25%</span>
            </div>
            <div className="h-2 bg-black/30 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 w-[25%] rounded-full"></div>
            </div>
          </div>

          {/* 7x7 */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-300">7x7 Master</span>
              <span className="text-gray-400">10%</span>
            </div>
            <div className="h-2 bg-black/30 rounded-full overflow-hidden">
              <div className="h-full bg-pink-500 w-[10%] rounded-full"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Stats Row */}
      <div className="col-span-1 md:col-span-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {/* Peak Hours */}
        <div className="bg-black/20 rounded-xl p-4 border border-white/5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase">Peak Play Time</p>
            <p className="text-lg font-bold text-white">20:00 - 23:00 UTC</p>
          </div>
        </div>

        {/* Current Strip */}
        <div className="bg-black/20 rounded-xl p-4 border border-white/5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
            <Activity className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase">Current Streak</p>
            <p className="text-lg font-bold text-white">3 Wins 🔥</p>
          </div>
        </div>

        {/* Favorite Token */}
        <div className="bg-black/20 rounded-xl p-4 border border-white/5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
            <span className="text-xs font-bold text-blue-400">CELO</span>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase">Favorite Token</p>
            <p className="text-lg font-bold text-white">CELO</p>
          </div>
        </div>
      </div>
    </div>
  );
}
