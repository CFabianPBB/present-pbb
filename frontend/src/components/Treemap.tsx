import React, { useState, useEffect } from 'react'

interface Program {
  id: number
  name: string
  total_cost: number
  department: string
  priority_score?: number
}

interface Department {
  name: string
  total_cost: number
  programs: Program[]
  priority_score: number
}

interface HierarchicalTreemapProps {
  data: Program[]
  selectedPriority?: string
  onProgramClick?: (program: Program) => void
  width?: number
  height?: number
}

export function HierarchicalTreemap({ 
  data, 
  selectedPriority, 
  onProgramClick, 
  width = 800, 
  height = 500 
}: HierarchicalTreemapProps) {
  const [viewLevel, setViewLevel] = useState<'departments' | 'programs'>('departments')
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])

  useEffect(() => {
    // Group programs by department
    const deptMap = new Map<string, Department>()
    
    data.forEach(program => {
      const deptName = program.department || 'Other'
      
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
        priority_score: getPriorityScore(program, selectedPriority)
      })
      dept.total_cost += program.total_cost
    })
    
    // Calculate department priority scores (average of programs)
    deptMap.forEach(dept => {
      if (dept.programs.length > 0) {
        dept.priority_score = dept.programs.reduce((sum, p) => sum + (p.priority_score || 0), 0) / dept.programs.length
      }
    })
    
    setDepartments(Array.from(deptMap.values()).sort((a, b) => b.total_cost - a.total_cost))
  }, [data, selectedPriority])

  const getPriorityScore = (program: Program, priority?: string): number => {
    if (!priority) return 0.5
    
    // This would ideally come from your priority scores data
    // For now, using program characteristics as a proxy
    const programName = program.name.toLowerCase()
    
    switch (priority) {
      case 'Community Safety':
        return programName.includes('police') || programName.includes('fire') || programName.includes('safety') ? 0.9 : 0.3
      case 'Infrastructure & Asset Management':
        return programName.includes('infrastructure') || programName.includes('maintenance') || programName.includes('water') ? 0.9 : 0.4
      case 'Community Development':
        return programName.includes('development') || programName.includes('planning') || programName.includes('housing') ? 0.9 : 0.4
      default:
        return 0.5
    }
  }

  const calculateTreemapLayout = (items: any[], totalValue: number) => {
    if (!items.length) return []
    
    // Use simple recursive subdivision
    return layoutItems(items, 0, 0, width, height, totalValue)
  }

  const layoutItems = (items: any[], x: number, y: number, w: number, h: number, total: number): any[] => {
    if (items.length === 0) return []
    if (items.length === 1) {
      return [{
        ...items[0],
        x, y, width: w, height: h
      }]
    }

    // Find best split point
    let bestRatio = Infinity
    let bestSplit = 1
    
    for (let i = 1; i < items.length; i++) {
      const leftSum = items.slice(0, i).reduce((sum, item) => sum + item.total_cost, 0)
      const rightSum = items.slice(i).reduce((sum, item) => sum + item.total_cost, 0)
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
    
    // Split vertically if wider, horizontally if taller
    if (w > h) {
      const leftWidth = (leftSum / (leftSum + rightSum)) * w
      return [
        ...layoutItems(leftItems, x, y, leftWidth, h, leftSum),
        ...layoutItems(rightItems, x + leftWidth, y, w - leftWidth, h, rightSum)
      ]
    } else {
      const leftHeight = (leftSum / (leftSum + rightSum)) * h
      return [
        ...layoutItems(leftItems, x, y, w, leftHeight, leftSum),
        ...layoutItems(rightItems, x, y + leftHeight, w, h - leftHeight, rightSum)
      ]
    }
  }

  const getIntensityColor = (score: number): string => {
    // Convert 0-1 score to color intensity
    if (score >= 0.8) return '#1e40af'      // Dark blue - high alignment
    if (score >= 0.6) return '#3b82f6'      // Medium blue
    if (score >= 0.4) return '#60a5fa'      // Light blue
    if (score >= 0.2) return '#93c5fd'      // Very light blue
    return '#e5e7eb'                        // Light gray - low alignment
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
      'Other': '#6b7280'
    }
    return colors[deptName] || '#6b7280'
  }

  const formatCurrency = (value: number): string => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`
    return `$${value.toFixed(0)}`
  }

  const handleItemClick = (item: any) => {
    if (viewLevel === 'departments') {
      setSelectedDepartment(item.name)
      setViewLevel('programs')
    } else {
      onProgramClick?.(item)
    }
  }

  const goBackToDepartments = () => {
    setViewLevel('departments')
    setSelectedDepartment(null)
  }

  // Prepare data for current view level
  const currentData = viewLevel === 'departments' 
    ? departments 
    : departments.find(d => d.name === selectedDepartment)?.programs || []

  const totalValue = currentData.reduce((sum, item) => sum + item.total_cost, 0)
  const layoutData = calculateTreemapLayout(currentData, totalValue)

  return (
    <div className="relative">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center space-x-2 text-sm text-gray-600">
        <button 
          onClick={goBackToDepartments}
          className={`hover:text-blue-600 ${viewLevel === 'departments' ? 'font-semibold text-gray-900' : ''}`}
        >
          Departments
        </button>
        {viewLevel === 'programs' && (
          <>
            <span>→</span>
            <span className="font-semibold text-gray-900">{selectedDepartment}</span>
          </>
        )}
      </div>

      {/* Treemap */}
      <div className="relative bg-white border rounded-lg overflow-hidden">
        <svg width={width} height={height}>
          {layoutData.map((item: any, index) => (
            <g key={`${viewLevel}-${item.id || item.name}-${index}`}>
              {/* Rectangle */}
              <rect
                x={item.x}
                y={item.y}
                width={item.width}
                height={item.height}
                fill={selectedPriority ? getIntensityColor(item.priority_score || 0) : getDepartmentColor(viewLevel === 'departments' ? item.name : item.department)}
                stroke="#ffffff"
                strokeWidth={2}
                className="cursor-pointer transition-all duration-200 hover:stroke-4 hover:stroke-blue-500"
                onClick={() => handleItemClick(item)}
              />
              
              {/* Label */}
              {item.width > 60 && item.height > 40 && (
                <text
                  x={item.x + item.width / 2}
                  y={item.y + item.height / 2}
                  textAnchor="middle"
                  className="font-semibold fill-white pointer-events-none drop-shadow-sm"
                  style={{ 
                    fontSize: Math.min(14, Math.max(10, Math.min(item.width / 10, item.height / 4))),
                    dominantBaseline: 'middle'
                  }}
                >
                  {viewLevel === 'departments' ? item.name : item.name.length > Math.floor(item.width / 8) 
                    ? item.name.substring(0, Math.floor(item.width / 8) - 3) + '...' 
                    : item.name}
                </text>
              )}
              
              {/* Budget */}
              {item.width > 80 && item.height > 60 && (
                <text
                  x={item.x + item.width / 2}
                  y={item.y + item.height - 12}
                  textAnchor="middle"
                  className="fill-white pointer-events-none opacity-90 font-bold"
                  style={{ 
                    fontSize: Math.min(12, Math.max(8, item.width / 15))
                  }}
                >
                  {formatCurrency(item.total_cost)}
                </text>
              )}
              
              {/* Program count for departments */}
              {viewLevel === 'departments' && item.width > 100 && item.height > 80 && (
                <text
                  x={item.x + item.width / 2}
                  y={item.y + item.height - 28}
                  textAnchor="middle"
                  className="fill-white pointer-events-none opacity-75 text-xs"
                  style={{ 
                    fontSize: Math.min(10, Math.max(8, item.width / 20))
                  }}
                >
                  {item.programs?.length || 0} programs
                </text>
              )}
            </g>
          ))}
        </svg>
        
        {/* Legend */}
        <div className="absolute bottom-4 right-4 bg-white bg-opacity-95 p-3 rounded-lg shadow-lg border">
          <div className="text-xs space-y-1">
            <div className="font-semibold text-gray-800">
              {viewLevel === 'departments' ? 'Departments' : 'Programs'}
            </div>
            <div className="text-gray-600">Size = Budget</div>
            {selectedPriority ? (
              <div className="text-gray-600">Color = {selectedPriority} alignment</div>
            ) : (
              <div className="text-gray-600">Color = Department</div>
            )}
            <div className="flex items-center space-x-2 mt-2">
              <div className="w-3 h-3 bg-gray-300 rounded"></div>
              <span className="text-gray-600">Low</span>
              <div className="w-3 h-3 bg-blue-600 rounded"></div>
              <span className="text-gray-600">High</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Instructions */}
      <div className="mt-4 text-sm text-gray-600">
        {viewLevel === 'departments' ? (
          <p>Click on any department to drill down and see individual programs within that department.</p>
        ) : (
          <p>Click on any program for detailed information. Use the breadcrumb above to return to departments.</p>
        )}
      </div>
    </div>
  )
}