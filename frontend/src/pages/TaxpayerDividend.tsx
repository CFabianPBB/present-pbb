import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { DollarSign, Users, TrendingUp, FileText, Zap } from 'lucide-react'
import { ProgramDetailModal } from '../components/ProgramDetailModal'
import WhereYourDollarGoes from '../components/WhereYourDollarGoes'
import { API_BASE_URL } from '../config/api';

interface Program {
  id: number
  name: string
  description: string
  total_cost: number
  per_capita_cost: number
  alignment_score: number
  alignment_label: string
}

interface Priority {
  id: number
  name: string
  group: string
  total_cost: number
  per_capita_cost: number
  program_count: number
  avg_alignment: number
  programs: Program[]
}

interface DividendData {
  dataset_id: string
  dataset_name: string
  population: number
  total_budget: number
  per_capita_total: number
  leverage_ratio: number
  total_priority_value: number
  community_priorities: {
    total_per_capita: number
    priorities: Priority[]
  }
  governance_priorities: {
    total_per_capita: number
    priorities: Priority[]
  }
}

interface TaxpayerDividendProps {
  lockedDatasetId?: string | null;
  isLocked?: boolean;
}

export default function TaxpayerDividend({ lockedDatasetId, isLocked }: TaxpayerDividendProps = {}) {
  const [data, setData] = useState<DividendData | null>(null)
  const [loading, setLoading] = useState(true)
  const [householdSize, setHouseholdSize] = useState(1)
  const [selectedPriority, setSelectedPriority] = useState<Priority | null>(null)
  const [modalPriority, setModalPriority] = useState<Priority | null>(null)
  

  useEffect(() => {
    const fetchDividendData = async () => {
      try {
        const datasetId = lockedDatasetId || localStorage.getItem('selectedDatasetId')
        console.log('Dataset ID from localStorage:', datasetId)
        
        if (!datasetId) {
          console.error('No dataset selected')
          setLoading(false)
          return
        }
        
        const url = `${API_BASE_URL}/api/charts/taxpayer-dividend?dataset_id=${datasetId}`
        console.log('Fetching from URL:', url)
        
        const response = await fetch(url)
        console.log('Response status:', response.status)
        
        const result = await response.json()
        console.log('Response data:', result)
        setData(result)
      } catch (error) {
        console.error('Error fetching dividend data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDividendData()

    // Also listen for storage changes (when dataset is changed)
    const handleStorageChange = () => {
      setLoading(true)
      fetchDividendData()
    }
    
    window.addEventListener('storage', handleStorageChange)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [lockedDatasetId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading your taxpayer dividend...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">No data available</div>
      </div>
    )
  }

  const householdTotal = data.per_capita_total * householdSize

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-3 sm:px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">Your Taxpayer Dividend</h1>
            <p className="text-base sm:text-lg md:text-xl text-blue-100 mb-6 sm:mb-8">
                See how your tax dollars deliver real value and results through Priority Based Budgeting for {data.dataset_name}
            </p>

            {/* Key Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 sm:p-6">
                <div className="flex items-center mb-2">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    <span className="text-xs sm:text-sm text-blue-100">Population</span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold">
                  {data.population.toLocaleString()}
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 sm:p-6">
                <div className="flex items-center mb-2">
                  <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  <span className="text-xs sm:text-sm text-blue-100">Total Budget</span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold">
                  ${(data.total_budget / 1000000).toFixed(1)}M
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 sm:p-6">
                <div className="flex items-center mb-2">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  <span className="text-xs sm:text-sm text-blue-100">Per Resident</span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold">
                  ${data.per_capita_total.toFixed(2)}
                </div>
              </div>

              <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg p-4 sm:p-6">
                <div className="flex items-center mb-2">
                  <Zap className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  <span className="text-xs sm:text-sm text-yellow-50">PBB Leverage Multiplier</span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold">
                  {data.leverage_ratio.toFixed(1)}x
                </div>
                <div className="text-xs sm:text-sm text-yellow-50 mt-1">
                  Your investment amplifying impact
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-12">
        {/* Household Calculator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white rounded-lg shadow-lg p-4 sm:p-6 md:p-8 mb-6 sm:mb-8"
        >
          <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Calculate Your Household's Investment</h2>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <label className="text-base sm:text-lg font-medium">Household Size:</label>
            <input
              type="number"
              min="1"
              max="20"
              value={householdSize}
              onChange={(e) => setHouseholdSize(parseInt(e.target.value) || 1)}
              className="w-20 sm:w-24 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-base sm:text-lg"
            />
            <div className="sm:ml-auto">
              <div className="text-xs sm:text-sm text-gray-600">Your household's share</div>
              <div className="text-2xl sm:text-3xl font-bold text-blue-600">
                ${householdTotal.toFixed(2)}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Investment Amplification - Progress Bars */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="bg-white rounded-lg shadow-lg p-4 sm:p-6 md:p-8 mb-6 sm:mb-8"
        >
          <div className="flex items-center mb-4 sm:mb-6">
            <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500 mr-2 sm:mr-3" />
            <h2 className="text-xl sm:text-2xl font-bold">Investment Amplification</h2>
          </div>
          
          <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
            Your tax dollars work harder through multi-purpose programs that deliver results across multiple community priorities simultaneously.
          </p>

          <div className="space-y-4 sm:space-y-6">
            {/* Direct Investment Bar - Baseline */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs sm:text-sm font-medium text-gray-700">Your Direct Investment</span>
                <span className="text-xs sm:text-sm font-bold text-gray-900">
                  ${data.per_capita_total.toFixed(2)} (1.0x)
                </span>
              </div>
              <div className="relative w-full bg-gray-100 rounded-lg h-6 sm:h-8">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(1 / data.leverage_ratio) * 100}%` }}
                  transition={{ duration: 1, delay: 0.3 }}
                  className="absolute h-6 sm:h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-md"
                />
              </div>
            </div>

            {/* Leveraged Value Bar - Shows the full multiplier effect */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs sm:text-sm font-medium text-gray-700">Total Value Delivered</span>
                <span className="text-xs sm:text-sm font-bold text-orange-600">
                  ${data.total_priority_value.toFixed(2)} ({data.leverage_ratio.toFixed(1)}x) 🚀
                </span>
              </div>
              <div className="relative w-full bg-gray-100 rounded-lg h-6 sm:h-8">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 1.2, delay: 0.5, type: 'spring' }}
                  className="absolute h-6 sm:h-8 bg-gradient-to-r from-yellow-400 via-orange-500 to-orange-600 rounded-lg shadow-lg"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 sm:mt-6 bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-orange-500 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-700">
              <strong>Leverage Effect Active!</strong> Multi-purpose programs amplify your ${data.per_capita_total.toFixed(2)} investment 
              to deliver ${data.total_priority_value.toFixed(2)} in community value—creating an additional{' '}
              <strong className="text-orange-600">
                ${(data.total_priority_value - data.per_capita_total).toFixed(2)}
              </strong> in results. That's a {((data.leverage_ratio - 1) * 100).toFixed(0)}% return on your investment!
            </p>
          </div>
        </motion.div>

        {/* Where Your Dollar Goes */}
        <WhereYourDollarGoes 
          communityPriorities={data.community_priorities.priorities}
          governancePriorities={data.governance_priorities.priorities}
          perCapitaTotal={data.per_capita_total}
        />

        {/* Citizen Dividend Receipt */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="bg-white rounded-lg shadow-lg p-4 sm:p-6 md:p-8 mb-6 sm:mb-8"
        >
          <div className="border-b-2 border-dashed border-gray-300 pb-4 sm:pb-6 mb-4 sm:mb-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold">{data.dataset_name.toUpperCase()}</h2>
                <p className="text-sm sm:text-base text-gray-600">SERVICES RENDERED - 2025</p>
              </div>
              <FileText className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400" />
            </div>
            <div className="text-base sm:text-lg">
              <span className="text-gray-600">Per Resident Investment:</span>
              <span className="font-bold ml-2">${data.per_capita_total.toFixed(2)}</span>
            </div>
            {householdSize > 1 && (
              <div className="text-base sm:text-lg">
                <span className="text-gray-600">Your Household ({householdSize} people):</span>
                <span className="font-bold ml-2">${householdTotal.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Community Priorities */}
          <div className="mb-6 sm:mb-8">
            <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span>COMMUNITY PRIORITIES</span>
              <span className="text-base sm:text-xl text-blue-600">
                ${data.community_priorities.total_per_capita.toFixed(2)} per resident
              </span>
            </h3>
            <div className="space-y-2 sm:space-y-3">
              {data.community_priorities.priorities.map((priority) => (
                <motion.div
                  key={priority.id}
                  whileHover={{ scale: 1.01 }}
                  className="border-l-4 border-blue-500 pl-3 sm:pl-4 py-2 cursor-pointer hover:bg-blue-50 transition-colors"
                  onClick={() => setSelectedPriority(selectedPriority?.id === priority.id ? null : priority)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                    <div className="flex-1">
                      <div className="font-medium sm:font-semibold text-sm sm:text-base">{priority.name}</div>
                      <div className="text-xs sm:text-sm text-gray-600">
                        {priority.program_count} programs • Alignment: {priority.avg_alignment}/4
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="font-bold text-sm sm:text-base text-blue-600">
                        ${priority.per_capita_cost.toFixed(2)}
                      </div>
                      {householdSize > 1 && (
                        <div className="text-xs sm:text-sm text-gray-600">
                          ${(priority.per_capita_cost * householdSize).toFixed(2)} household
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Expanded Program Details */}
                  {selectedPriority?.id === priority.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 sm:mt-4 ml-2 sm:ml-4 space-y-2"
                    >
                      <div className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">Programs:</div>
                      {priority.programs.slice(0, 5).map((program) => (
                        <div key={program.id} className="flex justify-between text-xs sm:text-sm pl-3 sm:pl-4 py-1 border-l-2 border-gray-300 gap-2">
                          <span className="text-gray-700 flex-1 min-w-0 truncate sm:truncate-0">{program.name}</span>
                          <span className="text-gray-600 whitespace-nowrap">${program.per_capita_cost.toFixed(2)}</span>
                        </div>
                      ))}
                      {priority.programs.length > 5 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setModalPriority(priority)
                          }}
                          className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 font-medium pl-3 sm:pl-4 hover:underline"
                        >
                          + {priority.programs.length - 5} more programs
                        </button>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Governance Priorities */}
          <div className="mb-6 sm:mb-8">
            <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span>GOVERNANCE PRIORITIES</span>
              <span className="text-base sm:text-xl text-blue-600">
                ${data.governance_priorities.total_per_capita.toFixed(2)} per resident
              </span>
            </h3>
            <div className="space-y-2 sm:space-y-3">
              {data.governance_priorities.priorities.map((priority) => (
                <motion.div
                  key={priority.id}
                  whileHover={{ scale: 1.01 }}
                  className="border-l-4 border-gray-500 pl-3 sm:pl-4 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setSelectedPriority(selectedPriority?.id === priority.id ? null : priority)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                    <div className="flex-1">
                      <div className="font-medium sm:font-semibold text-sm sm:text-base">{priority.name}</div>
                      <div className="text-xs sm:text-sm text-gray-600">
                        {priority.program_count} programs • Alignment: {priority.avg_alignment}/4
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="font-bold text-sm sm:text-base text-gray-600">
                        ${priority.per_capita_cost.toFixed(2)}
                      </div>
                      {householdSize > 1 && (
                        <div className="text-xs sm:text-sm text-gray-600">
                          ${(priority.per_capita_cost * householdSize).toFixed(2)} household
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expanded Program Details */}
                  {selectedPriority?.id === priority.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 sm:mt-4 ml-2 sm:ml-4 space-y-2"
                    >
                      <div className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">Programs:</div>
                      {priority.programs.slice(0, 5).map((program) => (
                        <div key={program.id} className="flex justify-between text-xs sm:text-sm pl-3 sm:pl-4 py-1 border-l-2 border-gray-300 gap-2">
                          <span className="text-gray-700 flex-1 min-w-0 truncate sm:truncate-0">{program.name}</span>
                          <span className="text-gray-600 whitespace-nowrap">${program.per_capita_cost.toFixed(2)}</span>
                        </div>
                      ))}
                      {priority.programs.length > 5 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setModalPriority(priority)
                          }}
                          className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 font-medium pl-3 sm:pl-4 hover:underline"
                        >
                          + {priority.programs.length - 5} more programs
                        </button>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="border-t-2 border-gray-800 pt-4 mt-6 sm:mt-8">
            <div className="flex items-center justify-between text-lg sm:text-xl font-bold">
              <span>TOTAL INVESTMENT</span>
              <span>${data.per_capita_total.toFixed(2)}</span>
            </div>
            {householdSize > 1 && (
              <div className="flex items-center justify-between text-base sm:text-lg text-gray-600 mt-2">
                <span>Your Household Total</span>
                <span>${householdTotal.toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="mt-6 sm:mt-8 text-center text-sm sm:text-base text-gray-600 italic">
            Thank you for investing in our community's future.
          </div>
        </motion.div>

        {/* Info Box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-6"
        >
          <h3 className="font-bold text-base sm:text-lg mb-3 sm:mb-4">About Your Taxpayer Dividend</h3>
          
          <div className="space-y-3 sm:space-y-4">
            <div>
              <h4 className="font-semibold text-sm sm:text-base text-gray-900 mb-1">Return on Results</h4>
              <p className="text-sm sm:text-base text-gray-700">
                This "dividend" represents the per-person value of services and programs funded by your community. 
                Unlike a traditional financial return, this is your <strong>return on results</strong> - the real-world 
                outcomes and services that make our community stronger.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-sm sm:text-base text-gray-900 mb-1">Leverage Dollars: Multiplying Impact</h4>
              <p className="text-sm sm:text-base text-gray-700 mb-2">
                Many programs deliver value across <strong>multiple priorities simultaneously</strong> - like a public safety program that also 
                promotes community development. These are "leverage dollars" where a single investment creates multiple benefits.
              </p>
              <p className="text-sm sm:text-base text-gray-700">
                <strong>How we calculate impact:</strong> Programs with high alignment (scores 3-4) contribute their full cost toward a priority. 
                Programs with medium alignment (score 2) contribute 50% of their cost. Programs with low alignment (score 1) contribute 25%. 
                This weighted approach ensures you see the true value each priority delivers while accounting for multi-purpose programs.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-sm sm:text-base text-gray-900 mb-1">Why Priority Totals May Exceed Your Per-Capita Share</h4>
              <p className="text-sm sm:text-base text-gray-700">
                If priority investments appear to sum to more than your per-resident total, that's the power of leverage dollars at work! 
                A single dollar serving multiple community priorities means your investment is working harder for you across different areas 
                of community wellbeing.
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Program Detail Modal */}
      <ProgramDetailModal 
        priority={modalPriority}
        onClose={() => setModalPriority(null)}
      />
    </div>
  )
}