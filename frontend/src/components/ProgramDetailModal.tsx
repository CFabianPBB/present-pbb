import { motion, AnimatePresence } from 'framer-motion'
import { X, Receipt } from 'lucide-react'

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

interface ProgramDetailModalProps {
  priority: Priority | null
  onClose: () => void
}

export function ProgramDetailModal({ priority, onClose }: ProgramDetailModalProps) {
  if (!priority) return null

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
      />

      {/* Side Panel */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 h-full w-full md:w-2/3 lg:w-1/2 bg-white shadow-2xl z-50 overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 shadow-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <Receipt className="h-8 w-8" />
              <div>
                <h2 className="text-2xl font-bold">{priority.name}</h2>
                <p className="text-blue-100 text-sm mt-1">
                  {priority.programs.length} programs • Avg alignment: {priority.avg_alignment}/4
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Total Investment Banner */}
          <div className="mt-4 bg-white bg-opacity-20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-blue-100">Your Investment in This Priority</span>
              <span className="text-3xl font-bold">${priority.per_capita_cost.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Receipt Body */}
        <div className="p-6 space-y-4">
          {/* Programs List */}
          <div className="bg-white border-2 border-gray-200 rounded-lg shadow-sm">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <h3 className="font-bold text-gray-900 flex items-center justify-between">
                <span>PROGRAMS & SERVICES</span>
                <span className="text-sm text-gray-600">Per Capita Cost</span>
              </h3>
            </div>

            <div className="divide-y divide-gray-200">
              {priority.programs.map((program, index) => (
                <motion.div
                  key={program.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <h4 className="font-medium text-gray-900">{program.name}</h4>
                      {program.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {program.description}
                        </p>
                      )}
                      <div className="flex items-center mt-2 space-x-4">
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          Alignment: {program.alignment_label}
                        </span>
                        <span className="text-xs text-gray-500">
                          Total: ${(program.total_cost / 1000000).toFixed(2)}M
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg text-blue-600">
                        ${program.per_capita_cost.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Subtotal */}
            <div className="p-4 bg-gray-50 border-t-2 border-gray-300">
              <div className="flex items-center justify-between text-lg font-bold">
                <span>SUBTOTAL - {priority.name}</span>
                <span className="text-blue-600">${priority.per_capita_cost.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Thank You Message */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6"
          >
            <h3 className="font-bold text-xl text-gray-900 mb-3">
              Thank You for Your Investment 💙
            </h3>
            <p className="text-gray-700 mb-3">
              Your tax dollars are working to deliver these critical services and programs that 
              strengthen our community. Each program listed above represents a commitment to 
              achieving {priority.name.toLowerCase()}.
            </p>
            <p className="text-gray-700 mb-3">
              <strong>What "alignment" means:</strong> Programs with higher alignment scores 
              (3-4/4) are strongly focused on this priority, while those with medium alignment 
              (2/4) contribute partially. This weighted approach ensures transparency in how 
              every dollar serves our community's goals.
            </p>
            <p className="text-gray-700 italic">
              This is your <strong>return on results</strong> - real outcomes and services that 
              make our community stronger, safer, and more vibrant.
            </p>
          </motion.div>

          {/* Stats Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-600">{priority.programs.length}</div>
              <div className="text-sm text-gray-600 mt-1">Programs</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-600">{priority.avg_alignment.toFixed(1)}/4</div>
              <div className="text-sm text-gray-600 mt-1">Avg Alignment</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4">
          <button
            onClick={onClose}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}