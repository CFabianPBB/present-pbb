import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, ArrowRightLeft, X, ChevronDown, ChevronUp, Loader2, Sparkles } from 'lucide-react'
import * as d3 from 'd3'
import { sankey, sankeyLinkHorizontal } from 'd3-sankey'
import { API_BASE_URL } from '../config/api'

interface SankeyNode {
  id: string
  name: string
  fullName: string
  type: 'category' | 'program' | 'priority'
  value: number
  percentage: number
  userGroup?: string
  x0?: number
  x1?: number
  y0?: number
  y1?: number
}

interface SankeyLink {
  source: number
  target: number
  value: number
  sourceName: string
  targetName: string
  percentage: number
}

interface SankeyData {
  nodes: SankeyNode[]
  links: SankeyLink[]
  total_flow: number
  direction: string
  filter_options: {
    funds: string[]
    departments: string[]
    cost_types: string[]
  }
}

interface SearchResult {
  categories: Array<{ name: string; totalCost: number; itemCount: number }>
  programs: Array<{ id: number; name: string; userGroup: string; totalCost: number }>
}

interface CostFlowSankeyProps {
  datasetId: string
  className?: string
}

export function CostFlowSankey({ datasetId, className = '' }: CostFlowSankeyProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // State
  const [data, setData] = useState<SankeyData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Filters - now arrays for multi-select
  const [direction, setDirection] = useState<'category_to_program' | 'program_to_category'>('category_to_program')
  const [showPriorities, setShowPriorities] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSearchItems, setSelectedSearchItems] = useState<string[]>([])
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([])
  const [selectedFunds, setSelectedFunds] = useState<string[]>([])
  const [selectedCostTypes, setSelectedCostTypes] = useState<string[]>([])
  
  // Filter panel visibility
  const [showFilters, setShowFilters] = useState(true)
  
  // Search typeahead
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null)
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
  const [searchType, setSearchType] = useState<'semantic' | 'keyword' | null>(null)
  
  // Expanded filter sections
  const [expandedFilters, setExpandedFilters] = useState<{
    departments: boolean
    funds: boolean
  }>({ departments: false, funds: false })
  
  // Tooltip
  const [tooltip, setTooltip] = useState<{
    visible: boolean
    x: number
    y: number
    content: React.ReactNode
  }>({ visible: false, x: 0, y: 0, content: null })
  
  // Dimensions
  const [dimensions, setDimensions] = useState({ width: 900, height: 500 })
  
  // Available filter options (populated from API)
  const [filterOptions, setFilterOptions] = useState<{
    funds: string[]
    departments: string[]
    cost_types: string[]
  }>({ funds: [], departments: [], cost_types: ['Personnel', 'NonPersonnel'] })

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`
    }
    return `$${value.toFixed(0)}`
  }

  // Responsive dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth
        const isMobile = width < 640
        const isTablet = width < 1024
        
        setDimensions({
          width: Math.max(320, width - (isMobile ? 16 : 32)),
          height: isMobile ? 350 : isTablet ? 450 : Math.min(600, Math.max(400, width * 0.5))
        })
      }
    }
    
    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // Fetch sankey data
  const fetchSankeyData = useCallback(async () => {
    if (!datasetId) return
    
    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams({
        dataset_id: datasetId,
        direction,
        limit_nodes: '20',
        min_flow_pct: '0.3',
        include_priorities: showPriorities ? 'true' : 'false'
      })
      
      if (selectedSearchItems.length > 0) {
        params.append('search_items', selectedSearchItems.join('|||'))
      }
      
      // Send multiple values as comma-separated
      if (selectedDepartments.length > 0) {
        params.append('departments', selectedDepartments.join(','))
      }
      if (selectedFunds.length > 0) {
        params.append('funds', selectedFunds.join(','))
      }
      if (selectedCostTypes.length > 0) {
        params.append('cost_types', selectedCostTypes.join(','))
      }
      
      const response = await fetch(`${API_BASE_URL}/api/sankey-flow?${params}`)
      
      if (response.status === 404) {
        setError('Backend API not updated yet. Please replace programs.py and restart the backend.')
        return
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch flow data: ${response.status}`)
      }
      
      const result = await response.json()
      setData(result)
      
      // Update filter options from API response
      if (result.filter_options) {
        setFilterOptions(result.filter_options)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [datasetId, direction, showPriorities, selectedSearchItems, selectedDepartments, selectedFunds, selectedCostTypes])

  useEffect(() => {
    fetchSankeyData()
  }, [fetchSankeyData])

  // Search typeahead with semantic search for programs
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults(null)
      setShowSearchDropdown(false)
      setSearchType(null)
      return
    }
    
    const timer = setTimeout(async () => {
      setSearchLoading(true)
      try {
        // For programs, try semantic search first
        if (direction === 'program_to_category') {
          try {
            const semanticResponse = await fetch(
              `${API_BASE_URL}/api/semantic-search?dataset_id=${datasetId}&q=${encodeURIComponent(searchQuery)}&limit=15`
            )
            if (semanticResponse.ok) {
              const semanticData = await semanticResponse.json()
              if (semanticData.searchType === 'semantic' && semanticData.programs.length > 0) {
                // Convert semantic results to SearchResult format
                setSearchResults({
                  categories: [],
                  programs: semanticData.programs.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    userGroup: p.userGroup || '',
                    totalCost: p.totalCost
                  }))
                })
                setSearchType('semantic')
                setShowSearchDropdown(true)
                setSearchLoading(false)
                return
              }
            }
          } catch (err) {
            console.log('Semantic search unavailable, falling back to keyword search')
          }
        }
        
        // Fall back to sankey-search (keyword expansion)
        const searchTypeParam = direction === 'category_to_program' ? 'categories' : 'programs'
        const response = await fetch(
          `${API_BASE_URL}/api/sankey-search?dataset_id=${datasetId}&q=${encodeURIComponent(searchQuery)}&search_type=${searchTypeParam}&limit=10`
        )
        if (response.ok) {
          const results = await response.json()
          setSearchResults(results)
          setSearchType('keyword')
          setShowSearchDropdown(true)
        }
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    
    return () => clearTimeout(timer)
  }, [searchQuery, datasetId, direction])

  // Render Sankey diagram
  useEffect(() => {
    if (!data || !svgRef.current || data.nodes.length === 0 || data.links.length === 0) return
    
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    
    // Responsive margins - increased top margin for header labels
    const isMobile = dimensions.width < 500
    const isTablet = dimensions.width < 800
    const margin = { 
      top: isMobile ? 25 : 35,  // More space for CATEGORIES/PROGRAMS headers
      right: isMobile ? 80 : isTablet ? 120 : 150, 
      bottom: 10, 
      left: isMobile ? 80 : isTablet ? 120 : 150 
    }
    const width = dimensions.width - margin.left - margin.right
    const height = dimensions.height - margin.top - margin.bottom
    
    const g = svg
      .attr('width', dimensions.width)
      .attr('height', dimensions.height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)
    
    // Create sankey generator - use array index for node references
    const sankeyGenerator = sankey()
      .nodeWidth(isMobile ? 12 : 16)
      .nodePadding(isMobile ? 8 : 12)
      .extent([[0, 0], [width, height]])
      .nodeSort(null)
    
    // Prepare data for d3-sankey - validate links reference valid node indices
    const nodeCount = data.nodes.length
    const validLinks = data.links.filter(l => 
      l.source >= 0 && l.source < nodeCount && 
      l.target >= 0 && l.target < nodeCount &&
      l.source !== l.target
    )
    
    if (validLinks.length === 0) {
      console.warn('No valid links for Sankey diagram')
      return
    }
    
    const sankeyData = {
      nodes: data.nodes.map(n => ({ ...n, originalValue: n.value })),  // Preserve original value
      links: validLinks.map(l => ({ ...l }))
    }
    
    // Generate layout with error handling
    let nodes, links
    try {
      const result = sankeyGenerator(sankeyData as any)
      nodes = result.nodes
      links = result.links
    } catch (err) {
      console.error('Sankey layout error:', err)
      return
    }
    
    // Color scales - use original data.nodes for type info since sankey mutates nodes
    const categoryColors = d3.scaleOrdinal<string>()
      .domain(data.nodes.filter(n => n.type === 'category').map(n => n.id))
      .range([
        '#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#14B8A6',
        '#6366F1', '#F43F5E', '#22C55E', '#EAB308', '#06B6D4',
        '#A855F7', '#EF4444', '#10B981', '#F59E0B', '#0EA5E9',
        '#D946EF', '#84CC16', '#FB923C', '#2DD4BF', '#818CF8'
      ])
    
    const programColors = d3.scaleOrdinal<string>()
      .domain(data.nodes.filter(n => n.type === 'program').map(n => n.id))
      .range([
        '#1E40AF', '#5B21B6', '#BE185D', '#C2410C', '#0F766E',
        '#4338CA', '#BE123C', '#15803D', '#A16207', '#0891B2',
        '#7E22CE', '#B91C1C', '#047857', '#B45309', '#0284C7',
        '#A21CAF', '#4D7C0F', '#EA580C', '#0D9488', '#4F46E5'
      ])
    
    const priorityColors = d3.scaleOrdinal<string>()
      .domain(data.nodes.filter(n => n.type === 'priority').map(n => n.id))
      .range([
        '#059669', '#0D9488', '#0891B2', '#0284C7', '#2563EB',
        '#4F46E5', '#7C3AED', '#9333EA', '#C026D3', '#DB2777',
        '#E11D48', '#F43F5E', '#F97316', '#EAB308', '#84CC16'
      ])
    
    // Helper to get node color
    const getNodeColor = (node: any) => {
      if (node.type === 'category') return categoryColors(node.id)
      if (node.type === 'priority') return priorityColors(node.id)
      return programColors(node.id)
    }
    
    // Filter out zero-value links
    const visibleLinks = links.filter((l: any) => l.value > 0)
    
    // Draw links
    const linkGroup = g.append('g')
      .attr('class', 'links')
      .attr('fill', 'none')
    
    const linkPaths = linkGroup.selectAll('path')
      .data(visibleLinks)
      .join('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke', (d: any) => {
        const sourceNode = d.source as SankeyNode
        return getNodeColor(sourceNode)
      })
      .attr('stroke-width', (d: any) => Math.max(1, d.width))
      .attr('stroke-opacity', 0.4)
      .style('cursor', 'pointer')
      .on('mouseenter', function(event: MouseEvent, d: any) {
        d3.select(this).attr('stroke-opacity', 0.7)
        
        const sourceNode = d.source as SankeyNode
        const targetNode = d.target as SankeyNode
        
        setTooltip({
          visible: true,
          x: event.pageX,
          y: event.pageY,
          content: (
            <div className="text-sm">
              <div className="font-semibold text-gray-900 mb-1">
                {sourceNode.fullName || sourceNode.name}
              </div>
              <div className="text-gray-500 mb-2">↓</div>
              <div className="font-semibold text-gray-900 mb-2">
                {targetNode.fullName || targetNode.name}
              </div>
              <div className="text-blue-600 font-bold">
                {formatCurrency(d.value)}
              </div>
              <div className="text-gray-500 text-xs">
                {d.percentage.toFixed(1)}% of total flow
              </div>
            </div>
          )
        })
      })
      .on('mousemove', (event: MouseEvent) => {
        setTooltip(prev => ({ ...prev, x: event.pageX, y: event.pageY }))
      })
      .on('mouseleave', function() {
        d3.select(this).attr('stroke-opacity', 0.4)
        setTooltip(prev => ({ ...prev, visible: false }))
      })
    
    // Draw nodes
    const nodeGroup = g.append('g')
      .attr('class', 'nodes')
    
    nodeGroup.selectAll('rect')
    // Filter out nodes with zero computed value for rendering
    const visibleNodes = nodes.filter((n: any) => n.value > 0)
    
    nodeGroup.selectAll('rect')
      .data(visibleNodes)
      .join('rect')
      .attr('x', (d: any) => d.x0)
      .attr('y', (d: any) => d.y0)
      .attr('width', (d: any) => d.x1 - d.x0)
      .attr('height', (d: any) => Math.max(2, d.y1 - d.y0))
      .attr('fill', (d: any) => getNodeColor(d))
      .attr('rx', 2)
      .style('cursor', 'pointer')
      .on('mouseenter', function(event: MouseEvent, d: any) {
        d3.select(this).attr('opacity', 0.8)
        
        // Highlight connected links
        linkPaths.attr('stroke-opacity', (l: any) => {
          const source = l.source as SankeyNode
          const target = l.target as SankeyNode
          return source.id === d.id || target.id === d.id ? 0.7 : 0.15
        })
        
        const typeLabel = d.type === 'category' ? 'Cost Category' 
          : d.type === 'priority' ? 'Priority Result'
          : 'Program'
        const typeColor = d.type === 'category' ? 'text-purple-600' 
          : d.type === 'priority' ? 'text-emerald-600'
          : 'text-blue-600'
        
        setTooltip({
          visible: true,
          x: event.clientX,
          y: event.clientY,
          content: (
            <div className="text-sm max-w-xs">
              <div className="font-semibold text-gray-900 mb-1 break-words">
                {d.fullName || d.name}
              </div>
              <div className={`text-xs uppercase tracking-wide mb-2 ${typeColor}`}>
                {typeLabel}
              </div>
              <div className="text-blue-600 font-bold text-lg">
                {formatCurrency(d.originalValue || d.value)}
              </div>
              <div className="text-gray-500 text-xs">
                {d.percentage?.toFixed(1) || '0'}% of total
              </div>
            </div>
          )
        })
      })
      .on('mousemove', (event: MouseEvent) => {
        setTooltip(prev => ({ ...prev, x: event.clientX, y: event.clientY }))
      })
      .on('mouseleave', function() {
        d3.select(this).attr('opacity', 1)
        linkPaths.attr('stroke-opacity', 0.4)
        setTooltip(prev => ({ ...prev, visible: false }))
      })
      .on('click', (_event: MouseEvent, d: any) => {
        // Only allow clicking on categories/programs, not priorities
        if (d.type !== 'priority') {
          const term = d.fullName || d.name
          if (!selectedSearchItems.includes(term)) {
            setSelectedSearchItems(prev => [...prev, term])
          }
        }
        setShowSearchDropdown(false)
      })
    
    // Add tooltips for links too
    linkPaths
      .on('mouseenter', function(event: MouseEvent, d: any) {
        d3.select(this).attr('stroke-opacity', 0.8)
        
        const source = d.source as SankeyNode
        const target = d.target as SankeyNode
        
        setTooltip({
          visible: true,
          x: event.clientX,
          y: event.clientY,
          content: (
            <div className="text-sm max-w-xs">
              <div className="font-medium text-gray-900 mb-2">
                <span className="text-purple-600">{source.fullName || source.name}</span>
                <span className="text-gray-400 mx-2">→</span>
                <span className="text-blue-600">{target.fullName || target.name}</span>
              </div>
              <div className="text-blue-600 font-bold text-lg">
                {formatCurrency(d.value)}
              </div>
              <div className="text-gray-500 text-xs">
                {d.percentage?.toFixed(1) || '0'}% of total flow
              </div>
            </div>
          )
        })
      })
      .on('mousemove', (event: MouseEvent) => {
        setTooltip(prev => ({ ...prev, x: event.clientX, y: event.clientY }))
      })
      .on('mouseleave', function() {
        d3.select(this).attr('stroke-opacity', 0.4)
        setTooltip(prev => ({ ...prev, visible: false }))
      })
    
    // Add node labels with better truncation
    // Determine label position based on node type and whether priorities are shown
    const hasPriorities = data.nodes.some(n => n.type === 'priority')
    
    nodeGroup.selectAll('text')
      .data(visibleNodes)
      .join('text')
      .attr('x', (d: any) => {
        if (d.type === 'category') return d.x0 - 4
        if (d.type === 'priority') return d.x1 + 4
        // Programs: if priorities shown, labels go left, else right
        return hasPriorities ? d.x0 - 4 : d.x1 + 4
      })
      .attr('y', (d: any) => (d.y0 + d.y1) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', (d: any) => {
        if (d.type === 'category') return 'end'
        if (d.type === 'priority') return 'start'
        return hasPriorities ? 'end' : 'start'
      })
      .attr('font-size', isMobile ? '8px' : isTablet ? '9px' : '10px')
      .attr('fill', '#374151')
      .text((d: any) => {
        // Responsive truncation
        const maxLen = isMobile ? 10 : isTablet ? 14 : hasPriorities ? 18 : 22
        const name = d.name || ''
        return name.length > maxLen ? name.substring(0, maxLen) + '…' : name
      })
      .style('pointer-events', 'none')
      .style('cursor', 'default')
    
  }, [data, dimensions, selectedSearchItems])

  const handleSearchSelect = (term: string, event?: React.MouseEvent) => {
    // Check if shift is held for range select
    if (event?.shiftKey && lastSelectedIndex !== null && searchResults) {
      const items = direction === 'category_to_program' 
        ? searchResults.categories.map(c => c.name)
        : searchResults.programs.map(p => p.name)
      
      const currentIndex = items.indexOf(term)
      if (currentIndex !== -1) {
        const start = Math.min(lastSelectedIndex, currentIndex)
        const end = Math.max(lastSelectedIndex, currentIndex)
        const rangeItems = items.slice(start, end + 1)
        
        setSelectedSearchItems(prev => {
          const newItems = [...prev]
          rangeItems.forEach(item => {
            if (!newItems.includes(item)) {
              newItems.push(item)
            }
          })
          return newItems
        })
        return
      }
    }
    
    // Track last selected for shift-click range
    if (searchResults) {
      const items = direction === 'category_to_program' 
        ? searchResults.categories.map(c => c.name)
        : searchResults.programs.map(p => p.name)
      setLastSelectedIndex(items.indexOf(term))
    }
    
    if (!selectedSearchItems.includes(term)) {
      setSelectedSearchItems(prev => [...prev, term])
    } else {
      // If already selected, deselect it
      setSelectedSearchItems(prev => prev.filter(item => item !== term))
    }
  }

  const selectAllSearchResults = () => {
    if (!searchResults) return
    const items = direction === 'category_to_program' 
      ? searchResults.categories.map(c => c.name)
      : searchResults.programs.map(p => p.name)
    
    setSelectedSearchItems(prev => {
      const newItems = [...prev]
      items.forEach(item => {
        if (!newItems.includes(item)) {
          newItems.push(item)
        }
      })
      return newItems
    })
    setShowSearchDropdown(false)
    setSearchQuery('')
  }

  const removeSearchItem = (term: string) => {
    setSelectedSearchItems(prev => prev.filter(item => item !== term))
  }

  const clearSearch = () => {
    setSearchQuery('')
    setSelectedSearchItems([])
    setSearchResults(null)
  }

  const toggleDirection = () => {
    setDirection(prev => 
      prev === 'category_to_program' ? 'program_to_category' : 'category_to_program'
    )
    clearSearch()
  }

  // Multi-select toggle helpers
  const toggleDepartment = (dept: string) => {
    setSelectedDepartments(prev => 
      prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]
    )
  }

  const toggleFund = (fund: string) => {
    setSelectedFunds(prev => 
      prev.includes(fund) ? prev.filter(f => f !== fund) : [...prev, fund]
    )
  }

  const toggleCostType = (costType: string) => {
    setSelectedCostTypes(prev => 
      prev.includes(costType) ? prev.filter(c => c !== costType) : [...prev, costType]
    )
  }

  const clearAllFilters = () => {
    setSelectedDepartments([])
    setSelectedFunds([])
    setSelectedCostTypes([])
    setSelectedSearchItems([])
    setSearchQuery('')
  }

  const activeFilterCount = selectedDepartments.length + selectedFunds.length + selectedCostTypes.length + selectedSearchItems.length

  if (!datasetId) {
    return (
      <div className="text-center text-gray-500 py-8">
        Please select a dataset to view cost flows
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Cost Flow Analysis</h3>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              {direction === 'category_to_program' 
                ? showPriorities 
                  ? 'Categories → Programs → Priorities'
                  : 'Categories → Programs'
                : showPriorities
                  ? 'Programs → Categories (with Priorities)'
                  : 'Programs → Categories'
              }
            </p>
          </div>
          
          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Priority Toggle */}
            <button
              onClick={() => setShowPriorities(!showPriorities)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm font-medium ${
                showPriorities 
                  ? 'bg-purple-100 text-purple-700 border border-purple-300' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={showPriorities ? 'Hide priorities layer' : 'Show priorities layer'}
            >
              <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="hidden xs:inline">Priorities</span>
            </button>
            
            {/* Direction Toggle */}
            <button
              onClick={toggleDirection}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-xs sm:text-sm font-medium text-gray-700"
            >
              <ArrowRightLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Flip</span>
            </button>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="mb-3">
          {/* Selected Search Items as Chips */}
          {selectedSearchItems.length > 0 && (
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2">
              {selectedSearchItems.map((item, i) => (
                <span 
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 sm:py-1 bg-purple-100 text-purple-700 rounded-full text-xs"
                >
                  {item.length > 20 ? item.substring(0, 20) + '...' : item}
                  <button onClick={() => removeSearchItem(item)} className="hover:text-purple-900">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchResults && setShowSearchDropdown(true)}
              placeholder={direction === 'category_to_program' 
                ? 'Search categories...'
                : 'Search programs...'
              }
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {searchLoading && (
              <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
            )}
          
          {/* Search Dropdown */}
          {showSearchDropdown && searchResults && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-auto">
              {direction === 'category_to_program' && searchResults.categories.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 flex justify-between items-center sticky top-0">
                    <span>Categories ({searchResults.categories.length})</span>
                    <button
                      onClick={selectAllSearchResults}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Select All
                    </button>
                  </div>
                  <div className="text-[10px] text-gray-400 px-3 py-1 bg-gray-50 border-b">
                    💡 Shift+click to select range
                  </div>
                  {searchResults.categories.map((cat, i) => {
                    const isSelected = selectedSearchItems.includes(cat.name)
                    return (
                      <button
                        key={i}
                        onClick={(e) => handleSearchSelect(cat.name, e)}
                        className={`w-full px-3 py-2 text-left flex justify-between items-center transition-colors ${
                          isSelected ? 'bg-purple-50' : 'hover:bg-blue-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                            isSelected ? 'bg-purple-500 border-purple-500' : 'border-gray-300'
                          }`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm text-gray-900 truncate">{cat.name}</span>
                        </div>
                        <span className="text-xs text-gray-500 ml-2">{formatCurrency(cat.totalCost)}</span>
                      </button>
                    )
                  })}
                </div>
              )}
              {direction === 'program_to_category' && searchResults.programs.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 flex justify-between items-center sticky top-0">
                    <span className="flex items-center gap-1.5">
                      Programs ({searchResults.programs.length})
                      {searchType === 'semantic' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-full text-[10px] font-medium">
                          <Sparkles className="h-2.5 w-2.5" />
                          AI
                        </span>
                      )}
                    </span>
                    <button
                      onClick={selectAllSearchResults}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Select All
                    </button>
                  </div>
                  <div className="text-[10px] text-gray-400 px-3 py-1 bg-gray-50 border-b">
                    💡 Shift+click to select range
                  </div>
                  {searchResults.programs.map((prog, i) => {
                    const isSelected = selectedSearchItems.includes(prog.name)
                    return (
                      <button
                        key={i}
                        onClick={(e) => handleSearchSelect(prog.name, e)}
                        className={`w-full px-3 py-2 text-left flex justify-between items-center transition-colors ${
                          isSelected ? 'bg-purple-50' : 'hover:bg-blue-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                            isSelected ? 'bg-purple-500 border-purple-500' : 'border-gray-300'
                          }`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div className="truncate">
                            <span className="text-sm text-gray-900">{prog.name}</span>
                            <span className="text-xs text-gray-500 ml-2">{prog.userGroup}</span>
                          </div>
                        </div>
                        <span className="text-xs text-gray-500 ml-2">{formatCurrency(prog.totalCost)}</span>
                      </button>
                    )
                  })}
                </div>
              )}
              {((direction === 'category_to_program' && searchResults.categories.length === 0) ||
                (direction === 'program_to_category' && searchResults.programs.length === 0)) && (
                <div className="px-3 py-4 text-sm text-gray-500 text-center">
                  No results found
                </div>
              )}
              {/* Done button when items are selected */}
              {selectedSearchItems.length > 0 && (
                <div className="sticky bottom-0 px-3 py-2 bg-gray-50 border-t">
                  <button
                    onClick={() => {
                      setShowSearchDropdown(false)
                      setSearchQuery('')
                    }}
                    className="w-full py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Done ({selectedSearchItems.length} selected)
                  </button>
                </div>
              )}
            </div>
          )}
          </div>
        </div>

        {/* Filters Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <span className="font-medium">Filters</span>
          {activeFilterCount > 0 && (
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">
              {activeFilterCount} active
            </span>
          )}
          {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 space-y-4">
          {/* Department Filter */}
          {filterOptions.departments.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Department
              </label>
              <div className="flex flex-wrap gap-2">
                {(expandedFilters.departments ? filterOptions.departments : filterOptions.departments.slice(0, 12)).map(dept => (
                  <button
                    key={dept}
                    onClick={() => toggleDepartment(dept)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      selectedDepartments.includes(dept)
                        ? 'bg-blue-100 border-blue-300 text-blue-800'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {dept}
                  </button>
                ))}
                {filterOptions.departments.length > 12 && (
                  <button
                    onClick={() => setExpandedFilters(prev => ({ ...prev, departments: !prev.departments }))}
                    className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {expandedFilters.departments ? 'Show less' : `+${filterOptions.departments.length - 12} more`}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Fund Filter */}
          {filterOptions.funds.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fund
              </label>
              <div className="flex flex-wrap gap-2">
                {(expandedFilters.funds ? filterOptions.funds : filterOptions.funds.slice(0, 12)).map(fund => (
                  <button
                    key={fund}
                    onClick={() => toggleFund(fund)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      selectedFunds.includes(fund)
                        ? 'bg-green-100 border-green-300 text-green-800'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {fund}
                  </button>
                ))}
                {filterOptions.funds.length > 12 && (
                  <button
                    onClick={() => setExpandedFilters(prev => ({ ...prev, funds: !prev.funds }))}
                    className="px-3 py-1.5 text-sm text-green-600 hover:text-green-800 font-medium"
                  >
                    {expandedFilters.funds ? 'Show less' : `+${filterOptions.funds.length - 12} more`}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Cost Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cost Type
            </label>
            <div className="flex flex-wrap gap-2">
              {['Personnel', 'NonPersonnel'].map(costType => (
                <button
                  key={costType}
                  onClick={() => toggleCostType(costType)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    selectedCostTypes.includes(costType)
                      ? 'bg-orange-100 border-orange-300 text-orange-800'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {costType === 'NonPersonnel' ? 'Non-Personnel' : costType}
                </button>
              ))}
            </div>
          </div>

          {/* Clear All */}
          {activeFilterCount > 0 && (
            <div className="pt-2">
              <button
                onClick={clearAllFilters}
                className="text-sm text-red-600 hover:text-red-800 font-medium"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Active Filter Badges (shown when filters are collapsed) */}
      {!showFilters && activeFilterCount > 0 && (
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
          <div className="flex flex-wrap gap-2">
            {selectedSearchItems.map((item, i) => (
              <span key={`search-${i}`} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                {item.substring(0, 20)}{item.length > 20 ? '...' : ''}
                <button onClick={() => removeSearchItem(item)} className="hover:text-purple-900">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {selectedDepartments.map(dept => (
              <span key={dept} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                {dept.substring(0, 15)}{dept.length > 15 ? '...' : ''}
                <button onClick={() => toggleDepartment(dept)} className="hover:text-blue-900">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {selectedFunds.map(fund => (
              <span key={fund} className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                {fund.substring(0, 15)}{fund.length > 15 ? '...' : ''}
                <button onClick={() => toggleFund(fund)} className="hover:text-green-900">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {selectedCostTypes.map(costType => (
              <span key={costType} className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">
                {costType === 'NonPersonnel' ? 'Non-Personnel' : costType}
                <button onClick={() => toggleCostType(costType)} className="hover:text-orange-900">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* Visualization */}
      <div className="p-3 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center h-[300px] sm:h-[400px]">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500 animate-spin" />
              <span className="text-xs sm:text-sm text-gray-500">Loading cost flows...</span>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-[300px] sm:h-[400px]">
            <div className="text-center">
              <p className="text-red-600 mb-2 text-sm">{error}</p>
              <button 
                onClick={fetchSankeyData}
                className="text-sm text-blue-600 hover:underline"
              >
                Try again
              </button>
            </div>
          </div>
        ) : data && data.nodes.length > 0 ? (
          <div className="relative">
            {/* Check if there are actually priority nodes in the data */}
            {(() => {
              const hasPriorityNodes = data.nodes.some(n => n.type === 'priority')
              return (
                <>
                  {/* Legend */}
                  <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-3 text-xs sm:text-sm">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-gradient-to-r from-blue-500 to-purple-500" />
                      <span className="text-gray-600">Categories</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-gradient-to-r from-blue-800 to-purple-800" />
                      <span className="text-gray-600">Programs</span>
                    </div>
                    {hasPriorityNodes && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-gradient-to-r from-emerald-500 to-teal-500" />
                        <span className="text-gray-600">Priorities</span>
                      </div>
                    )}
                    <div className="text-gray-500">
                      Total: <span className="font-semibold text-gray-900">{formatCurrency(data.total_flow)}</span>
                    </div>
                  </div>
                  
                  {/* Notice if priorities requested but not found */}
                  {showPriorities && !hasPriorityNodes && (
                    <div className="text-center text-xs text-amber-600 mb-2">
                      No priority data available for these programs
                    </div>
                  )}
                  
                  <svg ref={svgRef} className="w-full mt-5" />
                  
                  {/* Side Labels - hidden on very small screens */}
                  <div className="hidden sm:block absolute top-0 left-0 text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    {direction === 'category_to_program' ? 'Categories' : 'Programs'}
                  </div>
                  {hasPriorityNodes && (
                    <div className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Programs
                    </div>
                  )}
                  <div className="hidden sm:block absolute top-0 right-0 text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    {hasPriorityNodes 
                      ? 'Priorities'
                      : direction === 'category_to_program' ? 'Programs' : 'Categories'
                    }
                  </div>
                </>
              )
            })()}
          </div>
        ) : (
          <div className="flex items-center justify-center h-[400px]">
            <div className="text-center text-gray-500">
              <p className="mb-2">No cost flow data available</p>
              <p className="text-sm">Try adjusting your filters or search terms</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Tooltip */}
      {tooltip.visible && (
        <div
          className="fixed z-[100] bg-white border border-gray-200 rounded-lg shadow-xl p-3 pointer-events-none max-w-[280px]"
          style={{
            left: tooltip.x + 15,
            top: tooltip.y + 15,
          }}
        >
          {tooltip.content}
        </div>
      )}
      
      {/* Click outside to close search dropdown */}
      {showSearchDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowSearchDropdown(false)}
        />
      )}
    </div>
  )
}