'use client'

import { Skeleton } from '@/components/ui/skeleton'

interface LoadingStateProps {
  loadingStep: string
}

const PIPELINE_STEPS = [
  { label: 'Researching', key: 'researching' },
  { label: 'Extracting', key: 'extracting' },
  { label: 'Enriching', key: 'enriching' },
  { label: 'Complete', key: 'complete' },
]

function getStepIndex(step: string): number {
  const lower = step.toLowerCase()
  if (lower.includes('complete')) return 3
  if (lower.includes('enrich')) return 2
  if (lower.includes('extract')) return 1
  return 0
}

export default function LoadingState({ loadingStep }: LoadingStateProps) {
  const currentIdx = getStepIndex(loadingStep)

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Pipeline Stepper */}
      <div className="flex items-center justify-center gap-2 mb-10">
        {PIPELINE_STEPS.map((step, i) => {
          const isActive = i === currentIdx
          const isDone = i < currentIdx
          return (
            <div key={step.key} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                    isDone
                      ? 'bg-primary text-primary-foreground'
                      : isActive
                        ? 'bg-accent text-accent-foreground animate-pulse shadow-md shadow-accent/30'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isDone ? '\u2713' : i + 1}
                </div>
                <span className={`text-xs tracking-wide ${isActive ? 'text-accent font-semibold' : isDone ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {step.label}
                </span>
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <div className={`w-12 h-0.5 mb-5 ${isDone ? 'bg-primary' : 'bg-muted'} transition-colors duration-300`} />
              )}
            </div>
          )
        })}
      </div>

      <p className="text-center text-muted-foreground text-sm mb-8 tracking-wide">{loadingStep}</p>

      {/* Skeleton Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3].map((n) => (
          <div key={n} className="bg-card border border-border rounded-lg p-6 space-y-4">
            <Skeleton className="h-6 w-3/4 bg-muted" />
            <Skeleton className="h-4 w-1/2 bg-muted" />
            <div className="flex gap-3">
              <Skeleton className="h-4 w-20 bg-muted" />
              <Skeleton className="h-4 w-24 bg-muted" />
              <Skeleton className="h-4 w-16 bg-muted" />
            </div>
            <Skeleton className="h-16 w-full bg-muted" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16 rounded-full bg-muted" />
              <Skeleton className="h-6 w-20 rounded-full bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
