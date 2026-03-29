'use client'

import { Button } from '@/components/ui/button'
import { FaFileExport, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa'
import { Loader2 } from 'lucide-react'

interface ExportBarProps {
  visible: boolean
  isExporting: boolean
  exportStatus: { type: 'success' | 'error' | null; message: string; url?: string }
  onExport: () => void
}

export default function ExportBar({ visible, isExporting, exportStatus, onExport }: ExportBarProps) {
  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-sm border-t border-border shadow-lg">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {exportStatus.type === 'success' && (
            <div className="flex items-center gap-2 text-sm text-green-700 min-w-0">
              <FaCheckCircle className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{exportStatus.message}</span>
              {exportStatus.url && (
                <a
                  href={exportStatus.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline underline-offset-2 hover:text-accent/80 transition-colors duration-200 flex-shrink-0"
                >
                  Open Sheet
                </a>
              )}
            </div>
          )}
          {exportStatus.type === 'error' && (
            <div className="flex items-center gap-2 text-sm text-destructive min-w-0">
              <FaExclamationCircle className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{exportStatus.message}</span>
            </div>
          )}
          {!exportStatus.type && !isExporting && (
            <p className="text-sm text-muted-foreground">Export results to Google Sheets</p>
          )}
        </div>
        <Button
          onClick={onExport}
          disabled={isExporting}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg font-medium tracking-wide transition-all duration-200 flex-shrink-0"
        >
          {isExporting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exporting...</>
          ) : (
            <><FaFileExport className="mr-2 h-4 w-4" /> Export to Sheets</>
          )}
        </Button>
      </div>
    </div>
  )
}
