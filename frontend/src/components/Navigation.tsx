import { Link, useLocation } from 'react-router-dom'
import { DatasetPicker } from './DatasetPicker'
import tylerLogo from '../assets/talking-t-logo.svg'

const navItems = [
  { path: '', label: 'Priorities' }, // Empty path for root
  { path: '/dividend', label: 'Taxpayer Dividend' },
  { path: '/attributes', label: 'Strategic Overview' },
  { path: '/admin', label: 'Admin' },
]

export function Navigation() {
  const location = useLocation()
  
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

  return (
    <nav className="shadow-sm border-b" style={{ backgroundColor: '#003D79' }}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            {/* Tyler Technologies Logo */}
            <div className="flex items-center space-x-3">
              <img 
                src={tylerLogo} 
                alt="Tyler Technologies" 
                className="h-8 w-8"
              />
              <Link to="/" className="text-xl font-bold text-white hover:text-gray-200">
                Present PBB
              </Link>
            </div>
            
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

          <div className="flex items-center space-x-4">
            {/* Only show DatasetPicker if not locked to a specific dataset */}
            {!isLocked && <DatasetPicker />}
          </div>
        </div>
      </div>
    </nav>
  )
}