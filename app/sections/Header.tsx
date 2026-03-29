'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FaSearch } from 'react-icons/fa'
import { Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

interface HeaderProps {
  searchQuery: string
  setSearchQuery: (q: string) => void
  onSearch: () => void
  isLoading: boolean
  showSample: boolean
  setShowSample: (v: boolean) => void
}

export default function Header({ searchQuery, setSearchQuery, onSearch, isLoading, showSample, setShowSample }: HeaderProps) {
  return (
    <div>
      {/* Navbar */}
      <nav className="w-full border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="font-serif text-xl font-bold tracking-wide text-foreground">
            AstraFlow AI
          </h1>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch id="sample-toggle" checked={showSample} onCheckedChange={setShowSample} />
              <Label htmlFor="sample-toggle" className="text-sm text-muted-foreground cursor-pointer">Sample Data</Label>
            </div>
            <a href="#about" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">About</a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">GitHub</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-3xl mx-auto px-6 pt-16 pb-10 text-center">
        <h2 className="font-serif text-4xl md:text-5xl font-bold tracking-wide text-foreground leading-tight mb-4">
          AI Funding Intelligence Engine
        </h2>
        <p className="text-muted-foreground text-lg leading-relaxed mb-10 max-w-xl mx-auto">
          Track, remember, and explain the AI developer tool market.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto">
          <div className="relative flex-1">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search AI developer tools funding..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !isLoading) onSearch() }}
              className="pl-11 h-12 bg-card border-border text-foreground placeholder:text-muted-foreground rounded-lg text-base"
            />
          </div>
          <Button
            onClick={onSearch}
            disabled={isLoading || !searchQuery.trim()}
            className="h-12 px-6 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg font-medium tracking-wide transition-all duration-200"
          >
            {isLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Scanning...</>
            ) : (
              'Run Intelligence Scan'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
