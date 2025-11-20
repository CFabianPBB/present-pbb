import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'

interface SpendingData {
  priority: string
  total_cost: number
  program_count: number
}

interface SpendingChartProps {
  data: SpendingData[]
  selectedPriority: string | null
  onPrioritySelect?: (priority: string) => void
}

export function SpendingChart({ data, selectedPriority, onPrioritySelect }: SpendingChartProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`
    }
    return `$${value.toFixed(0)}`
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border border-gray-300 rounded-md shadow-md">
          <p className="font-medium">{label}</p>
          <p className="text-sm text-blue-600">
            Total Spending: {formatCurrency(data.total_cost)}
          </p>
          <p className="text-sm text-gray-600">
            Programs: {data.program_count}
          </p>
        </div>
      )
    }
    return null
  }

  const handleBarClick = (data: SpendingData) => {
    if (onPrioritySelect) {
      onPrioritySelect(data.priority)
    }
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        <p>No spending data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <XAxis 
              dataKey="priority"
              angle={-45}
              textAnchor="end"
              height={80}
              interval={0}
              fontSize={12}
            />
            <YAxis 
              tickFormatter={formatCurrency}
              fontSize={12}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="total_cost"
              cursor="pointer"
              onClick={handleBarClick}
            >
              
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Priority List */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-700">Select Priority:</h3>
        <div className="space-y-1">
          {data.map((item) => (
            <button
              key={item.priority}
              onClick={() => onPrioritySelect?.(item.priority)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                selectedPriority === item.priority
                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-transparent'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-medium">{item.priority}</span>
                <span className="text-xs">{formatCurrency(item.total_cost)}</span>
              </div>
              <div className="text-xs opacity-75">
                {item.program_count} programs
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}