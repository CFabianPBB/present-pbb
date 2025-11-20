import { ScatterChart, Scatter, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts'

interface BubbleData {
  id: number
  name: string
  size: number
  shade: number
  radius?: number
  service_type?: string
  quartile?: string
}

interface BubbleChartProps {
  data: BubbleData[]
  onBubbleClick?: (id: number) => void
  colorLabel?: string
}

export function BubbleChart({ data, onBubbleClick, colorLabel = 'Value' }: BubbleChartProps) {
    // Transform data for scatter chart
    const chartData = data.map((item, index) => ({
        x: index % 10, // Distribute across x-axis
        y: Math.floor(index / 10), // Stack on y-axis
        z: Math.max(item.radius || Math.sqrt(item.size) / 100, 5), // Minimum size for visibility
        ...item
    }))
    
  const getColor = (shade: number) => {
    // Convert shade (0-1) to a color from light gray to dark blue
    const intensity = Math.floor(shade * 255)
    const lightness = 255 - intensity
    return `rgb(${lightness}, ${lightness}, 255)`
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border border-gray-300 rounded-md shadow-md">
          <p className="font-medium">{data.name}</p>
          <p className="text-sm text-gray-600">Budget: ${(data.size || 0).toLocaleString()}</p>
          <p className="text-sm text-gray-600">{colorLabel}: {(data.shade * 100).toFixed(0)}%</p>
          {data.service_type && (
            <p className="text-sm text-gray-600">Type: {data.service_type}</p>
          )}
          {data.quartile && (
            <p className="text-sm text-gray-600">Quartile: {data.quartile}</p>
          )}
        </div>
      )
    }
    return null
  }

  const handleClick = (data: any) => {
    if (onBubbleClick && data.id) {
      onBubbleClick(data.id)
    }
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        <p>No data available</p>
      </div>
    )
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <XAxis 
            type="number" 
            dataKey="x" 
            domain={[0, 10]}
            hide
          />
          <YAxis 
            type="number" 
            dataKey="y" 
            domain={[0, Math.ceil(data.length / 10)]}
            hide
          />
          <Tooltip content={<CustomTooltip />} />
          <Scatter
            dataKey="z"
            fill="#8884d8"
            onClick={handleClick}
            cursor="pointer"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.shade)} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      
      {/* Legend */}
      <div className="mt-4 flex items-center justify-between text-xs text-gray-600">
        <div className="flex items-center space-x-4">
          <span>Bubble size = Budget</span>
          <span>Color intensity = {colorLabel}</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-gray-200 rounded-full"></div>
          <span>Low</span>
          <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
          <div className="w-3 h-3 bg-blue-800 rounded-full"></div>
          <span>High</span>
        </div>
      </div>
    </div>
  )
}