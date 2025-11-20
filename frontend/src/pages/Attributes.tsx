import { useState, useEffect } from 'react'
import { AttributeScatterPlot } from '../components/AttributeScatterPlot'
import { ProgramDrawer } from '../components/ProgramDrawer'
import { API_BASE_URL } from '../config/api';

interface ProgramData {
  id: number
  name: string
  size: number
  shade: number
  service_type?: string
  department?: string
  org_unit?: string
  description?: string
  attribute_value?: number
  category?: number
  funds?: string[]
  revenue?: number  // Add revenue field
  category_info?: {
    name: string
    preferred_recommendation: string
    strategic_guidance: string
    primary_insights: string[]
    secondary_insights: string[]
  }
}

interface CategoryCount {
  [key: number]: number
}

const attributeOptions = [
  { key: 'reliance', label: 'Reliance', description: 'County dependency for service delivery' },
  { key: 'population_served', label: 'Population Served', description: 'Percentage of population benefiting' },
  { key: 'demand', label: 'Demand', description: 'Service demand trends' },
  { key: 'cost_recovery', label: 'Cost Recovery', description: 'Fee recovery potential' },
  { key: 'mandate', label: 'Mandate', description: 'Legal or regulatory requirements' }
]

export function Attributes() {
  const [selectedAttribute, setSelectedAttribute] = useState<string>('demand')
  const [programData, setProgramData] = useState<ProgramData[]>([])
  const [allProgramData, setAllProgramData] = useState<ProgramData[]>([])
  const [selectedProgram, setSelectedProgram] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCategories, setShowCategories] = useState(true) // Default to Category View
  const [categoryCounts, setCategoryCounts] = useState<CategoryCount>({})
  const [medianCost, setMedianCost] = useState<number>(0)
  const [showQuickStart, setShowQuickStart] = useState(true)
  
  // Filter states
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([])
  const [selectedFunds, setSelectedFunds] = useState<string[]>([])
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<number[]>([])
  const [budgetRange, setBudgetRange] = useState<[number, number]>([0, 100000000])
  const [searchText, setSearchText] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    loadData()
    
    const handleDatasetChange = () => loadData()
    window.addEventListener('datasetChanged', handleDatasetChange)
    window.addEventListener('datasetUploaded', handleDatasetChange)
    
    return () => {
      window.removeEventListener('datasetChanged', handleDatasetChange)
      window.removeEventListener('datasetUploaded', handleDatasetChange)
    }
  }, [selectedAttribute, showCategories])

  const loadData = async () => {
    const datasetId = localStorage.getItem('selectedDatasetId')
    if (!datasetId) {
      setLoading(false)
      return
    }

    setLoading(true)
    
    try {
      if (showCategories) {
        const response = await fetch(
          `${API_BASE_URL}/api/charts/program-categories?dataset_id=${datasetId}`
        )
        if (response.ok) {
          const result = await response.json()
          
          const transformedData = result.programs.map((prog: any) => ({
            id: prog.id,
            name: prog.name,
            size: prog.total_cost,
            shade: prog[selectedAttribute] ? (prog[selectedAttribute] - 1) / 4.0 : 0.5,
            service_type: prog.service_type,
            department: prog.department,
            org_unit: prog.org_unit,
            description: prog.description,
            funds: prog.funds || [],
            attribute_value: prog[selectedAttribute] || 0,
            category: prog.category,
            category_info: prog.category_info,
            revenue: prog.revenue || 0  // Include revenue
          }))
          
          setAllProgramData(transformedData)
          setCategoryCounts(result.category_counts || {})
          setMedianCost(result.median_cost || 0)
          applyFilters(transformedData)
        }
      } else {
        const response = await fetch(
          `${API_BASE_URL}/api/charts/bubbles/attributes?dataset_id=${datasetId}&attr=${selectedAttribute}`
        )
        if (response.ok) {
          const result = await response.json()
          setAllProgramData(result.bubbles || [])
          applyFilters(result.bubbles || [])
        }
      }
    } catch (error) {
      console.error('Error loading attributes data:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = (data: ProgramData[]) => {
    let filtered = [...data]
    
    if (searchText.trim() !== '') {
      const search = searchText.toLowerCase()
      filtered = filtered.filter(p => {
        const nameMatch = p.name?.toLowerCase().includes(search) || false
        const serviceTypeMatch = p.service_type?.toLowerCase().includes(search) || false
        const departmentMatch = p.department?.toLowerCase().includes(search) || false
        const orgUnitMatch = p.org_unit?.toLowerCase().includes(search) || false
        const descriptionMatch = p.description?.toLowerCase().includes(search) || false
        return nameMatch || serviceTypeMatch || departmentMatch || orgUnitMatch || descriptionMatch
      })
    }
    
    if (selectedDepartments.length > 0) {
      filtered = filtered.filter(p => 
        p.department && selectedDepartments.includes(p.department)
      )
    }
    
    if (selectedFunds.length > 0) {
      filtered = filtered.filter(p => 
        p.funds && p.funds.some(fund => selectedFunds.includes(fund))
      )
    }
    
    if (selectedServiceTypes.length > 0) {
      filtered = filtered.filter(p => 
        p.service_type && selectedServiceTypes.includes(p.service_type)
      )
    }
    
    if (showCategories && selectedCategories.length > 0) {
      filtered = filtered.filter(p => 
        p.category && selectedCategories.includes(p.category)
      )
    }
    
    filtered = filtered.filter(p => 
      p.size >= budgetRange[0] && p.size <= budgetRange[1]
    )
    
    setProgramData(filtered)
  }

  useEffect(() => {
    if (allProgramData.length > 0) {
      applyFilters(allProgramData)
    }
  }, [selectedDepartments, selectedFunds, selectedServiceTypes, selectedCategories, budgetRange, searchText])

  const handlePointClick = (programId: number) => {
    setSelectedProgram(programId)
  }

  const getUniqueServiceTypes = (): string[] => {
    const types = new Set(
      allProgramData
        .map(p => p.service_type)
        .filter((type): type is string => type !== undefined && type !== null)
    )
    return Array.from(types).sort()
  }

  const getUniqueDepartments = (): string[] => {
    const departments = new Set(
      allProgramData
        .map(p => p.department)
        .filter((dept): dept is string => dept !== undefined && dept !== null)
    )
    return Array.from(departments).sort()
  }

  const getUniqueFunds = (): string[] => {
    const funds = new Set<string>()
    allProgramData.forEach(p => {
      if (p.funds && Array.isArray(p.funds)) {
        p.funds.forEach(fund => funds.add(fund))
      }
    })
    return Array.from(funds).sort()
  }

  const getUniqueCategoryGroups = () => {
    return [
      { label: 'Categories 1-4 (Low Impact + Low Cost)', value: [1, 2, 3, 4] },
      { label: 'Categories 5-8 (Low Impact + High Cost)', value: [5, 6, 7, 8] },
      { label: 'Categories 9-12 (High Impact + Low Cost)', value: [9, 10, 11, 12] },
      { label: 'Categories 13-16 (High Impact + High Cost)', value: [13, 14, 15, 16] }
    ]
  }

  const toggleServiceType = (type: string) => {
    setSelectedServiceTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

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

  const toggleCategoryGroup = (categories: number[]) => {
    setSelectedCategories(prev => {
      const hasAll = categories.every(c => prev.includes(c))
      if (hasAll) {
        return prev.filter(c => !categories.includes(c))
      } else {
        const newSet = new Set([...prev, ...categories])
        return Array.from(newSet)
      }
    })
  }

  const clearAllFilters = () => {
    setSelectedDepartments([])
    setSelectedFunds([])
    setSelectedServiceTypes([])
    setSelectedCategories([])
    setBudgetRange([0, 100000000])
    setSearchText('')
  }

  const selectedAttrInfo = attributeOptions.find(a => a.key === selectedAttribute)

  const categoryStats = showCategories ? {
    lowImpactLowCost: programData.filter(p => p.category && p.category >= 1 && p.category <= 4).length,
    lowImpactHighCost: programData.filter(p => p.category && p.category >= 5 && p.category <= 8).length,
    highImpactLowCost: programData.filter(p => p.category && p.category >= 9 && p.category <= 12).length,
    highImpactHighCost: programData.filter(p => p.category && p.category >= 13 && p.category <= 16).length
  } : null

  const hasActiveFilters = selectedDepartments.length > 0 || 
                          selectedFunds.length > 0 ||
                          selectedServiceTypes.length > 0 || 
                          selectedCategories.length > 0 || 
                          searchText.trim() !== '' ||
                          budgetRange[0] !== 0 || 
                          budgetRange[1] !== 100000000

  // Calculate summary stats
  const totalBudget = allProgramData.reduce((sum, p) => sum + p.size, 0)
  const highImpactCount = allProgramData.filter(p => p.category && p.category >= 9).length
  const highImpactPct = allProgramData.length > 0 ? Math.round((highImpactCount / allProgramData.length) * 100) : 0
  const needsReviewCount = allProgramData.filter(p => p.category && p.category >= 5 && p.category <= 8).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Strategic Overview</h1>
          <p className="text-gray-600 mt-2">
            Comprehensive program portfolio analysis and strategic positioning
          </p>
        </div>
        
        {/* View Mode Toggle */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowCategories(!showCategories)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              showCategories
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {showCategories ? '📊 Attribute View' : '🎯 Category View'}
          </button>
        </div>
      </div>

      {/* Quick Start Guide (Collapsible) */}
      {showQuickStart && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-5">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-3">
                <span className="text-2xl">📚</span>
                <h3 className="text-lg font-semibold text-blue-900">How to Use This View</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
                <div>
                  <p className="font-medium mb-2">This analysis categorizes programs (1-16) based on:</p>
                  <ul className="space-y-1 ml-4">
                    <li>• <strong>Impact:</strong> How much value does it create?</li>
                    <li>• <strong>Cost:</strong> How expensive is it?</li>
                    <li>• <strong>Mandate:</strong> Is it legally required?</li>
                    <li>• <strong>Reliance:</strong> Do residents depend on it?</li>
                  </ul>
                </div>
                
                <div>
                  <p className="font-medium mb-2">Category colors indicate strategic action:</p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start space-x-2">
                      <span className="w-4 h-4 rounded-full bg-red-500 flex-shrink-0 mt-0.5"></span>
                      <span><strong>Red (1-4):</strong> Transform or transition - explore partnerships, cost recovery, and efficiency gains to preserve community value while reducing general fund burden.</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="w-4 h-4 rounded-full bg-orange-500 flex-shrink-0 mt-0.5"></span>
                      <span><strong>Orange (5-8):</strong> Right-size for sustainability - pursue bold efficiency improvements, alternative funding, and strategic partnerships to preserve access while dramatically reducing costs.</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="w-4 h-4 rounded-full bg-green-500 flex-shrink-0 mt-0.5"></span>
                      <span><strong>Green (9-12):</strong> Invest strategically in what matters - grow high-impact services through innovative partnerships, earned revenue, and efficiency gains that multiply community benefit per dollar spent.</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="w-4 h-4 rounded-full bg-blue-500 flex-shrink-0 mt-0.5"></span>
                      <span><strong>Blue (13-16):</strong> Protect and optimize - preserve essential high-impact services through operational excellence, cost recovery opportunities, and strategic investments that enhance efficiency and outcomes.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => setShowQuickStart(false)}
              className="ml-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Portfolio Summary Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="text-sm text-gray-600 font-medium">Total Programs</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{allProgramData.length}</div>
          <div className="text-xs text-gray-500 mt-1">Across all departments</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="text-sm text-gray-600 font-medium">Total Budget</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">
            ${(totalBudget / 1000000).toFixed(1)}M
          </div>
          <div className="text-xs text-gray-500 mt-1">Combined program costs</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
          <div className="text-sm text-gray-600 font-medium">High Impact Programs</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{highImpactPct}%</div>
          <div className="text-xs text-gray-500 mt-1">{highImpactCount} programs (Categories 9-16)</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
          <div className="text-sm text-gray-600 font-medium">Needs Review</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{needsReviewCount}</div>
          <div className="text-xs text-gray-500 mt-1">Low Impact + High Cost (5-8)</div>
        </div>
      </div>

      {/* Current View Indicator */}
      <div className={`rounded-lg p-4 ${showCategories ? 'bg-purple-50 border border-purple-200' : 'bg-blue-50 border border-blue-200'}`}>
        <div className="text-sm">
          {showCategories ? (
            <>
              <strong className="text-purple-900">Category View:</strong>
              <span className="text-purple-800 ml-2">
                Showing all {allProgramData.length} PBB categories based on Impact, Cost, Mandate, and Reliance
              </span>
            </>
          ) : (
            <>
              <strong className="text-blue-900">Attribute View:</strong>
              <span className="text-blue-800 ml-2">
                Analyzing programs by {selectedAttrInfo?.label.toLowerCase()} intensity
              </span>
            </>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
              <span className="text-sm text-gray-600">
                Showing {programData.length} of {allProgramData.length} programs
              </span>
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center space-x-1"
            >
              <span>{showFilters ? '▼ Hide' : '▶ Show'}</span>
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="p-6 space-y-6">
            {/* Search */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">Search Programs</h3>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search by program name, department, description..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>

            {/* Department Filter */}
            {getUniqueDepartments().length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">Department</h3>
                <div className="flex flex-wrap gap-2">
                  {getUniqueDepartments().map((dept) => (
                    <button
                      key={dept}
                      onClick={() => toggleDepartment(dept)}
                      className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                        selectedDepartments.includes(dept)
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {dept}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Fund Filter */}
            {getUniqueFunds().length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">Fund</h3>
                <div className="flex flex-wrap gap-2">
                  {getUniqueFunds().map((fund) => (
                    <button
                      key={fund}
                      onClick={() => toggleFund(fund)}
                      className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                        selectedFunds.includes(fund)
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {fund}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Service Type Filter */}
            {getUniqueServiceTypes().length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">Service Type</h3>
                <div className="flex flex-wrap gap-2">
                  {getUniqueServiceTypes().map((type) => (
                    <button
                      key={type}
                      onClick={() => toggleServiceType(type)}
                      className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                        selectedServiceTypes.includes(type)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Category Group Filter */}
            {showCategories && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">Category Groups</h3>
                <div className="space-y-2">
                  {getUniqueCategoryGroups().map((group) => {
                    const isSelected = group.value.some(c => selectedCategories.includes(c))
                    return (
                      <button
                        key={group.label}
                        onClick={() => toggleCategoryGroup(group.value)}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {group.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Budget Range Filter */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">Budget Range</h3>
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-600">Min</label>
                  <input
                    type="number"
                    value={budgetRange[0]}
                    onChange={(e) => setBudgetRange([Number(e.target.value), budgetRange[1]])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="$0"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-600">Max</label>
                  <input
                    type="number"
                    value={budgetRange[1]}
                    onChange={(e) => setBudgetRange([budgetRange[0], Number(e.target.value)])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="$100M"
                  />
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
                <span>${(budgetRange[0] / 1000000).toFixed(1)}M</span>
                <span>${(budgetRange[1] / 1000000).toFixed(1)}M</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Attribute Selector - only show when not in category mode */}
      {!showCategories && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Attribute</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {attributeOptions.map((attr) => (
              <button
                key={attr.key}
                onClick={() => setSelectedAttribute(attr.key)}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  selectedAttribute === attr.key
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="font-medium text-sm">{attr.label}</div>
                <div className="text-xs text-gray-600 mt-1">{attr.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {showCategories ? 'PBB Category Analysis' : `Program Analysis: ${selectedAttrInfo?.label}`}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {showCategories 
              ? 'Programs colored by their PBB category (1-16) based on Impact, Cost, Mandate, and Reliance'
              : `Programs sized by total budget, positioned by ${selectedAttrInfo?.label.toLowerCase()} intensity`}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <AttributeScatterPlot
            data={programData}
            onPointClick={handlePointClick}
            attributeLabel={showCategories ? 'Attribute Score' : (selectedAttrInfo?.label || 'Attribute')}
            showCategories={showCategories}
            medianCost={showCategories ? medianCost : undefined}
          />
        )}

        {/* Summary Stats */}
        {programData.length > 0 && (
          <div className="mt-6">
            {showCategories && categoryStats ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-red-50 border border-red-200 p-3 rounded">
                  <div className="text-sm text-red-900 font-medium">Low Impact + Low Cost</div>
                  <div className="text-lg font-semibold text-red-700">{categoryStats.lowImpactLowCost} programs</div>
                  <div className="text-xs text-red-600 mt-1">Categories 1-4: Exit/Downsize</div>
                  <div className="mt-2 pt-2 border-t border-red-200">
                    <div className="text-xs text-red-800">
                      <div>Cost: ${(programData.filter(p => p.category && p.category >= 1 && p.category <= 4).reduce((sum, p) => sum + p.size, 0) / 1000000).toFixed(2)}M</div>
                      <div>Revenue: ${(programData.filter(p => p.category && p.category >= 1 && p.category <= 4).reduce((sum, p) => sum + (p.revenue || 0), 0) / 1000000).toFixed(2)}M</div>
                    </div>
                  </div>
                </div>
                <div className="bg-orange-50 border border-orange-200 p-3 rounded">
                  <div className="text-sm text-orange-900 font-medium">Low Impact + High Cost</div>
                  <div className="text-lg font-semibold text-orange-700">{categoryStats.lowImpactHighCost} programs</div>
                  <div className="text-xs text-orange-600 mt-1">Categories 5-8: Review/Optimize</div>
                  <div className="mt-2 pt-2 border-t border-orange-200">
                    <div className="text-xs text-orange-800">
                      <div>Cost: ${(programData.filter(p => p.category && p.category >= 5 && p.category <= 8).reduce((sum, p) => sum + p.size, 0) / 1000000).toFixed(2)}M</div>
                      <div>Revenue: ${(programData.filter(p => p.category && p.category >= 5 && p.category <= 8).reduce((sum, p) => sum + (p.revenue || 0), 0) / 1000000).toFixed(2)}M</div>
                    </div>
                  </div>
                </div>
                <div className="bg-green-50 border border-green-200 p-3 rounded">
                  <div className="text-sm text-green-900 font-medium">High Impact + Low Cost</div>
                  <div className="text-lg font-semibold text-green-700">{categoryStats.highImpactLowCost} programs</div>
                  <div className="text-xs text-green-600 mt-1">Categories 9-12: Protect/Grow</div>
                  <div className="mt-2 pt-2 border-t border-green-200">
                    <div className="text-xs text-green-800">
                      <div>Cost: ${(programData.filter(p => p.category && p.category >= 9 && p.category <= 12).reduce((sum, p) => sum + p.size, 0) / 1000000).toFixed(2)}M</div>
                      <div>Revenue: ${(programData.filter(p => p.category && p.category >= 9 && p.category <= 12).reduce((sum, p) => sum + (p.revenue || 0), 0) / 1000000).toFixed(2)}M</div>
                    </div>
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 p-3 rounded">
                  <div className="text-sm text-blue-900 font-medium">High Impact + High Cost</div>
                  <div className="text-lg font-semibold text-blue-700">{categoryStats.highImpactHighCost} programs</div>
                  <div className="text-xs text-blue-600 mt-1">Categories 13-16: Core/Strategic</div>
                  <div className="mt-2 pt-2 border-t border-blue-200">
                    <div className="text-xs text-blue-800">
                      <div>Cost: ${(programData.filter(p => p.category && p.category >= 13 && p.category <= 16).reduce((sum, p) => sum + p.size, 0) / 1000000).toFixed(2)}M</div>
                      <div>Revenue: ${(programData.filter(p => p.category && p.category >= 13 && p.category <= 16).reduce((sum, p) => sum + (p.revenue || 0), 0) / 1000000).toFixed(2)}M</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm text-gray-600">Total Programs</div>
                  <div className="text-lg font-semibold">{programData.length}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm text-gray-600">Total Budget</div>
                  <div className="text-lg font-semibold">
                    ${(programData.reduce((sum, item) => sum + item.size, 0) / 1000000).toFixed(1)}M
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm text-gray-600">High {selectedAttrInfo?.label}</div>
                  <div className="text-lg font-semibold">
                    {programData.filter(item => (item.attribute_value || 0) >= 4).length} programs
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm text-gray-600">Low {selectedAttrInfo?.label}</div>
                  <div className="text-lg font-semibold">
                    {programData.filter(item => (item.attribute_value || 0) <= 2).length} programs
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Program Detail Drawer */}
      {selectedProgram && (
        <ProgramDrawer
          programId={selectedProgram}
          isOpen={!!selectedProgram}
          onClose={() => setSelectedProgram(null)}
        />
      )}
    </div>
  )
}