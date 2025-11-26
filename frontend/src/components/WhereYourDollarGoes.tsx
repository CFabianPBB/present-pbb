import { useState } from 'react'
import { motion } from 'framer-motion'

// Helper function to format currency with commas
const formatCurrency = (value: number, decimals: number = 2): string => {
  return value.toLocaleString('en-US', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  })
}

interface Priority {
  id: number
  name: string
  group: string
  per_capita_cost: number
  program_count: number
  avg_alignment: number
}

interface DollarSegment {
  name: string
  amount: number
  percentage: number
  cents: number
  color: string
  emoji: string
  group: string
}

interface WhereYourDollarGoesProps {
  communityPriorities: Priority[]
  governancePriorities: Priority[]
  perCapitaTotal: number
}

export default function WhereYourDollarGoes({ 
  communityPriorities, 
  governancePriorities, 
  perCapitaTotal 
}: WhereYourDollarGoesProps) {
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null)

  // Color palette for priorities
  const priorityColors: { [key: string]: { color: string, emoji: string } } = {
    // Community priorities - warm/vibrant colors
    'Community Safety': { color: '#dc2626', emoji: '🚔' },
    'Health & Wellness': { color: '#ea580c', emoji: '🏥' },
    'Parks & Recreation': { color: '#16a34a', emoji: '🌳' },
    'Community Development': { color: '#d97706', emoji: '🏗️' },
    'Environmental Services': { color: '#059669', emoji: '♻️' },
    'Transportation': { color: '#0891b2', emoji: '🚗' },
    'Culture & Arts': { color: '#7c3aed', emoji: '🎨' },
    
    // Governance priorities - cooler/professional colors
    'Governance': { color: '#6366f1', emoji: '🏛️' },
    'Finance': { color: '#8b5cf6', emoji: '💰' },
    'Legal': { color: '#a855f7', emoji: '⚖️' },
    'Administration': { color: '#6366f1', emoji: '📋' },
    'Human Resources': { color: '#8b5cf6', emoji: '👥' },
    'Information Technology': { color: '#a855f7', emoji: '💻' },
  }

  // Get default color/emoji if not found
  const getStyleForPriority = (name: string, group: string) => {
    if (priorityColors[name]) {
      return priorityColors[name]
    }
    // Default colors based on group
    return group === 'Community' 
      ? { color: '#3b82f6', emoji: '🏘️' }
      : { color: '#6b7280', emoji: '🏛️' }
  }

  // Create segments from priorities
  const allPriorities = [
    ...communityPriorities.map(p => ({
      name: p.name,
      amount: p.per_capita_cost,
      ...getStyleForPriority(p.name, p.group),
      group: p.group
    })),
    ...governancePriorities.map(p => ({
      name: p.name,
      amount: p.per_capita_cost,
      ...getStyleForPriority(p.name, p.group),
      group: p.group
    }))
  ]

  // NORMALIZE to $1.00 (100 cents)
  // Even though leverage means priorities sum to more than per_capita_total,
  // we want to show "where each actual dollar goes"
  const totalPriorityAmount = allPriorities.reduce((sum, p) => sum + p.amount, 0)
  
  const segments: DollarSegment[] = allPriorities.map(p => ({
    name: p.name,
    amount: p.amount,
    // Normalize: what fraction of the TOTAL priority spending is this priority?
    // This ensures segments add up to 100%
    percentage: (p.amount / totalPriorityAmount) * 100,
    // For display: show as cents out of $1
    cents: Math.round((p.amount / totalPriorityAmount) * 100),
    color: p.color,
    emoji: p.emoji,
    group: p.group
  }))

  // Sort by percentage (largest first) for visual impact
  segments.sort((a, b) => b.percentage - a.percentage)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.35 }}
      className="bg-white rounded-lg shadow-lg p-8 mb-8"
    >
      <h2 className="text-2xl font-bold mb-2">Where Your Dollar Goes</h2>
      <p className="text-gray-600 mb-6">
        See how each dollar of your per-resident investment is allocated across community priorities
      </p>

      {/* Desktop: Horizontal Dollar Bill */}
      <div className="hidden md:block">
        {/* Height calculated to maintain 2.35:1 ratio (dollar bill proportions) - using w-full as base, h should be ~42.5% of width */}
        <div className="relative w-full" style={{ paddingBottom: '18%' }}>
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-100 via-lime-50 to-emerald-100 rounded-xl border-[6px] border-emerald-800 shadow-2xl overflow-visible">
            {/* Segments - base layer */}
            <div className="flex h-full relative z-0">
              {segments.map((segment, index) => (
                <div
                  key={segment.name}
                  className="relative"
                  style={{ width: `${segment.percentage}%` }}
                >
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ 
                      duration: 1, 
                      delay: 0.5 + (index * 0.1),
                      type: 'spring',
                      stiffness: 50
                    }}
                    onMouseEnter={() => setHoveredSegment(segment.name)}
                    onMouseLeave={() => setHoveredSegment(null)}
                    style={{ 
                      backgroundColor: segment.color,
                      transformOrigin: 'left'
                    }}
                    className="h-full flex flex-col items-center justify-center text-white font-semibold text-sm cursor-pointer transition-all hover:brightness-110 hover:shadow-lg border-r-2 border-white/50"
                  >
                    {/* Only show label if segment is wide enough */}
                    {segment.percentage > 8 && (
                      <>
                        <div className="text-2xl mb-1">{segment.emoji}</div>
                        <div className="text-xs text-center px-2 leading-tight font-medium">
                          {segment.percentage > 12 ? segment.name : ''}
                        </div>
                        <div className="text-lg font-bold drop-shadow">
                          {segment.cents}¢
                        </div>
                      </>
                    )}
                  </motion.div>

                  {/* Tooltip on hover - positioned relative to parent, not segment */}
                  {hoveredSegment === segment.name && (
                    <div className="absolute left-1/2 transform -translate-x-1/2 pointer-events-none" style={{ top: '-140px', zIndex: 9999 }}>
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gray-900 text-white px-5 py-4 rounded-xl shadow-2xl w-64 text-center"
                      >
                        <div className="text-2xl mb-2">{segment.emoji}</div>
                        <div className="font-bold text-lg">{segment.name}</div>
                        <div className="text-sm mt-2 text-gray-300">
                          ${formatCurrency(segment.amount)} per resident
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {segment.percentage.toFixed(1)}% of priority spending
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-700">
                          <div className="text-2xl font-bold text-green-400">
                            {segment.cents}¢
                          </div>
                          <div className="text-xs text-gray-400">of every dollar</div>
                        </div>
                        {/* Arrow pointing down */}
                        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[8px] border-transparent border-t-gray-900"></div>
                      </motion.div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Dollar bill decorative elements - TOP LAYER with high z-index - NO "ONE" watermark */}
            <div className="absolute inset-0 pointer-events-none z-10">
              {/* Dollar amounts */}
              <div className="absolute top-3 left-6 text-emerald-900 font-serif text-3xl font-black drop-shadow-md">$1</div>
              <div className="absolute bottom-3 right-6 text-emerald-900 font-serif text-3xl font-black drop-shadow-md">$1</div>
              
              {/* Decorative corner flourishes */}
              <div className="absolute top-3 right-3 w-10 h-10 border-4 border-emerald-800 rounded-full opacity-30"></div>
              <div className="absolute bottom-3 left-3 w-10 h-10 border-4 border-emerald-800 rounded-full opacity-30"></div>
              
              {/* Serial number style decoration */}
              <div className="absolute top-1 left-1/2 transform -translate-x-1/2 text-emerald-800 font-mono text-xs font-semibold opacity-50">
                TAXPAYER DIVIDEND • SERIES 2025
              </div>
            </div>
          </div>
        </div>

        {/* Complete Priority Breakdown - Show ALL priorities */}
        <div className="mt-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-5 border-2 border-gray-200 shadow-sm">
          <div className="text-base font-bold text-gray-800 mb-4 flex items-center">
            <span className="mr-2">📊</span>
            Complete Priority Breakdown
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {segments.map(segment => (
              <div key={segment.name} className="flex items-center text-sm bg-white rounded-md p-2 shadow-sm border border-gray-200">
                <div 
                  className="w-6 h-6 rounded mr-3 flex-shrink-0 border-2 border-gray-300 shadow-sm" 
                  style={{ backgroundColor: segment.color }}
                />
                <span className="text-gray-700 flex-1">
                  <span className="font-medium">{segment.emoji} {segment.name}:</span>{' '}
                  <span className="font-bold text-gray-900">{segment.cents}¢</span>
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-center text-gray-500 italic">
            All values normalized to show allocation per dollar of priority spending
          </div>
        </div>
      </div>

      {/* Mobile: Vertical Stack */}
      <div className="md:hidden space-y-2">
        {segments.map((segment, index) => (
          <motion.div
            key={segment.name}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.5 + (index * 0.1) }}
            className="bg-gray-50 rounded-lg p-4 border-l-4"
            style={{ borderLeftColor: segment.color }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-2xl mr-3">{segment.emoji}</span>
                <div>
                  <div className="font-semibold text-gray-900">{segment.name}</div>
                  <div className="text-sm text-gray-600">{segment.group}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold" style={{ color: segment.color }}>
                  {segment.cents}¢
                </div>
                <div className="text-sm text-gray-600">
                  ${formatCurrency(segment.amount)}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-6 text-center text-sm text-gray-600">
        Every dollar of your ${formatCurrency(perCapitaTotal)} per-resident investment
      </div>
    </motion.div>
  )
}