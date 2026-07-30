import React from 'react';
import { Heart, Activity, Thermometer, Wind, Droplet, Zap } from 'lucide-react';
import { Vitals } from '../types';
import {
  VitalSeverity,
  hrSeverity,
  spo2Severity,
  rrSeverity,
  bpSeverity,
  tempSeverity,
  grbsSeverity,
} from '../utils/gamification';

interface VitalsBarProps {
  vitals: Vitals;
}

const TONE: Record<VitalSeverity, { value: string; icon: string; chip: string }> = {
  normal: {
    value: 'text-slate-100',
    icon: 'text-slate-500',
    chip: 'border-transparent',
  },
  warning: {
    value: 'text-amber-300',
    icon: 'text-amber-400',
    chip: 'border-amber-500/40 bg-amber-500/10',
  },
  critical: {
    value: 'text-rose-300',
    icon: 'text-rose-400 animate-pulse',
    chip: 'border-rose-500/50 bg-rose-500/10',
  },
};

const Vital: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  severity: VitalSeverity;
}> = ({ icon, label, value, severity }) => {
  const tone = TONE[severity];
  return (
    <div
      className={`flex items-center space-x-1.5 border rounded-lg px-2 py-0.5 transition-colors duration-500 ${tone.chip}`}
      title={severity === 'normal' ? undefined : `${label} is ${severity}`}
    >
      <span className={tone.icon}>{icon}</span>
      <span className="text-slate-400">{label}:</span>
      <span className={`font-bold ${tone.value}`}>{value}</span>
    </div>
  );
};

export const VitalsBar: React.FC<VitalsBarProps> = ({ vitals }) => {
  return (
    <div className="bg-slate-950 border-y border-slate-800/80 px-4 py-2 text-xs font-mono">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-slate-300">
        <div className="flex items-center space-x-1.5 text-slate-400 font-sans text-xs uppercase tracking-wider font-semibold">
          <Activity className="w-3.5 h-3.5 text-indigo-400" />
          <span>PATIENT VITALS:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Vital
            icon={<Heart className="w-3.5 h-3.5" />}
            label="HR"
            value={`${vitals.hr} bpm`}
            severity={hrSeverity(vitals.hr)}
          />
          <Vital
            icon={<Activity className="w-3.5 h-3.5" />}
            label="BP"
            value={`${vitals.bp} mmHg`}
            severity={bpSeverity(vitals.bp)}
          />
          <Vital
            icon={<Wind className="w-3.5 h-3.5" />}
            label="RR"
            value={`${vitals.rr} /min`}
            severity={rrSeverity(vitals.rr)}
          />
          <Vital
            icon={<Droplet className="w-3.5 h-3.5" />}
            label="SpO2"
            value={`${vitals.spo2}%`}
            severity={spo2Severity(vitals.spo2)}
          />
          <Vital
            icon={<Thermometer className="w-3.5 h-3.5" />}
            label="Temp"
            value={vitals.temp}
            severity={tempSeverity(vitals.temp)}
          />
          <Vital
            icon={<Zap className="w-3.5 h-3.5" />}
            label="GRBS"
            value={`${vitals.grbs} mg/dL`}
            severity={grbsSeverity(vitals.grbs)}
          />
        </div>
      </div>
    </div>
  );
};
