import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import { DatasetPicker } from './DatasetPicker'
import tylerLogo from '../assets/talking-t-logo.svg'
import { API_BASE_URL } from '../config/api'

const navItems = [
  { path: '', label: 'Priorities' }, // Empty path for root
  { path: '/dividend', label: 'Taxpayer Dividend' },
  { path: '/attributes', label: 'Strategic Overview' },
  { path: '/admin', label: 'Admin' },
]

export function Navigation() {
  const location = useLocation()
  const [datasetName, setDatasetName] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  // Extract slug from URL if present
  // e.g., /flagstaff-az or /flagstaff-az/dividend -> slug = 'flagstaff-az'
  const pathParts = location.pathname.split('/').filter(Boolean)
  const potentialSlug = pathParts[0]
  
  // Check if first path part is a dataset slug (not a page name)
  const isLocked = potentialSlug && 
                   potentialSlug !== 'results' && 
                   potentialSlug !== 'dividend' && 
                   potentialSlug !== 'attributes' && 
                   potentialSlug !== 'admin'
  
  const slug = isLocked ? potentialSlug : null

  // Fetch dataset name when viewing a locked dataset page
  useEffect(() => {
    if (slug) {
      fetchDatasetName(slug)
    } else {
      setDatasetName(null)
    }
  }, [slug])

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const fetchDatasetName = async (datasetSlug: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/dataset/by-slug/${datasetSlug}`)
      if (response.ok) {
        const dataset = await response.json()
        setDatasetName(dataset.name)
      }
    } catch (error) {
      console.error('Error fetching dataset name:', error)
    }
  }

  return (
    <nav className="shadow-sm border-b" style={{ backgroundColor: '#003D79' }}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4 md:space-x-8 flex-1">
            {/* Tyler Technologies Logo */}
            <div className="flex items-center space-x-2 md:space-x-3">
              <img 
                src={tylerLogo} 
                alt="Tyler Technologies" 
                className="h-7 w-7 md:h-8 md:w-8"
              />
              <Link to="/" className="text-lg md:text-xl font-bold text-white hover:text-gray-200">
                Present PBB
              </Link>
              
              {/* Dataset Name - Only shown when viewing a specific dataset */}
              {datasetName && (
                <div className="hidden sm:flex items-center space-x-2 ml-3">
                  <span className="text-white text-opacity-50">|</span>
                  <span className="text-base md:text-lg font-semibold text-white truncate max-w-[200px] lg:max-w-none">
                    {datasetName}
                  </span>
                </div>
              )}
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex space-x-4">
              {navItems
                .filter(item => !isLocked || item.path !== '/admin')
                .map((item) => {
                // Build the path: if locked and not admin, prepend slug
                const path = (isLocked && item.path !== '/admin') 
                  ? `/${slug}${item.path}`
                  : (item.path || '/results')
                
                const isActive = location.pathname === path || 
                               (item.path === '' && location.pathname === `/${slug}`)
                
                return (
                  <Link
                    key={item.label}
                    to={path}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-white bg-opacity-20 text-white'
                        : 'text-white text-opacity-90 hover:text-white hover:bg-white hover:bg-opacity-10'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Right Side: Dataset Picker and Mobile Menu Button */}
          <div className="flex items-center space-x-2 md:space-x-4">
            {/* Only show DatasetPicker if not locked to a specific dataset */}
            {!isLocked && (
              <div className="hidden sm:block">
                <DatasetPicker />
              </div>
            )}
            
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-md text-white hover:bg-white hover:bg-opacity-10 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 space-y-2">
            {/* Dataset Name for Mobile */}
            {datasetName && (
              <div className="sm:hidden px-2 py-2 text-white text-opacity-70 text-sm border-b border-white border-opacity-20">
                {datasetName}
              </div>
            )}
            
            {/* Mobile Navigation Links */}
            {navItems
              .filter(item => !isLocked || item.path !== '/admin')
              .map((item) => {
                const path = (isLocked && item.path !== '/admin') 
                  ? `/${slug}${item.path}`
                  : (item.path || '/results')
                
                const isActive = location.pathname === path || 
                               (item.path === '' && location.pathname === `/${slug}`)
                
                return (
                  <Link
                    key={item.label}
                    to={path}
                    className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                      isActive
                        ? 'bg-white bg-opacity-20 text-white'
                        : 'text-white text-opacity-90 hover:text-white hover:bg-white hover:bg-opacity-10'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            
            {/* Dataset Picker for Mobile (if not locked) */}
            {!isLocked && (
              <div className="sm:hidden pt-2 border-t border-white border-opacity-20">
                <DatasetPicker />
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}