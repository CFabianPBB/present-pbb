import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Search, X, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'


interface Program {
  id: number
  name: string
  total_cost: number
  department: string  // This will actually contain user_group from backend
  user_group?: string  // Keep this for compatibility
  quartile?: string
  fte?: number
  service_type?: string
  description?: string
  priority_score?: number
  priority_scores?: {
    [key: string]: number
  }
}

interface Department {
  name: string
  total_cost: number
  programs: Program[]
  priority_score: number
}

interface HierarchicalTreemapProps {
  data: Program[]
  selectedPriority?: string | null
  priorityGroup?: 'community' | 'governance'
  onProgramClick?: (program: Program) => void
  onViewLevelChange?: (viewLevel: 'departments' | 'programs', department?: string | null) => void
  width?: number
  height?: number
}

// ColorBrewer sequential schemes for better accessibility
const COLOR_SCHEMES = {
  blues: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'],
  greens: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b'],
  oranges: ['#fff5eb', '#fee6ce', '#fdd0a2', '#fdae6b', '#fd8d3c', '#f16913', '#d94801', '#a63603', '#7f2704'],
  purples: ['#fcfbfd', '#efedf5', '#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#54278f', '#3f007d'],
  reds: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#a50f15', '#67000d'],
}

// Helper function to truncate text based on available width
// Uses approximate character width based on font size
function truncateText(text: string, availableWidth: number, fontSize: number): string {
  // Approximate average character width as 0.55 * fontSize for semibold fonts
  const avgCharWidth = fontSize * 0.55
  // Add padding (10px each side) to keep text from touching edges
  const maxChars = Math.floor((availableWidth - 20) / avgCharWidth)
  
  if (maxChars < 3) {
    return '' // Too small to show any meaningful text
  }
  
  if (text.length <= maxChars) {
    return text
  }
  
  // Truncate with ellipsis
  return text.substring(0, maxChars - 1) + '…'
}

export function HierarchicalTreemap({ 
  data, 
  selectedPriority,
  priorityGroup = 'community',
  onProgramClick, 
  onViewLevelChange,
  width = 800, 
  height = 500 
}: HierarchicalTreemapProps) {
  const [viewLevel, setViewLevel] = useState<'departments' | 'programs'>('departments')
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [hoveredItem, setHoveredItem] = useState<any>(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedIds, setHighlightedIds] = useState<Set<number>>(new Set())
  
  // Filter states
  const [showFilters, setShowFilters] = useState(false)
  const [budgetRange, setBudgetRange] = useState<[number, number]>([0, 0])
  const [budgetFilter, setBudgetFilter] = useState<[number, number]>([0, 0])
  const [selectedDepartments, setSelectedDepartments] = useState<Set<string>>(new Set())
  const [selectedQuartiles, setSelectedQuartiles] = useState<Set<string>>(new Set())
  const [colorScheme, setColorScheme] = useState<keyof typeof COLOR_SCHEMES>('blues')

const [isTouchDevice, setIsTouchDevice] = useState(false)

useEffect(() => {
  setIsTouchDevice('ontouchstart' in window)
}, [])

  // **FIX 1: Filter out invalid data that causes NaN errors**
  const validData = useMemo(() => {
    if (!Array.isArray(data)) return []
    
    return data.filter(program => {
      // Must have a valid cost (positive number)
      const cost = Number(program.total_cost)
      if (!cost || isNaN(cost) || cost <= 0) return false
      
      // Must have a name
      if (!program.name || program.name.trim() === '') return false
      
      return true
    })
  }, [data])

  // **FIX 2: Calculate budget range from valid data**
  useEffect(() => {
    if (validData.length > 0) {
      const costs = validData.map(p => p.total_cost).filter(c => c > 0)
      if (costs.length > 0) {
        const min = Math.min(...costs)
        const max = Math.max(...costs)
        setBudgetRange([min, max])
        setBudgetFilter([min, max])
      }
    }
  }, [validData])

  // **FIX 3: Get unique departments and quartiles from valid data**
  const uniqueDepartments = useMemo(() => {
    return Array.from(new Set(validData.map(p => p.department || 'Other'))).sort()
  }, [validData])

  const uniqueQuartiles = useMemo(() => {
    const quartiles = validData.map(p => p.quartile).filter((q): q is string => q !== undefined && q !== null && q !== '')
    return Array.from(new Set(quartiles)).sort()
  }, [validData])

  // **FIX 4: Filter from valid data instead of original data**
  const filteredData = useMemo(() => {
    return validData.filter(program => {
      // Budget filter
      if (program.total_cost < budgetFilter[0] || program.total_cost > budgetFilter[1]) {
        return false
      }
      
      // Department filter
      if (selectedDepartments.size > 0) {
        const dept = program.department || 'Other'
        if (!selectedDepartments.has(dept)) {
          return false
        }
      }
      
      // Quartile filter
      if (selectedQuartiles.size > 0 && program.quartile) {
        if (!selectedQuartiles.has(program.quartile)) {
          return false
        }
      }
      
      return true
    })
  }, [validData, budgetFilter, selectedDepartments, selectedQuartiles])

  useEffect(() => {
    const deptMap = new Map<string, Department>()
    
    filteredData.forEach(program => {
      // Normalize department name for consistency
      const deptName = (program.department || 'Other').trim()
      
      if (!deptMap.has(deptName)) {
        deptMap.set(deptName, {
          name: deptName,
          total_cost: 0,
          programs: [],
          priority_score: 0
        })
      }
      
      const dept = deptMap.get(deptName)!
      dept.programs.push({
        ...program,
        priority_score: getPriorityScore(program, selectedPriority, priorityGroup)
      })
      dept.total_cost += program.total_cost
    })
    
    deptMap.forEach(dept => {
      if (dept.programs.length > 0) {
        dept.priority_score = dept.programs.reduce((sum, p) => sum + (p.priority_score || 0), 0) / dept.programs.length
      }
    })
    
    setDepartments(Array.from(deptMap.values()).sort((a, b) => b.total_cost - a.total_cost))
  }, [filteredData, selectedPriority, priorityGroup])

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setHighlightedIds(new Set())
      return
    }

    const query = searchQuery.toLowerCase()
    const matches = new Set<number>()
    
    filteredData.forEach(program => {
      // Search in program name, service type, and description for comprehensive matching
      if (
        program.name.toLowerCase().includes(query) ||
        program.service_type?.toLowerCase().includes(query) ||
        program.description?.toLowerCase().includes(query)
      ) {
        matches.add(program.id)
      }
    })
    
    setHighlightedIds(matches)
  }, [searchQuery, filteredData])

  const getPriorityScore = (program: Program, priority?: string | null, group?: string): number => {
    if (!priority || !program.priority_scores) return 0.5
    
    const scores = program.priority_scores
    const directKey = priority.toLowerCase().replace(/ /g, '_')
    
    if (scores[directKey as keyof typeof scores] !== undefined) {
      const score = scores[directKey as keyof typeof scores]!
      return Math.min(1, Math.max(0, score / 5))
    }
    
    for (const [key, value] of Object.entries(scores)) {
      if (key.toLowerCase().includes(priority.toLowerCase().replace(/ /g, '_')) ||
          priority.toLowerCase().replace(/ /g, '_').includes(key.toLowerCase())) {
        return Math.min(1, Math.max(0, value / 5))
      }
    }
    
    return 0.5
  }

  // **FIX 5: Improved treemap layout with NaN protection**
  const calculateTreemapLayout = (items: any[], totalValue: number) => {
    if (!items.length || totalValue <= 0) return []
    
    // Filter out any items with invalid values
    const validItems = items.filter(item => {
      const value = Number(item.total_cost)
      return value > 0 && !isNaN(value)
    })
    
    if (validItems.length === 0) return []
    
    return layoutItems(validItems, 0, 0, width, height, totalValue)
  }

  const layoutItems = (items: any[], x: number, y: number, w: number, h: number, total: number): any[] => {
    if (items.length === 0 || w <= 0 || h <= 0 || total <= 0) return []
    
    if (items.length === 1) {
      // Validate dimensions before returning
      if (isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h)) return []
      
      return [{
        ...items[0],
        x: Math.max(0, x), 
        y: Math.max(0, y), 
        width: Math.max(20, w), 
        height: Math.max(20, h)
      }]
    }

    let bestRatio = Infinity
    let bestSplit = 1
    
    for (let i = 1; i < items.length; i++) {
      const leftSum = items.slice(0, i).reduce((sum, item) => sum + item.total_cost, 0)
      const rightSum = items.slice(i).reduce((sum, item) => sum + item.total_cost, 0)
      
      if (leftSum <= 0 || rightSum <= 0) continue
      
      const ratio = Math.max(leftSum / rightSum, rightSum / leftSum)
      
      if (ratio < bestRatio) {
        bestRatio = ratio
        bestSplit = i
      }
    }

    const leftItems = items.slice(0, bestSplit)
    const rightItems = items.slice(bestSplit)
    const leftSum = leftItems.reduce((sum, item) => sum + item.total_cost, 0)
    const rightSum = rightItems.reduce((sum, item) => sum + item.total_cost, 0)
    
    if (leftSum <= 0 || rightSum <= 0) return []
    
    if (w > h) {
      const leftWidth = (leftSum / (leftSum + rightSum)) * w
      
      // Validate calculated width
      if (isNaN(leftWidth) || leftWidth <= 0 || leftWidth > w) return []
      
      return [
        ...layoutItems(leftItems, x, y, leftWidth, h, leftSum),
        ...layoutItems(rightItems, x + leftWidth, y, w - leftWidth, h, rightSum)
      ]
    } else {
      const leftHeight = (leftSum / (leftSum + rightSum)) * h
      
      // Validate calculated height
      if (isNaN(leftHeight) || leftHeight <= 0 || leftHeight > h) return []
      
      return [
        ...layoutItems(leftItems, x, y, w, leftHeight, leftSum),
        ...layoutItems(rightItems, x, y + leftHeight, w, h - leftHeight, rightSum)
      ]
    }
  }

  const getIntensityColor = (score: number): string => {
    const colors = COLOR_SCHEMES[colorScheme]
    const safeScore = isNaN(score) ? 0 : Math.max(0, Math.min(1, score))
    const index = Math.min(Math.floor(safeScore * colors.length), colors.length - 1)
    return colors[index]
  }

  const getDepartmentColor = (deptName: string): string => {
    const colors: Record<string, string> = {
      'Police': '#dc2626',
      'Fire': '#ea580c', 
      'Public Works': '#65a30d',
      'Parks & Recreation': '#16a34a',
      'Finance': '#2563eb',
      'Water': '#0891b2',
      'Planning': '#7c3aed',
      'Library': '#be185d',
      'City Manager': '#374151',
      'Information Technology': '#0284c7',
      'Municipal Court': '#991b1b',
      'Engineering': '#15803d',
      'Other': '#6b7280'
    }
    return colors[deptName] || '#6b7280'
  }

  const formatCurrency = (value: number): string => {
    if (isNaN(value)) return '$0'
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`
    return `$${value.toFixed(0)}`
  }

  const formatPercentage = (value: number, total: number): string => {
    if (isNaN(value) || isNaN(total) || total === 0) return '0.0%'
    return `${((value / total) * 100).toFixed(1)}%`
  }

  const handleItemClick = (item: any) => {
    if (viewLevel === 'departments') {
      setSelectedDepartment(item.name)
      setViewLevel('programs')
      onViewLevelChange?.('programs', item.name)
      // Clear filters when drilling down since we're viewing a specific department
      setSelectedDepartments(new Set())
      setSelectedQuartiles(new Set())
    } else {
      onProgramClick?.(item)
    }
  }

  const handleMouseMove = (e: React.MouseEvent, item: any) => {
    setHoveredItem(item)
    setMousePosition({ x: e.clientX, y: e.clientY })
  }

  const handleTouchStart = (e: React.TouchEvent, item: any) => {
    e.preventDefault()
    const touch = e.touches[0]
    setHoveredItem(item)
    setMousePosition({ x: touch.clientX, y: touch.clientY })
    
    // Auto-hide tooltip after 3 seconds on touch
    setTimeout(() => {
      setHoveredItem(null)
    }, 3000)
  }

  const handleTouchEnd = () => {
    // Keep tooltip visible briefly
    setTimeout(() => {
      setHoveredItem(null)
    }, 300)
  }

  const handleMouseLeave = () => {
    setHoveredItem(null)
  }

  const goBackToDepartments = () => {
    setViewLevel('departments')
    setSelectedDepartment(null)
  }

  const clearSearch = () => {
    setSearchQuery('')
    setHighlightedIds(new Set())
  }

  const clearFilters = () => {
    setBudgetFilter(budgetRange)
    setSelectedDepartments(new Set())
    setSelectedQuartiles(new Set())
  }

  const toggleDepartment = (dept: string) => {
    const newSet = new Set(selectedDepartments)
    if (newSet.has(dept)) {
      newSet.delete(dept)
    } else {
      newSet.add(dept)
    }
    setSelectedDepartments(newSet)
  }

  const toggleQuartile = (quartile: string) => {
    const newSet = new Set(selectedQuartiles)
    if (newSet.has(quartile)) {
      newSet.delete(quartile)
    } else {
      newSet.add(quartile)
    }
    setSelectedQuartiles(newSet)
  }

  const currentData = viewLevel === 'departments' 
    ? departments 
    : (() => {
        // When viewing a specific department's programs, filter by department AND apply other filters
        const selectedDeptNormalized = (selectedDepartment || '').trim().toLowerCase()
        
        const deptPrograms = validData.filter(p => {
          const progDept = (p.department || 'Other').trim().toLowerCase()
          
          // Must match the selected department
          if (progDept !== selectedDeptNormalized) {
            return false
          }
          
          // Apply quartile filter if any quartiles are selected
          if (selectedQuartiles.size > 0 && p.quartile) {
            if (!selectedQuartiles.has(p.quartile)) {
              return false
            }
          }
          
          // Apply budget filter
          if (p.total_cost < budgetFilter[0] || p.total_cost > budgetFilter[1]) {
            return false
          }
          
          return true
        })
        
        return deptPrograms.map(program => ({
          ...program,
          priority_score: getPriorityScore(program, selectedPriority, priorityGroup)
        }))
      })()

  const totalValue = currentData.reduce((sum, item) => sum + item.total_cost, 0)
  const layoutData = calculateTreemapLayout(currentData, totalValue)

  const isHighlighted = (item: any): boolean => {
    if (highlightedIds.size === 0) return false
    if (viewLevel === 'departments') {
      return item.programs?.some((p: Program) => highlightedIds.has(p.id)) || false
    }
    return highlightedIds.has(item.id)
  }

  const hasActiveFilters = selectedDepartments.size > 0 || selectedQuartiles.size > 0 || 
    budgetFilter[0] !== budgetRange[0] || budgetFilter[1] !== budgetRange[1]

  // **FIX 6: Show helpful message when all data is filtered out**
  if (validData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <div className="text-center p-8">
          <p className="text-gray-600 text-lg mb-2">No valid program data available</p>
          <p className="text-gray-500 text-sm">Programs with zero or invalid budgets have been filtered out</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative space-y-4">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
        {/* Breadcrumb */}
        <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600">
          <motion.button 
            onClick={goBackToDepartments}
            className={`hover:text-blue-600 transition-colors ${viewLevel === 'departments' ? 'font-semibold text-gray-900' : ''}`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Departments
          </motion.button>
          <AnimatePresence>
            {viewLevel === 'programs' && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center space-x-2"
              >
                <span>→</span>
                <span className="font-semibold text-gray-900">{selectedDepartment}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Search */}
        <div className="flex-1 sm:max-w-md relative w-full">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search programs..."
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            <AnimatePresence>
              {searchQuery && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
          <AnimatePresence>
            {highlightedIds.size > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="absolute top-full mt-1 text-xs text-gray-600"
              >
                Found {highlightedIds.size} program{highlightedIds.size !== 1 ? 's' : ''}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Filter Toggle Button */}
        <motion.button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg border transition-colors text-sm sm:text-base w-full sm:w-auto ${
            showFilters ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          } ${hasActiveFilters ? 'ring-2 ring-blue-300' : ''}`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="text-sm font-medium">Filters</span>
          {hasActiveFilters && (
            <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
              {(selectedDepartments.size || 0) + (selectedQuartiles.size || 0) + (budgetFilter[0] !== budgetRange[0] || budgetFilter[1] !== budgetRange[1] ? 1 : 0)}
            </span>
          )}
          {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </motion.button>
      </div>

      {/* Filter Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white border rounded-lg p-4 shadow-sm overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              {/* Budget Range */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-gray-700">Budget Range</label>
                  <span className="text-xs text-gray-500">
                    {formatCurrency(budgetFilter[0])} - {formatCurrency(budgetFilter[1])}
                  </span>
                </div>
                <div className="space-y-2">
                  <input
                    type="range"
                    min={budgetRange[0]}
                    max={budgetRange[1]}
                    value={budgetFilter[0]}
                    onChange={(e) => setBudgetFilter([Number(e.target.value), budgetFilter[1]])}
                    className="w-full"
                  />
                  <input
                    type="range"
                    min={budgetRange[0]}
                    max={budgetRange[1]}
                    value={budgetFilter[1]}
                    onChange={(e) => setBudgetFilter([budgetFilter[0], Number(e.target.value)])}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Departments */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Departments</label>
                <div className="max-h-32 overflow-y-auto space-y-1.5 pr-2">
                  {uniqueDepartments.map(dept => (
                    <label key={dept} className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedDepartments.has(dept)}
                        onChange={() => toggleDepartment(dept)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700">{dept}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Quartiles */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Quartiles</label>
                <div className="space-y-1.5">
                  {uniqueQuartiles.map(quartile => (
                    <label key={quartile} className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedQuartiles.has(quartile)}
                        onChange={() => toggleQuartile(quartile)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700">{quartile}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Filter Actions */}
            <div className="mt-4 pt-4 border-t flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Showing <span className="font-semibold text-gray-900">{filteredData.length}</span> of <span className="font-semibold text-gray-900">{validData.length}</span> valid programs
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Treemap Container with Legend */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* SVG Container */}
        <div className="relative bg-white border rounded-lg overflow-hidden w-full">
          <svg width={width} height={height}>
          <AnimatePresence>
            {layoutData.map((item: any, index) => {
              const highlighted = isHighlighted(item)
              const isHovered = hoveredItem?.id === item.id || hoveredItem?.name === item.name
              const itemKey = `${viewLevel}-${item.id || item.name}`
              
              // **FIX 7: Skip rendering if dimensions are invalid**
              if (isNaN(item.x) || isNaN(item.y) || isNaN(item.width) || isNaN(item.height)) {
                return null
              }
              
              if (item.width <= 0 || item.height <= 0) {
                return null
              }
              
              return (
                <motion.g
                  key={itemKey}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.02 }}
                >
                  <motion.rect
                    layoutId={itemKey}
                    initial={{ 
                      x: item.x, 
                      y: item.y, 
                      width: item.width, 
                      height: item.height 
                    }}
                    animate={{
                      x: item.x,
                      y: item.y,
                      width: item.width,
                      height: item.height,
                      fill: selectedPriority ? getIntensityColor(item.priority_score || 0) : getDepartmentColor(viewLevel === 'departments' ? item.name : item.department),
                      opacity: highlightedIds.size > 0 && !highlighted ? 0.3 : 1,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 200,
                      damping: 30,
                      mass: 0.5
                    }}
                    stroke={highlighted ? '#f59e0b' : isHovered ? '#3b82f6' : '#ffffff'}
                    strokeWidth={highlighted ? 4 : isHovered ? 3 : 2}
                    style={{
                      cursor: 'pointer',
                      filter: isHovered ? 'brightness(1.1)' : 'none'
                    }}
                    onClick={() => handleItemClick(item)}
                    onMouseMove={(e: any) => handleMouseMove(e, item)}
                    onMouseLeave={handleMouseLeave}
                    onTouchStart={(e) => handleTouchStart(e, item)}
                    onTouchEnd={handleTouchEnd}
                  />
                  
                  <AnimatePresence>
                    {highlighted && (
                      <motion.rect
                        initial={{ opacity: 0 }}
                        animate={{ 
                          opacity: [0.8, 0.5, 0.8],  // More visible range
                        }}
                        exit={{ opacity: 0 }}
                        transition={{
                          duration: 3,  // Slower: 3 seconds instead of 2
                          repeat: Infinity,
                          ease: "easeInOut",
                          repeatDelay: 10  // Long pause: 10 seconds between pulses
                        }}
                        x={item.x}
                        y={item.y}
                        width={item.width}
                        height={item.height}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth={6}
                        style={{ pointerEvents: 'none' }}
                      />
                    )}
                  </AnimatePresence>
                  
                  {item.width > 60 && item.height > 40 && (
                    <>
                      {/* Text background stroke for better readability */}
                      {(() => {
                        const fontSize = width < 640 
                          ? Math.min(11, Math.max(8, Math.min(item.width / 12, item.height / 5)))
                          : Math.min(14, Math.max(10, Math.min(item.width / 10, item.height / 4)))
                        const displayText = truncateText(item.name, item.width, fontSize)
                        if (!displayText) return null
                        return (
                          <>
                            <text
                              x={item.x + item.width / 2}
                              y={item.y + item.height / 2}
                              textAnchor="middle"
                              className="font-semibold pointer-events-none"
                              style={{ 
                                fontSize,
                                dominantBaseline: 'middle',
                                fill: 'none',
                                stroke: '#000000',
                                strokeWidth: 4,
                                strokeLinejoin: 'round',
                                opacity: 0.3
                              }}
                            >
                              {displayText}
                            </text>
                            {/* Main text */}
                            <text
                              x={item.x + item.width / 2}
                              y={item.y + item.height / 2}
                              textAnchor="middle"
                              className="font-semibold fill-white pointer-events-none"
                              style={{ 
                                fontSize,
                                dominantBaseline: 'middle',
                                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
                              }}
                            >
                              {displayText}
                            </text>
                          </>
                        )
                      })()}
                    </>
                  )}
                  
                  {item.width > 80 && item.height > 60 && (
                    <>
                      {/* Cost text background stroke */}
                      <text
                        x={item.x + item.width / 2}
                        y={item.y + item.height - 12}
                        textAnchor="middle"
                        className="pointer-events-none font-bold"
                        style={{ 
                          fontSize: width < 640 
                            ? Math.min(10, Math.max(7, item.width / 18))
                            : Math.min(12, Math.max(8, item.width / 15)),
                          fill: 'none',
                          stroke: '#000000',
                          strokeWidth: 3,
                          strokeLinejoin: 'round',
                          opacity: 0.3
                        }}
                      >
                        {formatCurrency(item.total_cost)}
                      </text>
                      {/* Main cost text */}
                      <text
                        x={item.x + item.width / 2}
                        y={item.y + item.height - 12}
                        textAnchor="middle"
                        className="fill-white pointer-events-none font-bold"
                        style={{ 
                          fontSize: width < 640 
                            ? Math.min(10, Math.max(7, item.width / 18))
                            : Math.min(12, Math.max(8, item.width / 15)),
                          filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.5))'
                        }}
                      >
                        {formatCurrency(item.total_cost)}
                      </text>
                    </>
                  )}
                  
                  {viewLevel === 'departments' && item.width > 100 && item.height > 80 && (
                    <>
                      {/* Program count background stroke */}
                      <text
                        x={item.x + item.width / 2}
                        y={item.y + item.height - 28}
                        textAnchor="middle"
                        className="pointer-events-none text-xs"
                        style={{ 
                          fontSize: width < 640 
                            ? Math.min(9, Math.max(7, item.width / 24))
                            : Math.min(10, Math.max(8, item.width / 20)),
                          fill: 'none',
                          stroke: '#000000',
                          strokeWidth: 3,
                          strokeLinejoin: 'round',
                          opacity: 0.3
                        }}
                      >
                        {item.programs?.length || 0} programs
                      </text>
                      {/* Main program count text */}
                      <text
                        x={item.x + item.width / 2}
                        y={item.y + item.height - 28}
                        textAnchor="middle"
                        className="fill-white pointer-events-none text-xs"
                        style={{ 
                          fontSize: width < 640 
                            ? Math.min(9, Math.max(7, item.width / 24))
                            : Math.min(10, Math.max(8, item.width / 20)),
                          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))'
                        }}
                      >
                        {item.programs?.length || 0} programs
                      </text>
                    </>
                  )}
                </motion.g>
              )
            })}
          </AnimatePresence>
        </svg>
        
        {/* Tooltip */}
        <AnimatePresence>
          {hoveredItem && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ duration: 0.15 }}
              className="fixed z-50 pointer-events-none max-w-[90vw] sm:max-w-sm"
              style={{
                left: isTouchDevice 
                  ? 'auto'
                  : mousePosition.x + 15,
                right: isTouchDevice ? '16px' : 'auto',
                top: isTouchDevice
                  ? '80px'
                  : mousePosition.y + 15,
              }}
            >
              <div className="bg-white border-2 border-gray-300 rounded-lg shadow-2xl p-4 max-w-sm">
                {viewLevel === 'departments' ? (
                  <>
                    <h3 className="font-bold text-lg text-gray-900 mb-2">{hoveredItem.name}</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Budget:</span>
                        <span className="font-semibold">{formatCurrency(hoveredItem.total_cost)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">% of Total:</span>
                        <span className="font-semibold">{formatPercentage(hoveredItem.total_cost, totalValue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Programs:</span>
                        <span className="font-semibold">{hoveredItem.programs?.length || 0}</span>
                      </div>
                      {selectedPriority && (
                        <div className="pt-2 border-t border-gray-200">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Avg Alignment:</span>
                            <div className="flex items-center space-x-2">
                              <div 
                                className="w-12 h-3 rounded-full"
                                style={{ 
                                  backgroundColor: getIntensityColor(hoveredItem.priority_score || 0)
                                }}
                              />
                              <span className="font-semibold">{Math.round((hoveredItem.priority_score || 0) * 4)}/4</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="font-bold text-base text-gray-900 mb-2 leading-tight">{hoveredItem.name}</h3>
                    {hoveredItem.description && (
                      <p className="text-xs text-gray-600 mb-3 line-clamp-2">{hoveredItem.description}</p>
                    )}
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Budget:</span>
                        <span className="font-semibold">{formatCurrency(hoveredItem.total_cost)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">% of Dept:</span>
                        <span className="font-semibold">
                          {formatPercentage(
                            hoveredItem.total_cost, 
                            departments.find(d => d.name === selectedDepartment)?.total_cost || hoveredItem.total_cost
                          )}
                        </span>
                      </div>
                      {hoveredItem.fte !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">FTE:</span>
                          <span className="font-semibold">{hoveredItem.fte.toFixed(1)}</span>
                        </div>
                      )}
                      {hoveredItem.quartile && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Quartile:</span>
                          <span className="font-semibold">{hoveredItem.quartile}</span>
                        </div>
                      )}
                      {selectedPriority && (
                        <div className="pt-2 border-t border-gray-200">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600 text-xs">{selectedPriority}:</span>
                            <div className="flex items-center space-x-2">
                              <div 
                                className="w-10 h-2.5 rounded-full"
                                style={{ 
                                  backgroundColor: getIntensityColor(hoveredItem.priority_score || 0)
                                }}
                              />
                              <span className="font-semibold">{Math.round((hoveredItem.priority_score || 0) * 4)}/4</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                      Click for full details →
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Enhanced Legend - Now Outside SVG Container */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-white p-3 rounded-lg shadow-lg border border-gray-200 self-start w-full lg:w-auto"
        style={{ minWidth: 'auto' }}
      >
      
        <div className="text-xs space-y-2">
          <div className="font-semibold text-gray-800">
            {viewLevel === 'departments' ? 'Departments' : 'Programs'}
          </div>
          <div className="text-gray-600">Size = Budget</div>
          {selectedPriority ? (
            <>
              <div className="text-gray-600">Color = {selectedPriority} alignment</div>
              {/* Color Gradient Bar */}
              <div className="mt-2 pt-2 border-t border-gray-200">
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>Low</span>
                  <span>High</span>
                </div>
                <div 
                  className="h-4 rounded"
                  style={{
                    background: `linear-gradient(to right, ${COLOR_SCHEMES[colorScheme].join(', ')})`
                  }}
                />
                {/* Color Scheme Selector */}
                <select
                  value={colorScheme}
                  onChange={(e) => setColorScheme(e.target.value as keyof typeof COLOR_SCHEMES)}
                  className="mt-2 w-full text-xs border border-gray-300 rounded px-2 py-1"
                >
                  <option value="blues">Blues</option>
                  <option value="greens">Greens</option>
                  <option value="oranges">Oranges</option>
                  <option value="purples">Purples</option>
                  <option value="reds">Reds</option>
                </select>
              </div>
            </>
          ) : (
            <div className="text-gray-600">Color = Department</div>
          )}
        </div>
      </motion.div>
    </div>
      
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-xs sm:text-sm text-gray-600"
      >
        {viewLevel === 'departments' ? (
          <p>💡 <strong>Tip:</strong> Use filters to narrow down programs, hover for details, click to drill down, or search to highlight.</p>
        ) : (
          <p>💡 <strong>Tip:</strong> Hover for details, click for full program information, or use breadcrumb to return.</p>
        )}
      </motion.div>
    </div>
  )
}