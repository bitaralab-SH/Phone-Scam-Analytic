
import React from 'react';
import { RiskLevel } from '../types.ts';

interface RiskMeterProps {
  score: number;
  level: RiskLevel;
  size?: number;
}

const RiskMeter: React.FC<RiskMeterProps> = ({ score, level, size = 200 }) => {
  const radius = size * 0.4;
  const strokeWidth = size * 0.08;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const getColor = (lvl: RiskLevel) => {
    switch (lvl) {
      case 'Low': return '#10b981'; // Emerald-500
      case 'Medium': return '#f59e0b'; // Amber-500
      case 'High': return '#f97316'; // Orange-500
      case 'Critical': return '#ef4444'; // Red-500
      default: return '#3b82f6'; // Blue-500
    }
  };

  const color = getColor(level);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Background Track */}
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.03)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Glow Layer */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-1000 ease-out opacity-20 blur-[8px]"
        />
        {/* Primary Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-1000 ease-out shadow-lg"
        />
      </svg>
      
      {/* Center Number */}
      <div className="absolute flex flex-col items-center">
        <span className="text-6xl font-black text-white tracking-tighter" style={{ textShadow: `0 0 30px ${color}66` }}>
          {score}
        </span>
        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-1">
          Risk Index
        </span>
      </div>
    </div>
  );
};

export default RiskMeter;
