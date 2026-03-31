'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { CheckCircle2, CircleDashed, Cpu, Database, Network, Search, Zap } from 'lucide-react'

interface LoadingStateProps {
  loadingStep: string
}

const PIPELINE_STEPS = [
  { label: 'Intelligence Scan', key: 'researching', icon: Search },
  { label: 'Entity Extraction', key: 'extracting', icon: Cpu },
  { label: 'Synaptic Enrichment', key: 'enriching', icon: Network },
  { label: 'Final Verification', key: 'complete', icon: Database },
]

function getStepIndex(step: string): number {
  const lower = step.toLowerCase()
  if (lower.includes('verify') || lower.includes('complete')) return 3
  if (lower.includes('enrich') || lower.includes('profile')) return 2
  if (lower.includes('extract')) return 1
  return 0
}

export default function LoadingState({ loadingStep }: LoadingStateProps) {
  const currentIdx = getStepIndex(loadingStep)

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 relative">
      {/* Pipeline Stepper */}
      <div className="flex flex-wrap items-center justify-center gap-6 mb-16">
        {PIPELINE_STEPS.map((step, i) => {
          const isActive = i === currentIdx
          const isDone = i < currentIdx
          const Icon = step.icon

          return (
            <div key={step.key} className="flex items-center gap-4 group">
              <div className="flex flex-col items-center gap-3">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-700 border-2 ${
                    isDone
                      ? 'bg-primary/20 border-primary shadow-[0_0_15px_rgba(30,174,219,0.3)] text-primary'
                      : isActive
                        ? 'bg-white/10 border-white/40 text-white animate-pulse shadow-[0_0_20px_rgba(255,255,255,0.2)]'
                        : 'bg-white/5 border-white/5 text-white/20'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-6 h-6" /> : isActive ? <CircleDashed className="w-6 h-6 animate-spin" /> : <Icon className="w-6 h-6" />}
                </div>
                <div className="text-center">
                  <span className={`text-[10px] block font-black uppercase tracking-widest ${isActive ? 'text-primary' : isDone ? 'text-white/60' : 'text-white/20'}`}>
                    0{i+1}
                  </span>
                  <span className={`text-xs font-bold ${isActive ? 'text-white' : isDone ? 'text-white/40' : 'text-white/10'}`}>
                    {step.label}
                  </span>
                </div>
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <div className="hidden lg:block w-24 h-[2px] mb-8 bg-white/5 relative overflow-hidden">
                   {isDone && <div className="absolute inset-0 bg-primary animate-in fade-in slide-in-from-left duration-1000" />}
                   {isActive && <div className="absolute inset-0 bg-gradient-to-r from-primary to-transparent animate-shimmer" />}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex flex-col items-center justify-center space-y-4 mb-12">
        <div className="px-6 py-2 rounded-full glass border-primary/30 flex items-center gap-3">
           <Zap className="w-4 h-4 text-primary animate-bounce" />
           <span className="text-sm font-black text-white tracking-tight uppercase shimmer">{loadingStep}</span>
        </div>
      </div>

      {/* Skeleton cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {[1, 2, 3].map((n) => (
          <div key={n} className="glass-card border-white/5 p-8 rounded-3xl space-y-6 relative overflow-hidden">
            <div className="absolute inset-0 shimmer opacity-20 pointer-events-none" />
            <div className="flex justify-between items-start">
               <div className="space-y-3 w-full">
                  <Skeleton className="h-8 w-3/4 bg-white/5 rounded-lg" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-24 bg-white/5 rounded-full" />
                    <Skeleton className="h-5 w-32 bg-white/5 rounded-full" />
                  </div>
               </div>
               <Skeleton className="h-14 w-14 rounded-2xl bg-white/10 shrink-0" />
            </div>
            
            <div className="space-y-3">
              <Skeleton className="h-20 w-full bg-white/5 rounded-2xl" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-12 w-full bg-white/5 rounded-xl" />
              <Skeleton className="h-12 w-full bg-white/5 rounded-xl" />
            </div>

            <div className="flex gap-2 pt-2">
               <Skeleton className="h-8 w-full bg-white/10 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

