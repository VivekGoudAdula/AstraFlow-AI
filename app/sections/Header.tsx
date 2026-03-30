'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FaSearch } from 'react-icons/fa'
import { Loader2 } from 'lucide-react'

interface HeaderProps {
  searchQuery: string
  setSearchQuery: (q: string) => void
  onSearch: () => void
  isLoading: boolean
}

export default function Header({ searchQuery, setSearchQuery, onSearch, isLoading }: HeaderProps) {
  return (
    <div>
      {/* Navbar */}
      <nav className="w-full border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="font-serif text-xl font-bold tracking-wide text-foreground">
            AstraFlow AI
          </h1>
          <div className="flex items-center gap-6">
            <a href="#about" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200">About Agents</a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200">GitHub</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center relative z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg h-64 bg-primary/20 blur-[100px] rounded-full -z-10 pointer-events-none" />
        
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/50 border border-border/50 text-xs font-semibold text-primary mb-6">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Powered by Deep Market Intelligence
        </div>

        <h2 className="font-serif text-5xl md:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-foreground to-muted-foreground leading-tight mb-6">
          AI Funding Intelligence Engine
        </h2>
        <p className="text-muted-foreground/90 md:text-xl text-lg leading-relaxed mb-10 max-w-2xl mx-auto font-light">
          Track, remember, and analyze the AI developer tool market with <span className="text-foreground font-medium">high-fidelity semantic search.</span>
        </p>

        <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto shadow-xl shadow-black/5 rounded-xl">
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
