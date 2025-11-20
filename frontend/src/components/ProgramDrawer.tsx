import { useState, useEffect } from 'react'
import { X, Users, DollarSign, Building, Star } from 'lucide-react'
import { LineItemsTable } from './LineItemsTable'

interface ProgramDetail {
  id: number
  name: string
  description: string
  service_type: string
  user_group: string
  quartile: string
  final_score: number
  fte: number
  costs: {
    personnel: number
    nonpersonnel: number
    revenue: number
    total: number
  }
  organization: {
    department: string | null
    division: string | null
    activity: string | null
  }
  attributes: {
    reliance: number
    population_served: number
    demand: number
    cost_recovery: number
    mandate: number
  } | null
  priority_scores: Array<{
    priority: string
    group: string
    score: number
    label: string
  }>
  line_items_count: number
}

interface ProgramDrawerProps {
  programId: number
  isOpen: boolean
  onClose: () => void
}

export function ProgramDrawer({ programId, isOpen, onClose }: ProgramDrawerProps) {
  const [program, setProgram] = useState<ProgramDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && programId) {
      loadProgramDetail()
    }
  }, [isOpen, programId])

  const loadProgramDetail = async () => {
    const datasetId = localStorage.getItem('selectedDatasetId')
    if (!datasetId) return

    setLoading(true)
    try {
      const response = await fetch(
        `http://localhost:8000/api/programs/${programId}?dataset_id=${datasetId}`
      )
      if (response.ok) {
        const data = await response.json()
        setProgram(data)
      }
    } catch (error) {
      console.error('Error loading program detail:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const getScoreColor = (score: number) => {
    if (score >= 4) return 'text-green-600 bg-green-100'
    if (score >= 3) return 'text-yellow-600 bg-yellow-100'
    if (score >= 2) return 'text-orange-600 bg-orange-100'
    return 'text-red-600 bg-red-100'
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Program Details</h2>
            <button
              onClick={onClose}
              className="rounded-md p-2 hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            ) : program ? (
              <div className="space-y-6">
                {/* Basic Info */}
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{program.name}</h3>
                  <p className="text-gray-600 mt-1">{program.description}</p>
                  <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                    <span>Type: {program.service_type}</span>
                    <span>•</span>
                    <span>Quartile: {program.quartile}</span>
                    <span>•</span>
                    <span>Score: {program.final_score}</span>
                  </div>
                </div>

                {/* Cost Breakdown */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <DollarSign className="h-5 w-5 mr-2" />
                    Cost Breakdown
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Personnel</p>
                      <p className="font-medium">{formatCurrency(program.costs.personnel)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Non-Personnel</p>
                      <p className="font-medium">{formatCurrency(program.costs.nonpersonnel)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Revenue</p>
                      <p className="font-medium">{formatCurrency(program.costs.revenue)}</p>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-gray-300">
                      <p className="text-sm text-gray-600">Total Cost</p>
                      <p className="text-lg font-bold text-blue-600">
                        {formatCurrency(program.costs.total)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Organization */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <Building className="h-5 w-5 mr-2" />
                    Organization
                  </h4>
                  <div className="space-y-2 text-sm">
                    {program.organization.department && (
                      <p><span className="text-gray-600">Department:</span> {program.organization.department}</p>
                    )}
                    {program.organization.division && (
                      <p><span className="text-gray-600">Division:</span> {program.organization.division}</p>
                    )}
                    {program.organization.activity && (
                      <p><span className="text-gray-600">Activity:</span> {program.organization.activity}</p>
                    )}
                    <p><span className="text-gray-600">FTE:</span> {program.fte}</p>
                    <p><span className="text-gray-600">User Group:</span> {program.user_group}</p>
                  </div>
                </div>

                {/* Priority Scores */}
                {program.priority_scores.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                      <Star className="h-5 w-5 mr-2" />
                      Priority Alignment
                    </h4>
                    <div className="space-y-2">
                      {program.priority_scores.map((score, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <span className="text-sm">{score.priority}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(score.score)}`}>
                            {score.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attributes */}
                {program.attributes && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                      <Users className="h-5 w-5 mr-2" />
                      Program Attributes
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-600">Reliance</p>
                        <p className="font-medium">{program.attributes.reliance}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Population Served</p>
                        <p className="font-medium">{program.attributes.population_served}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Demand</p>
                        <p className="font-medium">{program.attributes.demand}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Cost Recovery</p>
                        <p className="font-medium">{program.attributes.cost_recovery}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-gray-600">Mandate</p>
                        <p className="font-medium">{program.attributes.mandate}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Line Items */}
                {program.line_items_count > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">
                      Line Items ({program.line_items_count})
                    </h4>
                    <LineItemsTable 
                      programId={programId} 
                      datasetId={localStorage.getItem('selectedDatasetId') || ''} 
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                Program not found
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}