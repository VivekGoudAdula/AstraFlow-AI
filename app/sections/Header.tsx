'use client'

import React from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FaSearch, FaGithub, FaRobot } from 'react-icons/fa'
import { Loader2, Sparkles, Zap } from 'lucide-react'

interface HeaderProps {
  searchQuery: string
  setSearchQuery: (q: string) => void
  onSearch: () => void
  isLoading: boolean
}

export default function Header({ searchQuery, setSearchQuery, onSearch, isLoading }: HeaderProps) {
  return (
    <div className="relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full pointer-events-none animate-pulse" />
      <div className="absolute bottom-[20%] right-[-5%] w-[30%] h-[30%] bg-accent/20 blur-[100px] rounded-full pointer-events-none animate-float" />

      {/* Navbar */}
      <nav className="w-full border-b border-white/5 bg-background/20 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 group cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 group-hover:rotate-12 transition-transform duration-300">
              <FaRobot className="text-white text-xl" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
              AstraFlow<span className="text-primary font-black ml-1">AI</span>
            </h1>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#about" className="text-sm font-medium text-white/60 hover:text-primary transition-colors flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Systems
            </a>
            <a href="https://github.com/VivekGoudAdula/AstraFlow-AI" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-white/60 hover:text-white transition-colors flex items-center gap-2">
              <FaGithub className="w-4 h-4" /> Source
            </a>
            <Button variant="outline" className="rounded-full border-white/10 bg-white/5 hover:bg-white/10 text-white gap-2">
              <Zap className="w-4 h-4 text-primary fill-primary" /> v1.2 Pro
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-5xl mx-auto px-6 pt-24 pb-16 text-center relative z-10">
        <h2 className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-tight mb-8 bg-clip-text text-transparent bg-gradient-to-r from-white via-primary/90 to-white bg-[length:200%_auto] animate-[shimmer_4s_linear_infinite] whitespace-nowrap">
          AI Funding Intelligence
        </h2>

        <p className="text-white/60 md:text-xl text-lg leading-relaxed mb-12 max-w-2xl mx-auto font-light">
          The ultimate engine to track high-velocity AI funding rounds with <span className="text-white font-medium">zero-hallucination, verified data sourcing.</span>
        </p>

        {/* Search Container */}
        <div className="max-w-3xl mx-auto p-2 rounded-[2rem] glass border-white/10 shadow-2xl shadow-primary/10">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 group">
              <FaSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-primary transition-colors w-4 h-4" />
              <Input
                placeholder="Enter AI niche (e.g. 'LLM observability')..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !isLoading) onSearch() }}
                className="pl-12 h-14 bg-white/5 border-transparent focus:border-primary/50 text-white placeholder:text-white/20 rounded-[1.5rem] text-lg transition-all"
              />
            </div>
            <Button
              onClick={onSearch}
              disabled={isLoading || !searchQuery.trim()}
              className="h-14 px-10 premium-button rounded-[1.5rem] group"
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Analyzing...</>
              ) : (
                <span className="flex items-center gap-2">
                  Launch Scan <Zap className="w-4 h-4 group-hover:scale-125 transition-transform" />
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Quick Stats/Tags */}
        <div className="flex flex-wrap justify-center gap-4 mt-12 opacity-50 hover:opacity-100 transition-opacity">
          {['Generative AI', 'Agents', 'Infrastructure', 'Cybersecurity'].map(tag => (
            <span key={tag} className="text-xs font-semibold px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-white/50 cursor-pointer hover:border-primary/40 hover:text-white transition-all">
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

