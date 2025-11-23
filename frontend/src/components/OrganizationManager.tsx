import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Organization {
  id: string;
  name: string;
  created_at: string;
  show_priorities: boolean;
  show_taxpayer_dividend: boolean;
  show_strategic_overview: boolean;
  datasets: Dataset[];
}

interface Dataset {
  id: string;
  name: string;
  population: number;
  created_at: string;
}

const OrganizationManager: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Form states
  const [orgName, setOrgName] = useState('');
  const [showPriorities, setShowPriorities] = useState(true);
  const [showTaxpayerDividend, setShowTaxpayerDividend] = useState(true);
  const [showStrategicOverview, setShowStrategicOverview] = useState(true);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/organizations/');
      const data = await response.json();
      setOrganizations(data);
    } catch (error) {
      console.error('Error fetching organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrg = async () => {
    if (!orgName.trim()) {
      alert('Please enter an organization name');
      return;
    }

    try {
      const response = await fetch('/api/organizations/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: orgName,
          show_priorities: showPriorities,
          show_taxpayer_dividend: showTaxpayerDividend,
          show_strategic_overview: showStrategicOverview,
        }),
      });

      if (response.ok) {
        setShowCreateModal(false);
        resetForm();
        fetchOrganizations();
      } else {
        const error = await response.json();
        alert(error.detail || 'Error creating organization');
      }
    } catch (error) {
      console.error('Error creating organization:', error);
      alert('Error creating organization');
    }
  };

  const handleUpdateOrg = async () => {
    if (!selectedOrg) return;

    try {
      const response = await fetch(`/api/organizations/${selectedOrg.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: orgName,
          show_priorities: showPriorities,
          show_taxpayer_dividend: showTaxpayerDividend,
          show_strategic_overview: showStrategicOverview,
        }),
      });

      if (response.ok) {
        setShowEditModal(false);
        setSelectedOrg(null);
        resetForm();
        fetchOrganizations();
      } else {
        const error = await response.json();
        alert(error.detail || 'Error updating organization');
      }
    } catch (error) {
      console.error('Error updating organization:', error);
      alert('Error updating organization');
    }
  };

  const handleDeleteOrg = async (orgId: string, orgName: string) => {
    if (!confirm(`Are you sure you want to delete "${orgName}"? Associated datasets will become standalone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/organizations/${orgId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchOrganizations();
      } else {
        alert('Error deleting organization');
      }
    } catch (error) {
      console.error('Error deleting organization:', error);
      alert('Error deleting organization');
    }
  };

  const openEditModal = (org: Organization) => {
    setSelectedOrg(org);
    setOrgName(org.name);
    setShowPriorities(org.show_priorities);
    setShowTaxpayerDividend(org.show_taxpayer_dividend);
    setShowStrategicOverview(org.show_strategic_overview);
    setShowEditModal(true);
  };

  const resetForm = () => {
    setOrgName('');
    setShowPriorities(true);
    setShowTaxpayerDividend(true);
    setShowStrategicOverview(true);
  };

  const closeModals = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setSelectedOrg(null);
    resetForm();
  };

  if (loading) {
    return <div className="p-8">Loading organizations...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Manage Organizations</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + New Organization
        </button>
      </div>

      {organizations.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No organizations yet. Create one to get started!
        </div>
      ) : (
        <div className="space-y-6">
          {organizations.map((org) => (
            <motion.div
              key={org.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg shadow-lg p-6"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">{org.name}</h2>
                  <p className="text-sm text-gray-500">
                    Created: {new Date(org.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(org)}
                    className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteOrg(org.id, org.name)}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Feature Toggles Display */}
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-700 mb-2">Enabled Features:</h3>
                <div className="flex gap-4 flex-wrap">
                  <FeatureTag enabled={org.show_priorities} label="Priorities" />
                  <FeatureTag enabled={org.show_taxpayer_dividend} label="Taxpayer Dividend" />
                  <FeatureTag enabled={org.show_strategic_overview} label="Strategic Overview" />
                </div>
              </div>

              {/* Datasets List */}
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">
                  Datasets ({org.datasets.length})
                </h3>
                {org.datasets.length === 0 ? (
                  <p className="text-gray-500 text-sm">No datasets assigned to this organization</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {org.datasets.map((dataset) => (
                      <div key={dataset.id} className="p-3 bg-white border border-gray-200 rounded">
                        <p className="font-medium text-gray-900">{dataset.name}</p>
                        <p className="text-sm text-gray-500">
                          Population: {dataset.population.toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <Modal
            title="Create New Organization"
            onClose={closeModals}
            onSave={handleCreateOrg}
            saveLabel="Create"
          >
            <OrganizationForm
              orgName={orgName}
              setOrgName={setOrgName}
              showPriorities={showPriorities}
              setShowPriorities={setShowPriorities}
              showTaxpayerDividend={showTaxpayerDividend}
              setShowTaxpayerDividend={setShowTaxpayerDividend}
              showStrategicOverview={showStrategicOverview}
              setShowStrategicOverview={setShowStrategicOverview}
            />
          </Modal>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {showEditModal && (
          <Modal
            title="Edit Organization"
            onClose={closeModals}
            onSave={handleUpdateOrg}
            saveLabel="Save Changes"
          >
            <OrganizationForm
              orgName={orgName}
              setOrgName={setOrgName}
              showPriorities={showPriorities}
              setShowPriorities={setShowPriorities}
              showTaxpayerDividend={showTaxpayerDividend}
              setShowTaxpayerDividend={setShowTaxpayerDividend}
              showStrategicOverview={showStrategicOverview}
              setShowStrategicOverview={setShowStrategicOverview}
            />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
};

// Helper Components

const FeatureTag: React.FC<{ enabled: boolean; label: string }> = ({ enabled, label }) => (
  <span
    className={`px-3 py-1 rounded-full text-sm font-medium ${
      enabled
        ? 'bg-green-100 text-green-800'
        : 'bg-gray-100 text-gray-600 line-through'
    }`}
  >
    {label}
  </span>
);

interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onSave: () => void;
  saveLabel: string;
}

const Modal: React.FC<ModalProps> = ({ title, children, onClose, onSave, saveLabel }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    onClick={onClose}
  >
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
    >
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{title}</h2>
      {children}
      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={onClose}
          className="px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          {saveLabel}
        </button>
      </div>
    </motion.div>
  </motion.div>
);

interface OrganizationFormProps {
  orgName: string;
  setOrgName: (name: string) => void;
  showPriorities: boolean;
  setShowPriorities: (show: boolean) => void;
  showTaxpayerDividend: boolean;
  setShowTaxpayerDividend: (show: boolean) => void;
  showStrategicOverview: boolean;
  setShowStrategicOverview: (show: boolean) => void;
}

const OrganizationForm: React.FC<OrganizationFormProps> = ({
  orgName,
  setOrgName,
  showPriorities,
  setShowPriorities,
  showTaxpayerDividend,
  setShowTaxpayerDividend,
  showStrategicOverview,
  setShowStrategicOverview,
}) => (
  <div className="space-y-6">
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Organization Name *
      </label>
      <input
        type="text"
        value={orgName}
        onChange={(e) => setOrgName(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder="e.g., City of Springfield"
      />
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-3">
        Feature Visibility
      </label>
      <p className="text-sm text-gray-600 mb-4">
        Control which menu items appear for this organization's datasets
      </p>
      <div className="space-y-3">
        <ToggleSwitch
          label="Priorities"
          checked={showPriorities}
          onChange={setShowPriorities}
          description="Show the Priorities analysis page"
        />
        <ToggleSwitch
          label="Taxpayer Dividend"
          checked={showTaxpayerDividend}
          onChange={setShowTaxpayerDividend}
          description="Show the Taxpayer Dividend calculator"
        />
        <ToggleSwitch
          label="Strategic Overview"
          checked={showStrategicOverview}
          onChange={setShowStrategicOverview}
          description="Show the Strategic Overview dashboard"
        />
      </div>
    </div>
  </div>
);

interface ToggleSwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ label, checked, onChange, description }) => (
  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-blue-600' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
    <div className="flex-1">
      <p className="font-medium text-gray-900">{label}</p>
      {description && <p className="text-sm text-gray-600">{description}</p>}
    </div>
  </div>
);

export default OrganizationManager;