import { Link, useLocation } from 'react-router-dom'
import { DatasetPicker } from './DatasetPicker'
import tylerLogo from '../assets/talking-t-logo.svg'

const navItems = [
  { path: '/results', label: 'Priorities' },
  { path: '/dividend', label: 'Taxpayer Dividend' },
  { path: '/attributes', label: 'Strategic Overview' },
  { path: '/admin', label: 'Admin' },
]

export function Navigation() {
  const location = useLocation()

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
              <h1 className="text-xl font-bold text-white">Present PBB</h1>
            </div>
            
            <div className="hidden md:flex space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? 'bg-white bg-opacity-20 text-white'
                      : 'text-white text-opacity-90 hover:text-white hover:bg-white hover:bg-opacity-10'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <DatasetPicker />
          </div>
        </div>
      </div>
    </nav>
  )
}