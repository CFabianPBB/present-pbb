import React, { useState } from 'react'
import { X, ChevronRight, ChevronLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// ============================================
// ADMIN: CUSTOMIZE ALL TEXT AND CONTENT HERE
// ============================================
const WELCOME_CONFIG = {
  // General settings
  cityName: "Flagstaff",
  totalBudget: "$488M",
  totalPrograms: 760,
  
  // Welcome screen
  welcome: {
    title: "Understanding Your City's Budget",
    subtitle: "Welcome to Priority-Based Budgeting",
    description: "Our city uses Priority-Based Budgeting to make spending decisions based on what matters most to our community. Explore how your budget aligns with priorities you care about.",
    ctaText: "Take the Tour",
    skipText: "Skip to Data"
  },
  
  // Tour slides
  tourSlides: [
    {
      title: "What Am I Looking At?",
      description: "Each colored box represents a city program. Bigger boxes = larger budgets. You're seeing all programs that make up your city budget.",
      icon: "📊",
      helpText: "Programs are grouped by department (like Water, Police, Fire). Click any department to see the programs inside."
    },
    {
      title: "Choose What Matters to You",
      description: "Select a priority from the dropdown (like Community Safety or Sustainable Community) to see how well each program aligns with what you care about.",
      icon: "🎯",
      helpText: "Darker colors mean stronger alignment. Light colors mean the program doesn't align as strongly with that priority."
    },
    {
      title: "Drill Down for Details",
      description: "Click on any department to zoom in and see individual programs. Click on a program to see full details including budget breakdown, staff, and priority scores.",
      icon: "🔍",
      helpText: "Use the breadcrumb at the top to navigate back to departments."
    },
    {
      title: "Search and Filter",
      description: "Use the search box to find specific programs (try 'water' or 'police'). Use filters to narrow by budget range, department, or performance quartile.",
      icon: "⚡",
      helpText: "Filters help you focus on what matters most. For example, filter to 'Q1' quartile to see only the highest-priority programs."
    },
    {
      title: "Your Voice Matters",
      description: "This data helps us make budget decisions based on community priorities. Your feedback shapes how we allocate resources.",
      icon: "💬",
      helpText: "Questions? Want to get involved? Find contact information and opportunities at the bottom of the page."
    }
  ],
  
  // Footer links
  footer: {
    contactEmail: "budget@flagstaff.az.gov",
    hearingDate: "March 15, 2024, 6pm",
    surveyUrl: "#"
  }
}

interface WelcomeModalProps {
  isOpen: boolean
  onClose: () => void
  totalPrograms?: number
  totalBudget?: string
}

export function WelcomeModal({ isOpen, onClose, totalPrograms, totalBudget }: WelcomeModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [showTour, setShowTour] = useState(false)
  
  // Use props if provided, otherwise fall back to config defaults
  const displayPrograms = totalPrograms || WELCOME_CONFIG.totalPrograms
  const displayBudget = totalBudget || WELCOME_CONFIG.totalBudget
  
  // Generate tour slides with dynamic values
  const tourSlides = [
    {
      ...WELCOME_CONFIG.tourSlides[0],
      description: `Each colored box represents a city program. Bigger boxes = larger budgets. You're seeing all ${displayPrograms} programs that make up our ${displayBudget} city budget.`
    },
    ...WELCOME_CONFIG.tourSlides.slice(1)
  ]
  
  const startTour = () => {
    setShowTour(true)
    setCurrentSlide(0)
  }
  
  const nextSlide = () => {
    if (currentSlide < tourSlides.length - 1) {
      setCurrentSlide(currentSlide + 1)
    } else {
      onClose()
    }
  }
  
  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1)
    }
  }
  
  const skipToData = () => {
    onClose()
  }
  
  if (!isOpen) return null
  
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black bg-opacity-50"
          onClick={onClose}
        />
        
        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
          
          {!showTour ? (
            // Welcome Screen
            <div className="p-8 md:p-12">
              <div className="text-center mb-8">
                <div className="text-5xl mb-4">🏛️</div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {WELCOME_CONFIG.welcome.title}
                </h1>
                <p className="text-lg text-blue-600 font-medium mb-4">
                  {WELCOME_CONFIG.welcome.subtitle}
                </p>
                <p className="text-gray-600 leading-relaxed max-w-xl mx-auto">
                  {WELCOME_CONFIG.welcome.description}
                </p>
              </div>
              
              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4 mb-8 max-w-md mx-auto">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {displayPrograms}
                  </div>
                  <div className="text-sm text-gray-600">Programs</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {displayBudget}
                  </div>
                  <div className="text-sm text-gray-600">Total Budget</div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={startTour}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  {WELCOME_CONFIG.welcome.ctaText}
                  <ChevronRight className="h-5 w-5" />
                </button>
                <button
                  onClick={skipToData}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  {WELCOME_CONFIG.welcome.skipText}
                </button>
              </div>
            </div>
          ) : (
            // Tour Slides
            <div className="relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSlide}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="p-8 md:p-12"
                >
                  {/* Progress bar */}
                  <div className="mb-8">
                    <div className="flex justify-between text-sm text-gray-500 mb-2">
                      <span>Step {currentSlide + 1} of {tourSlides.length}</span>
                      <span>{Math.round(((currentSlide + 1) / tourSlides.length) * 100)}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-blue-600"
                        initial={{ width: 0 }}
                        animate={{ width: `${((currentSlide + 1) / tourSlides.length) * 100}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>
                  
                  {/* Slide content */}
                  <div className="text-center mb-8">
                    <div className="text-6xl mb-6">
                      {tourSlides[currentSlide].icon}
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">
                      {tourSlides[currentSlide].title}
                    </h2>
                    <p className="text-gray-600 leading-relaxed mb-4 max-w-xl mx-auto">
                      {tourSlides[currentSlide].description}
                    </p>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-xl mx-auto">
                      <p className="text-sm text-blue-800">
                        💡 <strong>Tip:</strong> {tourSlides[currentSlide].helpText}
                      </p>
                    </div>
                  </div>
                  
                  {/* Navigation */}
                  <div className="flex justify-between items-center">
                    <button
                      onClick={prevSlide}
                      disabled={currentSlide === 0}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                        currentSlide === 0
                          ? 'text-gray-400 cursor-not-allowed'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <ChevronLeft className="h-5 w-5" />
                      Previous
                    </button>
                    
                    <button
                      onClick={skipToData}
                      className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      Skip tour
                    </button>
                    
                    <button
                      onClick={nextSlide}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                      {currentSlide === tourSlides.length - 1 ? "Get Started" : "Next"}
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}