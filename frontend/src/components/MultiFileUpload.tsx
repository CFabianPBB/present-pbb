import React, { useState } from 'react';
import { API_BASE_URL } from '../config/api';

interface UploadResult {
  success: boolean;
  message: string;
  dataset_id?: string;
  counts?: Record<string, number>;
  error?: string;
}

export default function MultiFileUpload() {
  const [costsFile, setCostsFile] = useState<File | null>(null);
  const [scoresFile, setScoresFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!costsFile || !scoresFile || !datasetName) {
      setResult({
        success: false,
        message: 'Please fill in all fields and select both files',
        error: 'Missing required fields'
      });
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('costs_file', costsFile);
      formData.append('scores_file', scoresFile);
      formData.append('dataset_name', datasetName);

      const response = await fetch(`${API_BASE_URL}/api/admin/upload-multi`, {
        method: 'POST',
        headers: {
          'X-Admin-Secret': 'change-me-in-production' // Using your admin secret
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message: data.message,
          dataset_id: data.dataset_id,
          counts: data.counts
        });
        // Reset form
        setCostsFile(null);
        setScoresFile(null);
        setDatasetName('');
      } else {
        setResult({
          success: false,
          message: 'Upload failed',
          error: data.detail || 'Unknown error'
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'Upload failed',
        error: error instanceof Error ? error.message : 'Network error'
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        Upload PBB Files
      </h2>
      
      <form onSubmit={handleUpload} className="space-y-6">
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

        {/* Costs File */}
        <div>
          <label htmlFor="costsFile" className="block text-sm font-medium text-gray-700 mb-2">
            Program Costs Revenue File (.xlsx)
          </label>
          <input
            type="file"
            id="costsFile"
            accept=".xlsx,.xls"
            onChange={(e) => setCostsFile(e.target.files?.[0] || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Should contain: Programs, Personnel, NonPersonnel, Revenue, Allocations_Cost, Allocations_Revenue sheets
          </p>
        </div>

        {/* Scores File */}
        <div>
          <label htmlFor="scoresFile" className="block text-sm font-medium text-gray-700 mb-2">
            Program Scores File (.xlsx)
          </label>
          <input
            type="file"
            id="scoresFile"
            accept=".xlsx,.xls"
            onChange={(e) => setScoresFile(e.target.files?.[0] || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Should contain: Summary, Score sheets
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={uploading}
          className={`w-full py-3 px-4 rounded-md font-medium ${
            uploading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700'
          } text-white transition duration-200`}
        >
          {uploading ? 'Uploading...' : 'Upload Files'}
        </button>
      </form>

      {/* Results */}
      {result && (
        <div className={`mt-6 p-4 rounded-md ${
          result.success 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          <h3 className={`font-medium ${
            result.success ? 'text-green-800' : 'text-red-800'
          }`}>
            {result.success ? '✅ Success!' : '❌ Error'}
          </h3>
          
          <p className={`mt-2 ${
            result.success ? 'text-green-700' : 'text-red-700'
          }`}>
            {result.message}
          </p>

          {result.success && result.dataset_id && (
            <div className="mt-3 text-green-700">
              <p><strong>Dataset ID:</strong> {result.dataset_id}</p>
              {result.counts && (
                <div className="mt-2">
                  <p><strong>Records Created:</strong></p>
                  <ul className="list-disc list-inside ml-4">
                    {Object.entries(result.counts).map(([key, value]) => (
                      <li key={key}>{key}: {value}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {!result.success && result.error && (
            <div className="mt-3 text-red-700">
              <p><strong>Error Details:</strong> {result.error}</p>
            </div>
          )}
        </div>
      )}

      {/* File Info */}
      {(costsFile || scoresFile) && (
        <div className="mt-6 p-4 bg-gray-50 rounded-md">
          <h4 className="font-medium text-gray-800 mb-2">Selected Files:</h4>
          {costsFile && (
            <p className="text-sm text-gray-600">
              📊 Costs: {costsFile.name} ({(costsFile.size / 1024 / 1024).toFixed(1)} MB)
            </p>
          )}
          {scoresFile && (
            <p className="text-sm text-gray-600">
              📈 Scores: {scoresFile.name} ({(scoresFile.size / 1024 / 1024).toFixed(1)} MB)
            </p>
          )}
        </div>
      )}
    </div>
  );
}