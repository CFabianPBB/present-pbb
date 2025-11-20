import { useState, useEffect } from 'react'
import { Upload, FileSpreadsheet, CheckCircle, XCircle, Files, Trash2 } from 'lucide-react'
import { API_BASE_URL } from '../config/api';

interface Dataset {
  id: string
  name: string
  created_at: string
}

export function Admin() {
  const [uploadMode, setUploadMode] = useState<'single' | 'multi'>('multi')
  
  // Single file upload state
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // Multi file upload state
  const [costsFile, setCostsFile] = useState<File | null>(null)
  const [scoresFile, setScoresFile] = useState<File | null>(null)
  const [datasetName, setDatasetName] = useState('')
  const [population, setPopulation] = useState(75000)
  const [multiUploading, setMultiUploading] = useState(false)
  const [multiResult, setMultiResult] = useState<any>(null)
  const [multiError, setMultiError] = useState<string | null>(null)

  // Dataset management state
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [loadingDatasets, setLoadingDatasets] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null)
  const [deletingDatasetId, setDeletingDatasetId] = useState<string | null>(null)

  // Load datasets on component mount
  useEffect(() => {
    loadDatasets()
  }, [])

  const loadDatasets = async () => {
    setLoadingDatasets(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/datasets`)
      if (response.ok) {
        const data = await response.json()
        setDatasets(data)
      }
    } catch (err) {
      console.error('Failed to load datasets:', err)
    } finally {
      setLoadingDatasets(false)
    }
  }

  const handleDeleteDataset = async (datasetId: string, datasetName: string) => {
    // Confirm deletion
    const confirmed = window.confirm(
      `Are you sure you want to delete "${datasetName}"?\n\n` +
      `This will permanently delete all programs, costs, scores, and related data for this dataset. This action cannot be undone.`
    )
    
    if (!confirmed) return

    const adminSecret = prompt('Enter admin secret to confirm deletion:')
    if (!adminSecret) return

    setDeletingDatasetId(datasetId)
    setDeleteError(null)
    setDeleteSuccess(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/dataset/${datasetId}`, {
        method: 'DELETE',
        headers: {
          'X-Admin-Secret': adminSecret,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `Delete failed with status ${response.status}`)
      }

      const data = await response.json()
      setDeleteSuccess(`Successfully deleted dataset: ${datasetName}`)
      
      // Refresh datasets list
      await loadDatasets()
      
      // Notify other components
      window.dispatchEvent(new CustomEvent('datasetUploaded'))
      
      // Clear success message after 5 seconds
      setTimeout(() => setDeleteSuccess(null), 5000)
      
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeletingDatasetId(null)
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
        setFile(selectedFile)
        setError(null)
      } else {
        setError('Please select an Excel file (.xlsx or .xls)')
        setFile(null)
      }
    }
  }

  const handleSingleUpload = async () => {
    if (!file) return

    const adminSecret = prompt('Enter admin secret:')
    if (!adminSecret) return

    setUploading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${API_BASE_URL}/api/admin/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          'x-admin-secret': adminSecret,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `Upload failed with status ${response.status}`)
      }

      const data = await response.json()
      setResult(data)
      
      // Refresh datasets list
      await loadDatasets()
      
      // Refresh the dataset picker
      window.dispatchEvent(new CustomEvent('datasetUploaded'))
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleMultiUpload = async () => {
    if (!costsFile || !scoresFile || !datasetName) {
      setMultiError('Please fill in all fields and select both files')
      return
    }

    const adminSecret = prompt('Enter admin secret:')
    if (!adminSecret) return

    setMultiUploading(true)
    setMultiError(null)
    setMultiResult(null)

    try {
      const formData = new FormData()
      formData.append('costs_file', costsFile)
      formData.append('scores_file', scoresFile)
      formData.append('dataset_name', datasetName)
      formData.append('population', population.toString())

      const response = await fetch(`${API_BASE_URL}/api/admin/upload-multi`, {
        method: 'POST',
        headers: {
          'X-Admin-Secret': adminSecret,
        },
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `Upload failed with status ${response.status}`)
      }

      const data = await response.json()
      setMultiResult(data)
      
      // Reset form
      setCostsFile(null)
      setScoresFile(null)
      setDatasetName('')
      setPopulation(75000)
      
      // Refresh datasets list
      await loadDatasets()
      
      // Refresh the dataset picker
      window.dispatchEvent(new CustomEvent('datasetUploaded'))
      
    } catch (err) {
      setMultiError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setMultiUploading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Dataset Management Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Manage Datasets</h2>
        
        {/* Delete success/error messages */}
        {deleteSuccess && (
          <div className="mb-4 bg-green-50 p-4 rounded-md">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
              <p className="text-sm text-green-800">{deleteSuccess}</p>
            </div>
          </div>
        )}
        
        {deleteError && (
          <div className="mb-4 bg-red-50 p-4 rounded-md">
            <div className="flex items-center">
              <XCircle className="h-5 w-5 text-red-500 mr-3" />
              <p className="text-sm text-red-800">{deleteError}</p>
            </div>
          </div>
        )}

        {/* Datasets List */}
        {loadingDatasets ? (
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading datasets...</p>
          </div>
        ) : datasets.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No datasets found. Upload your first dataset below!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {datasets.map((dataset) => (
              <div
                key={dataset.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{dataset.name}</h3>
                  <p className="text-sm text-gray-500">
                    Created: {formatDate(dataset.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteDataset(dataset.id, dataset.name)}
                  disabled={deletingDatasetId === dataset.id}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    deletingDatasetId === dataset.id
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'text-red-700 bg-red-50 hover:bg-red-100'
                  }`}
                >
                  {deletingDatasetId === dataset.id ? (
                    <>
                      <div className="animate-spin h-4 w-4 mr-2 border-2 border-red-600 border-t-transparent rounded-full"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Upload PBB Data</h2>
        
        {/* Upload Mode Selector */}
        <div className="mb-6">
          <div className="flex space-x-4 border-b">
            <button
              onClick={() => setUploadMode('multi')}
              className={`pb-2 px-1 ${
                uploadMode === 'multi'
                  ? 'border-b-2 border-blue-500 text-blue-600 font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Files className="inline h-4 w-4 mr-2" />
              Multi-File Upload (Recommended)
            </button>
            <button
              onClick={() => setUploadMode('single')}
              className={`pb-2 px-1 ${
                uploadMode === 'single'
                  ? 'border-b-2 border-blue-500 text-blue-600 font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileSpreadsheet className="inline h-4 w-4 mr-2" />
              Single Summary Report
            </button>
          </div>
        </div>

        {uploadMode === 'multi' ? (
          /* Multi-File Upload */
          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>Recommended:</strong> Upload separate Program Costs and Program Scores files for better data quality and easier troubleshooting.
              </p>
            </div>

            {/* Dataset Name */}
            <div>
              <label htmlFor="datasetName" className="block text-sm font-medium text-gray-700 mb-2">
                Dataset Name
              </label>
              <input
                type="text"
                id="datasetName"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter dataset name..."
                required
              />
            </div>

            {/* Population Input - NEW! */}
            <div>
              <label htmlFor="population" className="block text-sm font-medium text-gray-700 mb-2">
                Population <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                id="population"
                value={population}
                onChange={(e) => setPopulation(parseInt(e.target.value) || 75000)}
                min="1"
                step="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter municipality population..."
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Used to calculate per-capita costs in Taxpayer Dividend (e.g., 13000 for Liberty Lake WA)
              </p>
            </div>

            {/* Costs File */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              <div className="text-center">
                <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-4">
                  <label htmlFor="costs-file-upload" className="cursor-pointer">
                    <span className="mt-2 block text-sm font-medium text-gray-900">
                      Program Costs Revenue File
                    </span>
                    <span className="mt-1 block text-sm text-gray-600">
                      Should contain: Programs, Personnel, NonPersonnel, Revenue, Allocations sheets
                    </span>
                    <input
                      id="costs-file-upload"
                      type="file"
                      accept=".xlsx,.xls"
                      className="sr-only"
                      onChange={(e) => setCostsFile(e.target.files?.[0] || null)}
                    />
                    <span className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200">
                      <Upload className="h-4 w-4 mr-2" />
                      Choose Costs File
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Scores File */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              <div className="text-center">
                <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-4">
                  <label htmlFor="scores-file-upload" className="cursor-pointer">
                    <span className="mt-2 block text-sm font-medium text-gray-900">
                      Program Scores File
                    </span>
                    <span className="mt-1 block text-sm text-gray-600">
                      Should contain: Summary, Score sheets
                    </span>
                    <input
                      id="scores-file-upload"
                      type="file"
                      accept=".xlsx,.xls"
                      className="sr-only"
                      onChange={(e) => setScoresFile(e.target.files?.[0] || null)}
                    />
                    <span className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200">
                      <Upload className="h-4 w-4 mr-2" />
                      Choose Scores File
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Selected Files Summary */}
            {(costsFile || scoresFile) && (
              <div className="bg-green-50 p-4 rounded-md">
                <div className="space-y-2">
                  {costsFile && (
                    <div className="flex items-center">
                      <FileSpreadsheet className="h-5 w-5 text-green-500 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-green-900">Costs: {costsFile.name}</p>
                        <p className="text-sm text-green-700">
                          {(costsFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  )}
                  {scoresFile && (
                    <div className="flex items-center">
                      <FileSpreadsheet className="h-5 w-5 text-green-500 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-green-900">Scores: {scoresFile.name}</p>
                        <p className="text-sm text-green-700">
                          {(scoresFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Multi Upload Button */}
            {costsFile && scoresFile && datasetName && (
              <button
                onClick={handleMultiUpload}
                disabled={multiUploading}
                className={`w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${
                  multiUploading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {multiUploading ? (
                  <>
                    <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></div>
                    Processing Files...
                  </>
                ) : (
                  <>
                    <Files className="h-4 w-4 mr-2" />
                    Upload & Process Files
                  </>
                )}
              </button>
            )}

            {/* Multi Upload Results */}
            {multiError && (
              <div className="bg-red-50 p-4 rounded-md">
                <div className="flex items-center">
                  <XCircle className="h-5 w-5 text-red-500 mr-3" />
                  <p className="text-sm text-red-800">{multiError}</p>
                </div>
              </div>
            )}

            {multiResult && (
              <div className="bg-green-50 p-4 rounded-md">
                <div className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-900">Multi-File Upload Successful!</p>
                    <p className="text-sm text-green-700 mt-1">
                      Dataset ID: {multiResult.dataset_id}
                    </p>
                    {multiResult.counts && (
                      <div className="mt-2 text-sm text-green-700">
                        {Object.entries(multiResult.counts).map(([key, value]) => (
                          <p key={key}>{key}: {String(value)}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Single File Upload (Original) */
          <div className="space-y-6">
            <div className="bg-yellow-50 p-4 rounded-md">
              <p className="text-sm text-yellow-800">
                <strong>Legacy mode:</strong> Upload a single Summary Report file. For better results, try the multi-file upload above.
              </p>
            </div>

            {/* File Upload Area */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              <div className="text-center">
                <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-4">
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <span className="mt-2 block text-sm font-medium text-gray-900">
                      Upload Excel Summary Report
                    </span>
                    <span className="mt-1 block text-sm text-gray-600">
                      Choose a .xlsx or .xls file containing "Programs Inventory" and "Details" sheets
                    </span>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      accept=".xlsx,.xls"
                      className="sr-only"
                      onChange={handleFileChange}
                    />
                    <span className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200">
                      <Upload className="h-4 w-4 mr-2" />
                      Choose File
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Selected File Info */}
            {file && (
              <div className="bg-blue-50 p-4 rounded-md">
                <div className="flex items-center">
                  <FileSpreadsheet className="h-5 w-5 text-blue-500 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">{file.name}</p>
                    <p className="text-sm text-blue-700">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Upload Button */}
            {file && (
              <button
                onClick={handleSingleUpload}
                disabled={uploading}
                className={`w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${
                  uploading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {uploading ? (
                  <>
                    <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload & Process
                  </>
                )}
              </button>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 p-4 rounded-md">
                <div className="flex items-center">
                  <XCircle className="h-5 w-5 text-red-500 mr-3" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            )}

            {/* Success Result */}
            {result && (
              <div className="bg-green-50 p-4 rounded-md">
                <div className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-900">Upload Successful!</p>
                    <p className="text-sm text-green-700 mt-1">
                      Dataset ID: {result.dataset_id}
                    </p>
                    {result.counts && (
                      <div className="mt-2 text-sm text-green-700">
                        <p>Programs: {result.counts.programs || 0}</p>
                        <p>Line Items: {result.counts.line_items || 0}</p>
                        <p>Priorities: {result.counts.priorities || 0}</p>
                        <p>Attributes: {result.counts.attributes || 0}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-gray-50 p-4 rounded-md">
          <h3 className="text-sm font-medium text-gray-900 mb-2">
            {uploadMode === 'multi' ? 'Multi-File Requirements:' : 'Single File Requirements:'}
          </h3>
          <ul className="text-sm text-gray-600 space-y-1">
            {uploadMode === 'multi' ? (
              <>
                <li>• Two separate Excel files (.xlsx or .xls)</li>
                <li>• <strong>Costs file</strong> with sheets: Programs, Personnel, NonPersonnel, Revenue, Allocations</li>
                <li>• <strong>Scores file</strong> with sheets: Summary, Score</li>
                <li>• Both files must have matching program_id values</li>
                <li>• Maximum 100MB per file</li>
              </>
            ) : (
              <>
                <li>• Excel file (.xlsx or .xls) with two required sheets:</li>
                <li>• <strong>"Programs Inventory"</strong> - Program-level data with costs and scores</li>
                <li>• <strong>"Details"</strong> - Line-item details with organizational structure</li>
                <li>• Maximum file size: 50MB</li>
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}