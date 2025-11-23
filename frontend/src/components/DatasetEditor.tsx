import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Dataset {
  id: string;
  name: string;
  population: number;
  created_at: string;
  organization_id: string | null;
  organization_name: string | null;
}

interface Organization {
  id: string;
  name: string;
}

const DatasetEditor: React.FC = () => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Form states
  const [datasetName, setDatasetName] = useState('');
  const [population, setPopulation] = useState<number>(75000);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [datasetsRes, orgsRes] = await Promise.all([
        fetch('/api/datasets/'),
        fetch('/api/organizations/'),
      ]);

      const datasetsData = await datasetsRes.json();
      const orgsData = await orgsRes.json();

      setDatasets(datasetsData);
      setOrganizations(orgsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (dataset: Dataset) => {
    setSelectedDataset(dataset);
    setDatasetName(dataset.name);
    setPopulation(dataset.population);
    setSelectedOrgId(dataset.organization_id || '');
    setShowEditModal(true);
  };

  const handleUpdateDataset = async () => {
    if (!selectedDataset) return;

    if (!datasetName.trim()) {
      alert('Please enter a dataset name');
      return;
    }

    if (population <= 0) {
      alert('Population must be greater than 0');
      return;
    }

    try {
      const response = await fetch(`/api/datasets/${selectedDataset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: datasetName,
          population: population,
          organization_id: selectedOrgId || null,
        }),
      });

      if (response.ok) {
        setShowEditModal(false);
        setSelectedDataset(null);
        fetchData();
      } else {
        const error = await response.json();
        alert(error.detail || 'Error updating dataset');
      }
    } catch (error) {
      console.error('Error updating dataset:', error);
      alert('Error updating dataset');
    }
  };

  const closeModal = () => {
    setShowEditModal(false);
    setSelectedDataset(null);
    setDatasetName('');
    setPopulation(75000);
    setSelectedOrgId('');
  };

  if (loading) {
    return <div className="p-8">Loading datasets...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dataset Editor</h1>
        <p className="text-gray-600">
          Edit dataset properties and assign datasets to organizations
        </p>
      </div>

      {datasets.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No datasets available. Upload a dataset to get started!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {datasets.map((dataset) => (
            <motion.div
              key={dataset.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow"
            >
              <div className="mb-4">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{dataset.name}</h3>
                {dataset.organization_name && (
                  <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full mb-2">
                    {dataset.organization_name}
                  </span>
                )}
                {!dataset.organization_name && (
                  <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full mb-2">
                    Standalone
                  </span>
                )}
              </div>

              <div className="space-y-2 mb-4 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Population:</span>
                  <span className="font-medium">{dataset.population.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Created:</span>
                  <span className="font-medium">
                    {new Date(dataset.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <button
                onClick={() => openEditModal(dataset)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Edit Dataset
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <AnimatePresence>
        {showEditModal && selectedDataset && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg p-6 max-w-lg w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Edit Dataset</h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dataset Name *
                  </label>
                  <input
                    type="text"
                    value={datasetName}
                    onChange={(e) => setDatasetName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., FY 2024 Budget"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Population *
                  </label>
                  <input
                    type="number"
                    value={population}
                    onChange={(e) => setPopulation(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., 75000"
                    min="1"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Used to calculate per-capita costs in Taxpayer Dividend
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Organization
                  </label>
                  <select
                    value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Standalone (No Organization)</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-gray-500 mt-1">
                    Assign to an organization to use its feature settings
                  </p>
                </div>

                {selectedOrgId && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> This dataset will inherit the feature visibility
                      settings from the selected organization.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={closeModal}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateDataset}
                  className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DatasetEditor;