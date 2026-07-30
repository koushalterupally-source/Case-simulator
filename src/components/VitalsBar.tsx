import React from 'react';
import { Heart, Activity, Thermometer, Wind, Droplet, Zap } from 'lucide-react';
import { Vitals } from '../types';

interface VitalsBarProps {
  vitals: Vitals;
}

export const VitalsBar: React.FC<VitalsBarProps> = ({ vitals }) => {
  // Determine warning states
  const isHrAbnormal = vitals.hr < 60 || vitals.hr > 110;
  const isSpo2Low = vitals.spo2 < 94;

  return (
    <div className="bg-slate-950 border-y border-slate-800/80 px-4 py-2 text-xs font-mono">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-slate-300">
        <div className="flex items-center space-x-1.5 text-slate-400 font-sans text-xs uppercase tracking-wider font-semibold">
          <Activity className="w-3.5 h-3.5 text-indigo-400" />
          <span>PATIENT VITALS:</span>
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          {/* Heart Rate */}
          <div className="flex items-center space-x-1.5">
            <Heart className={`w-3.5 h-3.5 ${isHrAbnormal ? 'text-rose-400 animate-bounce' : 'text-rose-500'}`} />
            <span className="text-slate-400">HR:</span>
            <span className={`font-bold ${isHrAbnormal ? 'text-rose-400' : 'text-slate-100'}`}>
              {vitals.hr} bpm
            </span>
          </div>

          {/* Blood Pressure */}
          <div className="flex items-center space-x-1.5">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">BP:</span>
            <span className="font-bold text-slate-100">{vitals.bp} mmHg</span>
          </div>

          {/* Respiratory Rate */}
          <div className="flex items-center space-x-1.5">
            <Wind className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">RR:</span>
            <span className="font-bold text-slate-100">{vitals.rr} /min</span>
          </div>

          {/* SpO2 */}
          <div className="flex items-center space-x-1.5">
            <Droplet className={`w-3.5 h-3.5 ${isSpo2Low ? 'text-amber-400' : 'text-blue-400'}`} />
            <span className="text-slate-400">SpO2:</span>
            <span className={`font-bold ${isSpo2Low ? 'text-amber-400' : 'text-slate-100'}`}>
              {vitals.spo2}%
            </span>
          </div>

          {/* Temperature */}
          <div className="flex items-center space-x-1.5">
            <Thermometer className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-slate-400">Temp:</span>
            <span className="font-bold text-slate-100">{vitals.temp}</span>
          </div>

          {/* GRBS / Blood Glucose */}
          <div className="flex items-center space-x-1.5">
            <Zap className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-slate-400">GRBS:</span>
            <span className="font-bold text-slate-100">{vitals.grbs} mg/dL</span>
          </div>
        </div>
      </div>
    </div>
  );
};
