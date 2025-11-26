import { useState, useEffect, useRef } from 'react'
import { HierarchicalTreemap } from './HierarchicalTreemap'

interface Program {
  id: number
  name: string
  total_cost: number
  department: string
  user_group?: string
  quartile?: string
  fte?: number
  service_type?: string
  description?: string
  priority_score?: number
  priority_scores?: {
    [key: string]: number
  }
}

interface ResponsiveTreemapWrapperProps {
  data: Program[]
  selectedPriority?: string | null
  priorityGroup?: 'community' | 'governance'
  onProgramClick?: (program: Program) => void
  onViewLevelChange?: (viewLevel: 'departments' | 'programs', department?: string | null) => void
  datasetId?: string | null  // Required for semantic search
}

export function ResponsiveTreemapWrapper({ 
  data, 
  selectedPriority,
  priorityGroup,
  onProgramClick,
  onViewLevelChange,
  datasetId
}: ResponsiveTreemapWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 })

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth
        
        // Calculate responsive dimensions
        // Desktop: use larger dimensions
        // Tablet: medium dimensions
        // Mobile: smaller, more square aspect ratio
        let width, height
        
        if (containerWidth >= 1024) {
          // Desktop - use container width, standard aspect ratio
          width = Math.min(containerWidth - 240, 1200) // Leave room for legend
          height = 500
        } else if (containerWidth >= 768) {
          // Tablet - slightly smaller
          width = containerWidth - 200 // Leave room for legend
          height = 450
        } else {
          // Mobile - full width, more square
          width = containerWidth - 16 // Small padding
          height = Math.min(containerWidth * 0.75, 400) // More square on mobile
        }
        
        setDimensions({ width, height })
      }
    }

    // Initial size
    updateDimensions()

    // Update on resize
    window.addEventListener('resize', updateDimensions)
    
    // Cleanup
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  return (
    <div ref={containerRef} className="w-full">
      <HierarchicalTreemap
        data={data}
        selectedPriority={selectedPriority}
        priorityGroup={priorityGroup}
        onProgramClick={onProgramClick}
        onViewLevelChange={onViewLevelChange}
        width={dimensions.width}
        height={dimensions.height}
        datasetId={datasetId}
      />
    </div>
  )
}