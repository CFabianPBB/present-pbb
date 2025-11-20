import { useState, useEffect } from 'react'
import { Search, ExternalLink } from 'lucide-react'
import { API_BASE_URL } from '../config/api';

interface Program {
  id: number
  name: string
  service_type: string
  quartile: string
  total_cost: number
  fte: number
  department?: string
  division?: string
}

interface ProgramTableProps {
  onProgramSelect?: (programId: number) => void
  filters?: {
    department?: string
    quartile?: string
    search?: string
  }
}

export function ProgramTable({ onProgramSelect, filters = {} }: ProgramTableProps) {
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadPrograms()
    
    // Listen for dataset changes
    const handleDatasetChange = () => loadPrograms()
    window.addEventListener('datasetChanged', handleDatasetChange)
    window.addEventListener('datasetUploaded', handleDatasetChange)
    
    return () => {
      window.removeEventListener('datasetChanged', handleDatasetChange)
      window.removeEventListener('datasetUploaded', handleDatasetChange)
    }
  }, [filters])

  const loadPrograms = async () => {
    const datasetId = localStorage.getItem('selectedDatasetId')
    if (!datasetId) {
      setLoading(false)
      return
    }

    setLoading(true)
    
    try {
      const params = new URLSearchParams({
        dataset_id: datasetId,
        limit: '100',
        ...(filters.department && { dept: filters.department }),
        ...(filters.quartile && { quartile: filters.quartile }),
        ...(filters.search && { q: filters.search })
      })

      const response = await fetch(`${API_BASE_URL}/api/programs?${params}`)
      if (response.ok) {
        const data = await response.json()
        setPrograms(data.programs || [])
      }
    } catch (error) {
      console.error('Error loading programs:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter programs by search term
  const filteredPrograms = programs.filter(program =>
    program.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    program.service_type.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Search Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search programs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Program
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quartile
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Budget
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                FTE
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredPrograms.length > 0 ? (
              filteredPrograms.map((program) => (
                <tr key={program.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                      {program.name}
                    </div>
                    {(program.department || program.division) && (
                      <div className="text-xs text-gray-500">
                        {program.department} {program.division && `• ${program.division}`}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-900">{program.service_type}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      program.quartile === 'Most Aligned' ? 'bg-green-100 text-green-800' :
                      program.quartile === 'More Aligned' ? 'bg-blue-100 text-blue-800' :
                      program.quartile === 'Less Aligned' ? 'bg-yellow-100 text-yellow-800' :
                      program.quartile === 'Least Aligned' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {program.quartile}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(program.total_cost)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-gray-900">{program.fte?.toFixed(1) || '0.0'}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {onProgramSelect && (
                      <button
                        onClick={() => onProgramSelect(program.id)}
                        className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span className="ml-1">Details</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  {searchTerm ? `No programs found matching "${searchTerm}"` : 'No programs found'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {filteredPrograms.length > 0 && (
        <div className="px-4 py-3 bg-gray-50 text-sm text-gray-700">
          Showing {filteredPrograms.length} of {programs.length} programs
          {searchTerm && ` (filtered by "${searchTerm}")`}
        </div>
      )}
    </div>
  )
}