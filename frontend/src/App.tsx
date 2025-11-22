import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Navigation } from './components/Navigation'
import { DatasetRouter } from './components/DatasetRouter'
import { Results } from './pages/Results'
import { Attributes } from './pages/Attributes'
import TaxpayerDividend from './pages/TaxpayerDividend'
import { Admin } from './pages/Admin'
import './index.css'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
          <Routes>
            {/* Admin route - always full access */}
            <Route path="/admin" element={<Admin />} />
            
            {/* Dataset-specific routes - locked to one dataset */}
            <Route path="/:slug" element={
              <DatasetRouter>
                {(datasetId, isLocked) => <Results lockedDatasetId={datasetId} isLocked={isLocked} />}
              </DatasetRouter>
            } />
            
            <Route path="/:slug/attributes" element={
              <DatasetRouter>
                {(datasetId, isLocked) => <Attributes lockedDatasetId={datasetId} isLocked={isLocked} />}
              </DatasetRouter>
            } />
            
            <Route path="/:slug/dividend" element={
              <DatasetRouter>
                {(datasetId, isLocked) => <TaxpayerDividend lockedDatasetId={datasetId} isLocked={isLocked} />}
              </DatasetRouter>
            } />
            
            {/* Default routes - full dataset picker */}
            <Route path="/" element={<Results />} />
            <Route path="/results" element={<Results />} />
            <Route path="/attributes" element={<Attributes />} />
            <Route path="/dividend" element={<TaxpayerDividend />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App