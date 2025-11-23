import { useState, useEffect } from 'react'
import { Upload, FileSpreadsheet, CheckCircle, XCircle, Files, Trash2, Building2, Edit3 } from 'lucide-react'
import { API_BASE_URL } from '../config/api';

// Import NEW components (you'll create these)
import OrganizationManager from '../components/OrganizationManager'
import DatasetEditor from '../components/DatasetEditor'

interface Dataset {
  id: string
  name: string
  created_at: string
}

interface Organization {
  id: string
  name: string
}

type AdminTab = 'upload' | 'editor' | 'organizations' | 'manage'

export function Admin() {
  // NEW: Tab state
  const [activeTab, setActiveTab] = useState<AdminTab>('upload')
  
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
  const [selectedOrgId, setSelectedOrgId] = useState<string>('')  // NEW
  const [organizations, setOrganizations] = useState<Organization[]>([])  // NEW
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
    fetchOrganizations()  // NEW
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

  // NEW: Fetch organizations for dropdown
  const fetchOrganizations = async () => {
    const adminSecret = localStorage.getItem('adminSecret') || 'change-me-in-production'
    try {
      const response = await fetch(`${API_BASE_URL}/api/organizations`, {
        headers: {
          'X-Admin-Secret': adminSecret
        }
      })
      if (response.ok) {
        const data = await response.json()
        setOrganizations(data)
      }
    } catch (error) {
      console.error('Error fetching organizations:', error)
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
      
      // NEW: Add organization_id if selected
      if (selectedOrgId) {
        formData.append('organization_id', selectedOrgId)
      }

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
      setSelectedOrgId('')  // NEW
      
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
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Panel</h1>
        <p className="text-gray-600">
          Manage datasets, organizations, and system configuration
        </p>
      </div>

      {/* NEW: Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-gray-200">
          <button
            onClick={() => setActiveTab('upload')}
            className={`p-4 md:p-6 text-center transition-all ${
              activeTab === 'upload'
                ? 'bg-blue-50 border-b-2 border-blue-600'
                : 'hover:bg-gray-50'
            }`}
          >
            <Upload className="h-6 w-6 md:h-8 md:w-8 mx-auto mb-2 text-blue-600" />
            <div className={`text-sm md:text-base font-semibold ${
              activeTab === 'upload' ? 'text-blue-700' : 'text-gray-700'
            }`}>
              Upload Data
            </div>
            <div className="hidden md:block text-xs text-gray-500 mt-1">
              Upload new datasets
            </div>
          </button>

          <button
            onClick={() => setActiveTab('editor')}
            className={`p-4 md:p-6 text-center transition-all ${
              activeTab === 'editor'
                ? 'bg-blue-50 border-b-2 border-blue-600'
                : 'hover:bg-gray-50'
            }`}
          >
            <Edit3 className="h-6 w-6 md:h-8 md:w-8 mx-auto mb-2 text-blue-600" />
            <div className={`text-sm md:text-base font-semibold ${
              activeTab === 'editor' ? 'text-blue-700' : 'text-gray-700'
            }`}>
              Edit Datasets
            </div>
            <div className="hidden md:block text-xs text-gray-500 mt-1">
              Edit properties
            </div>
          </button>

          <button
            onClick={() => setActiveTab('organizations')}
            className={`p-4 md:p-6 text-center transition-all ${
              activeTab === 'organizations'
                ? 'bg-blue-50 border-b-2 border-blue-600'
                : 'hover:bg-gray-50'
            }`}
          >
            <Building2 className="h-6 w-6 md:h-8 md:w-8 mx-auto mb-2 text-blue-600" />
            <div className={`text-sm md:text-base font-semibold ${
              activeTab === 'organizations' ? 'text-blue-700' : 'text-gray-700'
            }`}>
              Organizations
            </div>
            <div className="hidden md:block text-xs text-gray-500 mt-1">
              Manage organizations
            </div>
          </button>

          <button
            onClick={() => setActiveTab('manage')}
            className={`p-4 md:p-6 text-center transition-all ${
              activeTab === 'manage'
                ? 'bg-blue-50 border-b-2 border-blue-600'
                : 'hover:bg-gray-50'
            }`}
          >
            <Trash2 className="h-6 w-6 md:h-8 md:w-8 mx-auto mb-2 text-red-600" />
            <div className={`text-sm md:text-base font-semibold ${
              activeTab === 'manage' ? 'text-blue-700' : 'text-gray-700'
            }`}>
              Delete Datasets
            </div>
            <div className="hidden md:block text-xs text-gray-500 mt-1">
              Remove datasets
            </div>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'upload' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Upload PBB Data</h2>
          
          {/* Upload Mode Selector */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setUploadMode('multi')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                uploadMode === 'multi'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Files className="inline h-5 w-5 mr-2" />
              Multi-File Upload (Recommended)
            </button>
            <button
              onClick={() => setUploadMode('single')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                uploadMode === 'single'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <FileSpreadsheet className="inline h-5 w-5 mr-2" />
              Single File Upload (Legacy)
            </button>
          </div>

          {uploadMode === 'multi' ? (
            /* Multi File Upload (Your existing code) */
            <div className="space-y-6">
              {/* Dataset Name */}
              <div>
                <label htmlFor="datasetName" className="block text-sm font-medium text-gray-700 mb-2">
                  Dataset Name *
                </label>
                <input
                  type="text"
                  id="datasetName"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., FY 2024 Budget"
                />
              </div>

              {/* Population */}
              <div>
                <label htmlFor="population" className="block text-sm font-medium text-gray-700 mb-2">
                  Population *
                </label>
                <input
                  type="number"
                  id="population"
                  value={population}
                  onChange={(e) => setPopulation(parseInt(e.target.value) || 75000)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="75000"
                  min="1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Used to calculate per-capita costs in Taxpayer Dividend
                </p>
              </div>

              {/* NEW: Organization Selection */}
              <div>
                <label htmlFor="organization" className="block text-sm font-medium text-gray-700 mb-2">
                  Organization (Optional)
                </label>
                <select
                  id="organization"
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Standalone Dataset</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Assign this dataset to an organization to use its feature settings
                </p>
              </div>

              {/* Costs File */}
              <div>
                <label htmlFor="costsFile" className="block text-sm font-medium text-gray-700 mb-2">
                  Program Costs Revenue File (.xlsx) *
                </label>
                <input
                  type="file"
                  id="costsFile"
                  accept=".xlsx,.xls"
                  onChange={(e) => setCostsFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Should contain: Programs, Personnel, NonPersonnel, Revenue, Allocations sheets
                </p>
              </div>

              {/* Scores File */}
              <div>
                <label htmlFor="scoresFile" className="block text-sm font-medium text-gray-700 mb-2">
                  Program Scores File (.xlsx) *
                </label>
                <input
                  type="file"
                  id="scoresFile"
                  accept=".xlsx,.xls"
                  onChange={(e) => setScoresFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Should contain: Summary, Score sheets
                </p>
              </div>

              {/* Upload Button */}
              <button
                onClick={handleMultiUpload}
                disabled={multiUploading || !costsFile || !scoresFile || !datasetName}
                className={`w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${
                  multiUploading || !costsFile || !scoresFile || !datasetName
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {multiUploading ? (
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

              {/* Error/Success Messages */}
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
                      <p className="text-sm font-medium text-green-900">Upload Successful!</p>
                      <p className="text-sm text-green-700 mt-1">
                        Dataset: {multiResult.dataset_name}
                      </p>
                      <p className="text-sm text-green-700">
                        Population: {multiResult.population?.toLocaleString()}
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
            /* Single File Upload (Your existing code - PRESERVED) */
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

              {/* Error/Success Messages */}
              {error && (
                <div className="bg-red-50 p-4 rounded-md">
                  <div className="flex items-center">
                    <XCircle className="h-5 w-5 text-red-500 mr-3" />
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              )}

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
      )}

      {/* NEW: Dataset Editor Tab */}
      {activeTab === 'editor' && (
        <div className="bg-white rounded-lg shadow p-6">
          <DatasetEditor />
        </div>
      )}

      {/* NEW: Organizations Tab */}
      {activeTab === 'organizations' && (
        <div className="bg-white rounded-lg shadow p-6">
          <OrganizationManager />
        </div>
      )}

      {/* EXISTING: Dataset Management Section */}
      {activeTab === 'manage' && (
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
              <p>No datasets found. Upload your first dataset above!</p>
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
      )}
    </div>
  )
}