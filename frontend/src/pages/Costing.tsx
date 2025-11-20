import { useState, useEffect } from 'react'
import { BubbleChart } from '../components/BubbleChart'
import { ProgramDrawer } from '../components/ProgramDrawer'

interface BubbleData {
  id: number
  name: string
  size: number
  shade: number
  service_type?: string
  fte?: number
  personnel_pct?: number
  nonpersonnel_pct?: number
  recovery_rate?: number
}

const costingModes = [
  {
    key: 'fte',
    label: 'FTE Emphasis',
    description: 'Programs shaded by staff intensity (FTE count)',
    color: 'blue'
  },
  {
    key: 'personnel',
    label: 'Personnel Costs',
    description: 'Programs shaded by personnel cost percentage',
    color: 'green'
  },
  {
    key: 'nonpersonnel',
    label: 'Non-Personnel Costs',
    description: 'Programs shaded by operating cost percentage',
    color: 'yellow'
  },
  {
    key: 'fee_recovery',
    label: 'Fee Recovery Opportunity',
    description: 'Programs shaded by revenue generation potential',
    color: 'purple'
  }
]

export function Costing() {
  const [activeMode, setActiveMode] = useState<string>('fte')
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
  }, [activeMode])

  const loadData = async () => {
    const datasetId = localStorage.getItem('selectedDatasetId')
    if (!datasetId) {
      setLoading(false)
      return
    }

    setLoading(true)
    
    try {
      const response = await fetch(
        `http://localhost:8000/api/charts/bubbles/costing?dataset_id=${datasetId}&mode=${activeMode}`
      )
      if (response.ok) {
        const result = await response.json()
        setBubbleData(result.bubbles || [])
      }
    } catch (error) {
      console.error('Error loading costing data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleBubbleClick = (programId: number) => {
    setSelectedProgram(programId)
  }

  const activeModeInfo = costingModes.find(mode => mode.key === activeMode)

  const getColorClass = (mode: string) => {
    switch (mode) {
      case 'blue': return 'border-blue-500 bg-blue-50 text-blue-900'
      case 'green': return 'border-green-500 bg-green-50 text-green-900'
      case 'yellow': return 'border-yellow-500 bg-yellow-50 text-yellow-900'
      case 'purple': return 'border-purple-500 bg-purple-50 text-purple-900'
      default: return 'border-gray-500 bg-gray-50 text-gray-900'
    }
  }

  const getHoverColorClass = (mode: string) => {
    switch (mode) {
      case 'blue': return 'hover:border-blue-300 hover:bg-blue-25'
      case 'green': return 'hover:border-green-300 hover:bg-green-25'
      case 'yellow': return 'hover:border-yellow-300 hover:bg-yellow-25'
      case 'purple': return 'hover:border-purple-300 hover:bg-purple-25'
      default: return 'hover:border-gray-300 hover:bg-gray-25'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Program Costing</h1>
        <p className="text-gray-600 mt-2">
          Analyze program cost structures, staffing, and revenue opportunities
        </p>
      </div>

      {/* Mode Selector */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Analysis Mode</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {costingModes.map((mode) => (
            <button
              key={mode.key}
              onClick={() => setActiveMode(mode.key)}
              className={`p-4 rounded-lg border text-left transition-colors ${
                activeMode === mode.key
                  ? getColorClass(mode.color)
                  : `border-gray-200 ${getHoverColorClass(mode.color)}`
              }`}
            >
              <div className="font-medium text-sm">{mode.label}</div>
              <div className="text-xs mt-1 opacity-80">{mode.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Bubble Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {activeModeInfo?.label} Analysis
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Programs sized by total budget, shaded by {activeModeInfo?.description?.toLowerCase()}
          </p>
        </div>

        <BubbleChart
          data={bubbleData}
          onBubbleClick={handleBubbleClick}
          colorLabel={activeModeInfo?.label || 'Value'}
        />

        {/* Summary Stats */}
        {bubbleData.length > 0 && (
          <div className="mt-6">
            <h3 className="text-md font-medium text-gray-900 mb-3">Summary Statistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-sm text-gray-600">Total Programs</div>
                <div className="text-lg font-semibold">{bubbleData.length}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-sm text-gray-600">Total Budget</div>
                <div className="text-lg font-semibold">
                  ${bubbleData.reduce((sum, item) => sum + item.size, 0).toLocaleString()}
                </div>
              </div>
              
              {/* Mode-specific stats */}
              {activeMode === 'fte' && (
                <>
                  <div className="bg-blue-50 p-3 rounded">
                    <div className="text-sm text-gray-600">Total FTE</div>
                    <div className="text-lg font-semibold">
                      {bubbleData.reduce((sum, item) => sum + (item.fte || 0), 0).toFixed(1)}
                    </div>
                  </div>
                  <div className="bg-blue-50 p-3 rounded">
                    <div className="text-sm text-gray-600">High FTE Programs</div>
                    <div className="text-lg font-semibold">
                      {bubbleData.filter(item => (item.fte || 0) > 5).length}
                    </div>
                  </div>
                </>
              )}

              {activeMode === 'personnel' && (
                <>
                  <div className="bg-green-50 p-3 rounded">
                    <div className="text-sm text-gray-600">Avg Personnel %</div>
                    <div className="text-lg font-semibold">
                      {(bubbleData.reduce((sum, item) => sum + (item.personnel_pct || 0), 0) / bubbleData.length * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="bg-green-50 p-3 rounded">
                    <div className="text-sm text-gray-600">High Personnel Cost</div>
                    <div className="text-lg font-semibold">
                      {bubbleData.filter(item => (item.personnel_pct || 0) > 0.7).length} programs
                    </div>
                  </div>
                </>
              )}

              {activeMode === 'nonpersonnel' && (
                <>
                  <div className="bg-yellow-50 p-3 rounded">
                    <div className="text-sm text-gray-600">Avg Operating %</div>
                    <div className="text-lg font-semibold">
                      {(bubbleData.reduce((sum, item) => sum + (item.nonpersonnel_pct || 0), 0) / bubbleData.length * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="bg-yellow-50 p-3 rounded">
                    <div className="text-sm text-gray-600">High Operating Cost</div>
                    <div className="text-lg font-semibold">
                      {bubbleData.filter(item => (item.nonpersonnel_pct || 0) > 0.7).length} programs
                    </div>
                  </div>
                </>
              )}

              {activeMode === 'fee_recovery' && (
                <>
                  <div className="bg-purple-50 p-3 rounded">
                    <div className="text-sm text-gray-600">Avg Recovery Rate</div>
                    <div className="text-lg font-semibold">
                      {(bubbleData.reduce((sum, item) => sum + (item.recovery_rate || 0), 0) / bubbleData.length * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="bg-purple-50 p-3 rounded">
                    <div className="text-sm text-gray-600">High Opportunity</div>
                    <div className="text-lg font-semibold">
                      {bubbleData.filter(item => item.shade > 0.7).length} programs
                    </div>
                  </div>
                </>
              )}
            </div>
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