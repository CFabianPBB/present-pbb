import { useState, useEffect } from 'react'
import { ResponsiveTreemapWrapper } from '../components/ResponsiveTreemapWrapper'
import { ProgramDrawer } from '../components/ProgramDrawer'
import { WelcomeModal } from '../components/WelcomeModal'
import { InsightsPanel } from '../components/InsightsPanel'
import { HelpCircle } from 'lucide-react'
import { API_BASE_URL } from '../config/api';

interface Priority {
  priority: string
  total_cost: number
  program_count: number
}

interface Program {
  id: number
  name: string
  total_cost: number
  department: string
  cof_section: string
  service_type: string
  quartile: string
}

interface ResultsProps {
  lockedDatasetId?: string | null;
  isLocked?: boolean;
}

export function Results({ lockedDatasetId, isLocked }: ResultsProps = {}) {

  const [activeTab, setActiveTab] = useState<'community' | 'governance'>('community')
  const [spendingData, setSpendingData] = useState<Priority[]>([])
  const [programsData, setProgramsData] = useState<Program[]>([])
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null)
  const [selectedProgram, setSelectedProgram] = useState<number | null>(null)
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null) // NEW: Track selected department
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showWelcome, setShowWelcome] = useState(false)
  const [insightsCollapsed, setInsightsCollapsed] = useState(false)

  // Check if user has seen welcome modal before
  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('hasSeenWelcome')
    if (!hasSeenWelcome) {
      setShowWelcome(true)
    }
  }, [])

  const handleCloseWelcome = () => {
    setShowWelcome(false)
    localStorage.setItem('hasSeenWelcome', 'true')
  }

  const handleReopenWelcome = () => {
    setShowWelcome(true)
  }

  useEffect(() => {
    loadData()
    
    // Listen for dataset changes
    const handleDatasetChange = () => loadData()
    window.addEventListener('datasetChanged', handleDatasetChange)
    window.addEventListener('datasetUploaded', handleDatasetChange)
    
    return () => {
      window.removeEventListener('datasetChanged', handleDatasetChange)
      window.removeEventListener('datasetUploaded', handleDatasetChange)
    }
  }, [activeTab, lockedDatasetId])

  const loadData = async () => {
  // Use locked dataset ID if provided, otherwise get from localStorage
  const datasetId = lockedDatasetId || localStorage.getItem('selectedDatasetId')
  if (!datasetId) {
      setLoading(false)
      setError('No dataset selected. Please select a dataset first.')
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      // Load spending by priority data
      const spendingResponse = await fetch(
        `${API_BASE_URL}/api/charts/spending-by-priority?dataset_id=${datasetId}&group=${activeTab}`
      )
      
      if (spendingResponse.ok) {
        const spending = await spendingResponse.json()
        // Ensure spending is an array
        const spendingArray = Array.isArray(spending) ? spending : []
        setSpendingData(spendingArray)
        
        // Auto-select first priority if none selected
        if (!selectedPriority && spendingArray.length > 0) {
          setSelectedPriority(spendingArray[0].priority)
        }
      } else {
        console.error('Failed to load spending data:', spendingResponse.status)
        setSpendingData([])
      }

      // Load all programs for treemap
      const programsResponse = await fetch(
        `${API_BASE_URL}/api/programs?dataset_id=${datasetId}&include_department=true`
      )
      
      if (programsResponse.ok) {
        const programs = await programsResponse.json()
        // Ensure programs is an array
        const programsArray = Array.isArray(programs) ? programs : []
        setProgramsData(programsArray)
      } else {
        console.error('Failed to load programs data:', programsResponse.status)
        setProgramsData([])
      }

    } catch (error) {
      console.error('Error loading results data:', error)
      setError('Failed to load data. Please try again.')
      setSpendingData([])
      setProgramsData([])
    } finally {
      setLoading(false)
    }
  }

  const handlePrioritySelect = (priority: string) => {
    setSelectedPriority(priority)
  }

  const handleProgramClick = (program: any) => {
    setSelectedProgram(program.id)
  }

  // NEW: Handler for when treemap view level changes
  const handleViewLevelChange = (viewLevel: 'departments' | 'programs', department?: string | null) => {
    if (viewLevel === 'departments') {
      setSelectedDepartment(null)
    } else if (viewLevel === 'programs' && department) {
      setSelectedDepartment(department)
    }
  }

  const formatCurrency = (value: number): string => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`
    } else {
      return `$${value.toFixed(0)}`
    }
  }

  // Safe calculation of total budget - ensure programsData is array
  const totalBudget = Array.isArray(programsData) 
    ? programsData.reduce((sum, program) => sum + (program.total_cost || 0), 0)
    : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-600 mb-2">⚠️ Error Loading Data</div>
          <p className="text-gray-600">{error}</p>
          <button 
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Modal */}
      <WelcomeModal 
        isOpen={showWelcome} 
        onClose={handleCloseWelcome}
        totalPrograms={programsData.length}
        totalBudget={formatCurrency(totalBudget)}
      />

      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Priorities</h1>
            <p className="text-gray-600 mt-2">
              Analyze spending alignment with community and governance priorities
            </p>
          </div>
          <button
            onClick={handleReopenWelcome}
            className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <HelpCircle className="h-4 w-4" />
            Show Guide
          </button>
        </div>
        <div className="mt-4 bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-blue-900">
              Total Programs: {Array.isArray(programsData) ? programsData.length : 0}
            </span>
            <span className="font-medium text-blue-900">
              Total Budget: {formatCurrency(totalBudget)}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'community', label: 'Community Priorities' },
            { key: 'governance', label: 'Governance Priorities' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as 'community' | 'governance')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {/* Priority Selection - Full Width */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Select Priority
          </h2>
          
          {Array.isArray(spendingData) && spendingData.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {spendingData.map((priority) => (
                <button
                  key={priority.priority}
                  onClick={() => handlePrioritySelect(priority.priority)}
                  className={`text-left p-3 rounded-md border transition-colors ${
                    selectedPriority === priority.priority
                      ? 'border-blue-500 bg-blue-50 text-blue-900'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium text-sm">{priority.priority}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    {priority.program_count} programs
                  </div>
                  <div className="text-xs font-semibold text-gray-900 mt-1">
                    {formatCurrency(priority.total_cost)}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-center py-8">
              <p>No priority data available</p>
              <p className="text-sm mt-2">Upload data to see priority breakdowns</p>
            </div>
          )}
        </div>

        {/* Treemap Visualization - Full Width */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Program Budget Treemap
            </h2>
            {selectedPriority && (
              <div className="text-sm text-gray-600">
                Shaded by alignment with <span className="font-medium">{selectedPriority}</span>
              </div>
            )}
          </div>

          {Array.isArray(programsData) && programsData.length > 0 ? (
            <div className="w-full">
              <ResponsiveTreemapWrapper
                data={programsData}
                selectedPriority={selectedPriority}
                priorityGroup={activeTab}
                onProgramClick={handleProgramClick}
                onViewLevelChange={handleViewLevelChange}
              />
              
              {/* Instructions */}
              <div className="mt-4 p-3 bg-gray-50 rounded-md">
                <p className="text-sm text-gray-600">
                  <strong>How to read this chart:</strong>
                </p>
                <ul className="text-sm text-gray-600 mt-1 space-y-1">
                  <li>• <strong>Size</strong> represents program budget (larger = higher budget)</li>
                  <li>• <strong>Color intensity</strong> shows alignment with selected priority (darker = higher alignment)</li>
                  <li>• Click on any program block for detailed information</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <div className="text-center">
                <p>No program data available</p>
                <p className="text-sm mt-2">Upload your PBB data to see the treemap visualization</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MOVED: Insights Panel - NOW BELOW TREEMAP */}
      {Array.isArray(programsData) && programsData.length > 0 && (
        <InsightsPanel
          programs={programsData}
          selectedPriority={selectedPriority}
          priorityGroup={activeTab}
          isCollapsed={insightsCollapsed}
          onToggle={() => setInsightsCollapsed(!insightsCollapsed)}
          selectedDepartment={selectedDepartment}
        />
      )}

      {/* REMOVED: Community Priorities Summary section has been deleted */}

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