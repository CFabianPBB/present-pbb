import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Navigation } from './components/Navigation'
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
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Results />} />
            <Route path="/results" element={<Results />} />
            <Route path="/attributes" element={<Attributes />} />
            <Route path="/dividend" element={<TaxpayerDividend />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App