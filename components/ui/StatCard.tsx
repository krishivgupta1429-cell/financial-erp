import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  color: 'indigo' | 'emerald' | 'rose' | 'amber' | 'violet' | 'cyan'
  trend?: { value: string; positive: boolean }
}

const colorMap = {
  indigo: { bg: 'bg-indigo-500/10', icon: 'bg-indigo-500/20 text-indigo-400', border: 'border-indigo-500/20' },
  emerald: { bg: 'bg-emerald-500/10', icon: 'bg-emerald-500/20 text-emerald-400', border: 'border-emerald-500/20' },
  rose: { bg: 'bg-rose-500/10', icon: 'bg-rose-500/20 text-rose-400', border: 'border-rose-500/20' },
  amber: { bg: 'bg-amber-500/10', icon: 'bg-amber-500/20 text-amber-400', border: 'border-amber-500/20' },
  violet: { bg: 'bg-violet-500/10', icon: 'bg-violet-500/20 text-violet-400', border: 'border-violet-500/20' },
  cyan: { bg: 'bg-cyan-500/10', icon: 'bg-cyan-500/20 text-cyan-400', border: 'border-cyan-500/20' },
}

export default function StatCard({ title, value, subtitle, icon: Icon, color, trend }: StatCardProps) {
  const colors = colorMap[color]
  return (
    <div className={`rounded-2xl border ${colors.border} ${colors.bg} p-5 card-hover`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${colors.icon} flex items-center justify-center`}>
          <Icon size={18} />
        </div>
        {trend && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            trend.positive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
          }`}>
            {trend.positive ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-white mb-1">{value}</p>
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
    </div>
  )
}
