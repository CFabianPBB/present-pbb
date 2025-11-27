import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { API_BASE_URL } from '../config/api';

interface Dataset {
  id: string
  name: string
  created_at: string
  program_count: number
}

export function DatasetPicker() {
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchDatasets()
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
    if (!isOpen) {
      setSearchQuery('')
    }
  }, [isOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const fetchDatasets = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/datasets`)
      if (response.ok) {
        const data = await response.json()
        setDatasets(data)
        if (data.length > 0 && !selectedDataset) {
          setSelectedDataset(data[0].id)
          // Store in localStorage for other components to use
          localStorage.setItem('selectedDatasetId', data[0].id)
        }
      }
    } catch (error) {
      console.error('Error fetching datasets:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDatasetChange = (datasetId: string) => {
    setSelectedDataset(datasetId)
    localStorage.setItem('selectedDatasetId', datasetId)
    setIsOpen(false)
    setSearchQuery('')
    // Trigger a custom event to notify other components
    window.dispatchEvent(new CustomEvent('datasetChanged', { detail: { datasetId } }))
  }

  // Filter datasets based on search query
  const filteredDatasets = datasets.filter(dataset =>
    dataset.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectedDatasetName = datasets.find(d => d.id === selectedDataset)?.name || 'Select Dataset'

  if (loading) {
    return <div className="text-sm text-gray-500">Loading...</div>
  }

  if (datasets.length === 0) {
    return <div className="text-sm text-gray-500">No datasets available</div>
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span className="truncate max-w-40">
          {selectedDatasetName}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search organizations..."
                className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Dataset List */}
          <div className="py-1 max-h-80 overflow-y-auto">
            {filteredDatasets.length > 0 ? (
              filteredDatasets.map((dataset) => (
                <button
                  key={dataset.id}
                  onClick={() => handleDatasetChange(dataset.id)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                    selectedDataset === dataset.id ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                  }`}
                >
                  <div className="font-medium truncate">{dataset.name}</div>
                  <div className="text-xs text-gray-500">
                    {dataset.program_count} programs • {new Date(dataset.created_at).toLocaleDateString()}
                  </div>
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                No matches for "{searchQuery}"
              </div>
            )}
          </div>

          {/* Result count */}
          {searchQuery && filteredDatasets.length > 0 && (
            <div className="px-3 py-2 text-xs text-gray-400 border-t border-gray-100">
              {filteredDatasets.length} of {datasets.length} organizations
            </div>
          )}
        </div>
      )}
    </div>
  )
}