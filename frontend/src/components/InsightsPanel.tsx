import React, { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, DollarSign, Target, Info, ChevronDown, ChevronUp, Sparkles, AlertCircle, CheckCircle } from 'lucide-react'

interface Program {
  id: number
  name: string
  total_cost: number
  department: string
  quartile?: string
  priority_score?: number
  priority_scores?: {
    [key: string]: number
  }
  fte?: number
  service_type?: string
}

interface InsightsPanelProps {
  programs: Program[]
  selectedPriority?: string | null
  priorityGroup?: 'community' | 'governance'
  isCollapsed: boolean
  onToggle: () => void
  selectedDepartment?: string | null  // NEW: Track if user drilled into a department
  activeFilters?: {
    search?: string
    departments?: Set<string>
    quartiles?: Set<string>
    budgetRange?: [number, number]
  }
}

export function InsightsPanel({ 
  programs, 
  selectedPriority, 
  priorityGroup = 'community', 
  isCollapsed, 
  onToggle,
  selectedDepartment = null,
  activeFilters = {}
}: InsightsPanelProps) {
  
  const insights = useMemo(() => {
    if (programs.length === 0) return null

    const totalBudget = programs.reduce((sum, p) => sum + p.total_cost, 0)
    
    // Group by department
    const deptMap = new Map<string, { cost: number, count: number, programs: Program[] }>()
    programs.forEach(p => {
      const dept = p.department || 'Other'
      if (!deptMap.has(dept)) {
        deptMap.set(dept, { cost: 0, count: 0, programs: [] })
      }
      const d = deptMap.get(dept)!
      d.cost += p.total_cost
      d.count += 1
      d.programs.push(p)
    })

    // Top 3 departments by budget
    const topDepartments = Array.from(deptMap.entries())
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 3)

    // Bottom 3 departments (for variety)
    const bottomDepartments = Array.from(deptMap.entries())
      .sort((a, b) => a[1].cost - b[1].cost)
      .slice(0, 3)

    // Q1 programs (highest priority)
    const q1Programs = programs.filter(p => p.quartile === 'Q1')
    const q1Budget = q1Programs.reduce((sum, p) => sum + p.total_cost, 0)

    // Quartile distribution
    const quartileDistribution = {
      Q1: programs.filter(p => p.quartile === 'Q1').length,
      Q2: programs.filter(p => p.quartile === 'Q2').length,
      Q3: programs.filter(p => p.quartile === 'Q3').length,
      Q4: programs.filter(p => p.quartile === 'Q4').length,
    }

    // Average program cost
    const avgProgramCost = totalBudget / programs.length
    
    // Median program cost (more interesting than average!)
    const sortedCosts = programs.map(p => p.total_cost).sort((a, b) => a - b)
    const medianProgramCost = sortedCosts[Math.floor(sortedCosts.length / 2)]
    
    // Largest and smallest programs
    const largestProgram = programs.reduce((max, p) => p.total_cost > max.total_cost ? p : max)
    const smallestProgram = programs.reduce((min, p) => p.total_cost < min.total_cost ? p : min)
    
    // Cost concentration (what % of budget is in top 10% of programs)
    const topTenPercentCount = Math.ceil(programs.length * 0.1)
    const topTenPercentBudget = programs
      .sort((a, b) => b.total_cost - a.total_cost)
      .slice(0, topTenPercentCount)
      .reduce((sum, p) => sum + p.total_cost, 0)
    const concentration = (topTenPercentBudget / totalBudget) * 100

    // FTE analysis
    const programsWithFTE = programs.filter(p => p.fte && p.fte > 0)
    const totalFTE = programsWithFTE.reduce((sum, p) => sum + (p.fte || 0), 0)
    const avgCostPerFTE = totalFTE > 0 ? totalBudget / totalFTE : 0

    // Helper function to get priority score for a program
    const getPriorityScore = (program: Program): number | undefined => {
      if (!selectedPriority || !program.priority_scores) return undefined
      
      const directKey = selectedPriority.toLowerCase().replace(/ /g, '_')
      
      if (program.priority_scores[directKey] !== undefined) {
        return program.priority_scores[directKey]
      }
      
      for (const [key, value] of Object.entries(program.priority_scores)) {
        if (key.toLowerCase().includes(selectedPriority.toLowerCase().replace(/ /g, '_')) ||
            selectedPriority.toLowerCase().replace(/ /g, '_').includes(key.toLowerCase())) {
          return value
        }
      }
      
      return undefined
    }

    // Priority-specific insights (enhanced!)
    let priorityInsights = null
    if (selectedPriority) {
      const programsWithScores = programs
        .map(p => ({ ...p, calculatedScore: getPriorityScore(p) }))
        .filter(p => p.calculatedScore !== undefined && p.calculatedScore > 0)
      
      if (programsWithScores.length > 0) {
        const avgScore = programsWithScores.reduce((sum, p) => sum + (p.calculatedScore || 0), 0) / programsWithScores.length
        const highAlignment = programsWithScores.filter(p => (p.calculatedScore || 0) >= 4)
        const mediumAlignment = programsWithScores.filter(p => (p.calculatedScore || 0) >= 3 && (p.calculatedScore || 0) < 4)
        const lowAlignment = programsWithScores.filter(p => (p.calculatedScore || 0) < 3)
        const highAlignmentBudget = highAlignment.reduce((sum, p) => sum + p.total_cost, 0)
        
        // Most and least aligned programs
        const sortedByAlignment = [...programsWithScores].sort((a, b) => (b.calculatedScore || 0) - (a.calculatedScore || 0))
        const mostAligned = sortedByAlignment[0]
        const leastAligned = sortedByAlignment[sortedByAlignment.length - 1]
        
        // Department alignment
        const deptAlignment = new Map<string, { totalScore: number, count: number }>()
        programsWithScores.forEach(p => {
          const dept = p.department || 'Other'
          if (!deptAlignment.has(dept)) {
            deptAlignment.set(dept, { totalScore: 0, count: 0 })
          }
          const d = deptAlignment.get(dept)!
          d.totalScore += p.calculatedScore || 0
          d.count += 1
        })
        const deptAvgAlignment = Array.from(deptAlignment.entries())
          .map(([dept, data]) => ({ dept, avgScore: data.totalScore / data.count }))
          .sort((a, b) => b.avgScore - a.avgScore)
        
        priorityInsights = {
          avgScore,
          highAlignmentCount: highAlignment.length,
          mediumAlignmentCount: mediumAlignment.length,
          lowAlignmentCount: lowAlignment.length,
          highAlignmentBudget,
          highAlignmentPercent: (highAlignmentBudget / totalBudget) * 100,
          mostAligned: mostAligned ? { name: mostAligned.name, score: mostAligned.calculatedScore || 0, cost: mostAligned.total_cost } : null,
          leastAligned: leastAligned ? { name: leastAligned.name, score: leastAligned.calculatedScore || 0, cost: leastAligned.total_cost } : null,
          topAlignedDept: deptAvgAlignment[0] || null,
          bottomAlignedDept: deptAvgAlignment[deptAvgAlignment.length - 1] || null,
        }
      }
    }

    // Department-specific insights (when drilled down)
    let departmentInsights = null
    if (selectedDepartment && deptMap.has(selectedDepartment)) {
      const deptData = deptMap.get(selectedDepartment)!
      const deptPrograms = deptData.programs
      
      const deptSortedCosts = deptPrograms.map(p => p.total_cost).sort((a, b) => a - b)
      const deptMedianCost = deptSortedCosts[Math.floor(deptSortedCosts.length / 2)]
      const deptLargest = deptPrograms.reduce((max, p) => p.total_cost > max.total_cost ? p : max)
      const deptSmallest = deptPrograms.reduce((min, p) => p.total_cost < min.total_cost ? p : min)
      
      departmentInsights = {
        name: selectedDepartment,
        totalBudget: deptData.cost,
        programCount: deptData.count,
        percentOfTotal: (deptData.cost / totalBudget) * 100,
        avgProgramCost: deptData.cost / deptData.count,
        medianProgramCost: deptMedianCost,
        largestProgram: { name: deptLargest.name, cost: deptLargest.total_cost },
        smallestProgram: { name: deptSmallest.name, cost: deptSmallest.total_cost },
        costRange: deptLargest.total_cost / deptSmallest.total_cost,
      }
    }

    return {
      totalBudget,
      programCount: programs.length,
      topDepartments,
      bottomDepartments,
      q1Programs: q1Programs.length,
      q1Budget,
      q1Percent: (q1Budget / totalBudget) * 100,
      quartileDistribution,
      avgProgramCost,
      medianProgramCost,
      largestProgram: { name: largestProgram.name, cost: largestProgram.total_cost },
      smallestProgram: { name: smallestProgram.name, cost: smallestProgram.total_cost },
      concentration,
      totalFTE,
      avgCostPerFTE,
      priorityInsights,
      departmentInsights,
    }
  }, [programs, selectedPriority, selectedDepartment])

  const formatCurrency = (value: number): string => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`
    } else {
      return `$${value.toFixed(0)}`
    }
  }

  // Generate contextual fun facts
  const funFacts = useMemo(() => {
    if (!insights) return []
    
    const facts: string[] = []
    
    // Department-specific fun facts
    if (insights.departmentInsights) {
      const dept = insights.departmentInsights
      facts.push(`${dept.name} represents ${dept.percentOfTotal.toFixed(1)}% of the total budget`)
      facts.push(`The largest program (${dept.largestProgram.name}) is ${dept.costRange.toFixed(1)}x larger than the smallest`)
      facts.push(`Average program cost in ${dept.name}: ${formatCurrency(dept.avgProgramCost)}`)
      return facts
    }
    
    // Priority-specific fun facts
    if (selectedPriority && insights.priorityInsights) {
      const pri = insights.priorityInsights
      facts.push(`${pri.highAlignmentCount} programs are highly aligned (4-5 rating) with ${selectedPriority}`)
      if (pri.topAlignedDept) {
        facts.push(`${pri.topAlignedDept.dept} has the highest average alignment score (${pri.topAlignedDept.avgScore.toFixed(1)}/5)`)
      }
      if (pri.mostAligned) {
        facts.push(`Top aligned program: "${pri.mostAligned.name}" with a ${pri.mostAligned.score.toFixed(1)}/5 score`)
      }
      return facts
    }
    
    // General fun facts
    if (insights.concentration > 50) {
      facts.push(`Budget is concentrated: top 10% of programs account for ${insights.concentration.toFixed(0)}% of spending`)
    } else {
      facts.push(`Budget is well-distributed: top 10% of programs account for only ${insights.concentration.toFixed(0)}% of spending`)
    }
    
    facts.push(`Largest program (${insights.largestProgram.name}) costs ${formatCurrency(insights.largestProgram.cost)}`)
    
    if (insights.totalFTE > 0) {
      facts.push(`Average cost per FTE across all programs: ${formatCurrency(insights.avgCostPerFTE)}`)
    }
    
    // Quartile insights
    if (insights.q1Programs > 0) {
      facts.push(`${insights.q1Programs} programs in Q1 (highest priority) receive ${insights.q1Percent.toFixed(0)}% of the budget`)
    }
    
    return facts.slice(0, 3) // Only show top 3 facts
  }, [insights, selectedPriority])

  if (!insights) return null

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header - Always Visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Key Insights
          </h3>
          {insights.departmentInsights && (
            <span className="text-sm text-gray-500">
              — Exploring {insights.departmentInsights.name}
            </span>
          )}
        </div>
        {isCollapsed ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronUp className="h-5 w-5 text-gray-400" />}
      </button>

      {/* Expandable Content */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 space-y-4">
              {/* Key Metrics Grid */}
              <AnimatePresence mode="wait">
                <motion.div 
                  key={`metrics-${insights.departmentInsights?.name || 'general'}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-3 gap-3"
                >
                  {insights.departmentInsights ? (
                    <>
                      {/* Department-specific metrics */}
                      <div className="bg-white rounded-lg p-4 border border-blue-100">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-gray-600">Dept Budget</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatCurrency(insights.departmentInsights.totalBudget)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {insights.departmentInsights.percentOfTotal.toFixed(1)}% of total
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-blue-100">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-gray-600">Avg Program</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatCurrency(insights.departmentInsights.avgProgramCost)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {insights.departmentInsights.programCount} programs
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-blue-100">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="h-4 w-4 text-purple-600" />
                          <span className="text-sm font-medium text-gray-600">Cost Range</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">
                          {insights.departmentInsights.costRange.toFixed(0)}x
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Largest vs smallest
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* General stats */}
                      <div className="bg-white rounded-lg p-4 border border-blue-100">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-gray-600">Total Budget</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(insights.totalBudget)}</p>
                        <p className="text-xs text-gray-500 mt-1">Across {insights.programCount} programs</p>
                      </div>

                      <div className="bg-white rounded-lg p-4 border border-blue-100">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-gray-600">Median Cost</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(insights.medianProgramCost)}</p>
                        <p className="text-xs text-gray-500 mt-1">Half above, half below</p>
                      </div>

                      <div className="bg-white rounded-lg p-4 border border-blue-100">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="h-4 w-4 text-purple-600" />
                          <span className="text-sm font-medium text-gray-600">Concentration</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{insights.concentration.toFixed(0)}%</p>
                        <p className="text-xs text-gray-500 mt-1">In top 10% of programs</p>
                      </div>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Priority-Specific Insights - Enhanced */}
              {selectedPriority && insights.priorityInsights && !insights.departmentInsights && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-200"
                >
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4 text-indigo-600" />
                    {selectedPriority} Alignment
                  </h4>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        <span className="text-xs text-gray-600">High (4-5)</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900">{insights.priorityInsights.highAlignmentCount}</p>
                      <p className="text-xs text-gray-500">{formatCurrency(insights.priorityInsights.highAlignmentBudget)}</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <AlertCircle className="h-3 w-3 text-amber-600" />
                        <span className="text-xs text-gray-600">Medium (3-4)</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900">{insights.priorityInsights.mediumAlignmentCount}</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <AlertCircle className="h-3 w-3 text-red-600" />
                        <span className="text-xs text-gray-600">Low (0-3)</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900">{insights.priorityInsights.lowAlignmentCount}</p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-indigo-200">
                    <p className="text-xs text-gray-600">
                      💡 <strong>Insight:</strong> {insights.priorityInsights.highAlignmentPercent.toFixed(0)}% of your budget 
                      is highly aligned with {selectedPriority}. 
                      {insights.priorityInsights.highAlignmentPercent < 20 
                        ? " This may indicate an opportunity to increase alignment."
                        : insights.priorityInsights.highAlignmentPercent > 40
                        ? " This shows strong strategic commitment."
                        : " This represents a balanced allocation."}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Dynamic "Did You Know" Section with Fun Facts */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={`facts-${selectedDepartment || selectedPriority || 'default'}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-4 border border-amber-200"
                >
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-600" />
                    {insights.departmentInsights 
                      ? `About ${insights.departmentInsights.name}`
                      : selectedPriority 
                      ? `${selectedPriority} Insights`
                      : 'Did You Know?'}
                  </h4>
                  <ul className="text-sm text-gray-700 space-y-1.5">
                    {funFacts.map((fact, index) => (
                      <motion.li
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        • {fact}
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}