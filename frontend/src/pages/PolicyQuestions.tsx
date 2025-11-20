import { useState, useEffect } from 'react'
import { BubbleChart } from '../components/BubbleChart'
import { ProgramTable } from '../components/ProgramTable'
import { ProgramDrawer } from '../components/ProgramDrawer'
import { API_BASE_URL } from '../config/api';

interface BubbleData {
  id: number
  name: string
  size: number
  shade: number
  service_type?: string
}

// Policy priorities based on your Excel data
const policyPriorities = [
  { key: 'Community Safety', label: 'Community Safety', group: 'Community' },
  { key: 'Community Development', label: 'Community Development', group: 'Community' },
  { key: 'Infrastructure & Asset Management', label: 'Infrastructure & Asset Management', group: 'Community' },
  { key: 'Sustainable Community', label: 'Sustainable Community', group: 'Community' },
  { key: 'Quality of Place', label: 'Quality of Place', group: 'Community' },
  { key: 'Responsible Government', label: 'Responsible Government', group: 'Governance' },
  { key: 'Fiscal Stewardship', label: 'Fiscal Stewardship', group: 'Governance' }
]

export function PolicyQuestions() {
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null)
  const [bubbleData, setBubbleData] = useState<BubbleData[]>([])
  const [selectedProgram, setSelectedProgram] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

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
  }, [selectedPriority])

  const loadData = async () => {
    const datasetId = localStorage.getItem('selectedDatasetId')
    if (!datasetId) {
      setLoading(false)
      return
    }

    if (!selectedPriority) {
      setLoading(false)
      return
    }

    setLoading(true)
    
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/charts/bubbles/results?dataset_id=${datasetId}&priority=${encodeURIComponent(selectedPriority)}`
      )
      if (response.ok) {
        const result = await response.json()
        setBubbleData(result.bubbles || [])
      }
    } catch (error) {
      console.error('Error loading policy data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePrioritySelect = (priority: string) => {
    setSelectedPriority(priority)
  }

  const handleBubbleClick = (programId: number) => {
    setSelectedProgram(programId)
  }

  const communityPriorities = policyPriorities.filter(p => p.group === 'Community')
  const governancePriorities = policyPriorities.filter(p => p.group === 'Governance')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Policy Questions</h1>
        <p className="text-gray-600 mt-2">
          Filter and analyze programs by policy priorities and strategic alignment
        </p>
      </div>

      {/* Priority Filter Grid */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Policy Priority</h2>
        
        {/* Community Priorities */}
        <div className="mb-6">
          <h3 className="text-md font-medium text-gray-700 mb-3">Community Priorities</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {communityPriorities.map((priority) => (
              <button
                key={priority.key}
                onClick={() => handlePrioritySelect(priority.key)}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  selectedPriority === priority.key
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="font-medium text-sm">{priority.label}</div>
                <div className="text-xs text-blue-600 mt-1">Community</div>
              </button>
            ))}
          </div>
        </div>

        {/* Governance Priorities */}
        <div>
          <h3 className="text-md font-medium text-gray-700 mb-3">Governance Priorities</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {governancePriorities.map((priority) => (
              <button
                key={priority.key}
                onClick={() => handlePrioritySelect(priority.key)}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  selectedPriority === priority.key
                    ? 'border-green-500 bg-green-50 text-green-900'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="font-medium text-sm">{priority.label}</div>
                <div className="text-xs text-green-600 mt-1">Governance</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      {selectedPriority ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Bubble Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Program Alignment: {selectedPriority}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Programs sized by budget, shaded by alignment strength
            </p>
            
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            ) : (
              <BubbleChart
                data={bubbleData}
                onBubbleClick={handleBubbleClick}
                colorLabel={`${selectedPriority} Alignment`}
              />
            )}
          </div>

          {/* Program Table */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Programs by Alignment
            </h2>
            
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            ) : bubbleData.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {bubbleData
                  .sort((a, b) => b.shade - a.shade) // Sort by alignment strength
                  .map((program) => (
                    <div
                      key={program.id}
                      onClick={() => handleBubbleClick(program.id)}
                      className="p-3 border border-gray-200 rounded hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">
                            {program.name}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {program.service_type}
                          </p>
                        </div>
                        <div className="ml-4 text-right">
                          <div className="text-sm font-medium text-gray-900">
                            ${program.size.toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-600">
                            {Math.round(program.shade * 100)}% aligned
                          </div>
                        </div>
                      </div>
                      
                      {/* Alignment bar */}
                      <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${program.shade * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                No programs found for this priority
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-gray-500">
            <div className="text-lg font-medium mb-2">Select a Policy Priority</div>
            <p className="text-sm">
              Choose a priority above to view program alignment analysis and detailed breakdowns
            </p>
          </div>
        </div>
      )}

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