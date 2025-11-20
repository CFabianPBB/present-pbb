import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

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

  useEffect(() => {
    fetchDatasets()
  }, [])

  const fetchDatasets = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/datasets')
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
    // Trigger a custom event to notify other components
    window.dispatchEvent(new CustomEvent('datasetChanged', { detail: { datasetId } }))
  }

  const selectedDatasetName = datasets.find(d => d.id === selectedDataset)?.name || 'Select Dataset'

  if (loading) {
    return <div className="text-sm text-gray-500">Loading...</div>
  }

  if (datasets.length === 0) {
    return <div className="text-sm text-gray-500">No datasets available</div>
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span className="truncate max-w-40">
          {selectedDatasetName}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-500" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          <div className="py-1">
            {datasets.map((dataset) => (
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
            ))}
          </div>
        </div>
      )}
    </div>
  )
}