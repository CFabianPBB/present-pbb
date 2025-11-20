import { ScatterChart, Scatter, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, CartesianGrid, ZAxis, ReferenceLine } from 'recharts'
import { useState } from 'react'

interface ScatterData {
  id: number
  name: string
  size: number
  shade: number
  service_type?: string
  attribute_value?: number
  category?: number
  category_info?: {
    name: string
    preferred_recommendation: string
    strategic_guidance: string
  }
}

interface AttributeScatterPlotProps {
  data: ScatterData[]
  onPointClick?: (id: number) => void
  attributeLabel?: string
  showCategories?: boolean
  medianCost?: number  // Optional: use API-provided median instead of calculating locally
}

export function AttributeScatterPlot({ 
  data, 
  onPointClick, 
  attributeLabel = 'Attribute',
  showCategories = false,
  medianCost: providedMedianCost  // Rename to avoid shadowing
}: AttributeScatterPlotProps) {
  const [hoveredQuadrant, setHoveredQuadrant] = useState<string | null>(null)
  
  // Transform data for scatter chart
  const chartData = data.map((item) => ({
    x: Math.max(item.size, 1000), // Ensure minimum value of $1000 for log scale (avoids log(0))
    y: showCategories && item.category 
      ? item.category // Category number (1-16) when in category view
      : (item.attribute_value || (item.shade * 4 + 1)), // Attribute score (1-5) in attribute view
    z: Math.sqrt(item.size) / 50, // Bubble size based on budget
    ...item
  }))

  // Use provided median from API, or calculate from non-zero costs (matching backend logic)
  const medianCost = providedMedianCost ?? (() => {
    const nonZeroCosts = data
      .map(d => d.size)
      .filter(cost => cost > 0)  // Exclude $0 costs to match backend calculation
      .sort((a, b) => a - b)
    
    if (nonZeroCosts.length === 0) return 0
    
    return nonZeroCosts.length % 2 === 0
      ? (nonZeroCosts[nonZeroCosts.length / 2 - 1] + nonZeroCosts[nonZeroCosts.length / 2]) / 2
      : nonZeroCosts[Math.floor(nonZeroCosts.length / 2)]
  })()

  // Get color based on category or attribute intensity
  const getColor = (item: any) => {
    if (showCategories && item.category) {
      return getCategoryColor(item.category)
    }
    // Light blue to dark blue gradient based on shade
    const shade = item.shade
    const r = Math.floor(200 - (shade * 120))
    const g = Math.floor(220 - (shade * 100))
    const b = 255
    return `rgb(${r}, ${g}, ${b})`
  }

  // Category-based colors (grouped by strategic action)
  const getCategoryColor = (category: number) => {
    // Categories 1-4: Low Impact, Low Cost (Exit/Downsize) - Red tones
    if (category >= 1 && category <= 4) return '#ef4444' // red-500
    // Categories 5-8: Low Impact, High Cost (Review/Optimize) - Orange tones
    if (category >= 5 && category <= 8) return '#f97316' // orange-500
    // Categories 9-12: High Impact, Low Cost (Protect/Grow) - Green tones
    if (category >= 9 && category <= 12) return '#22c55e' // green-500
    // Categories 13-16: High Impact, High Cost (Core/Strategic) - Blue tones
    if (category >= 13 && category <= 16) return '#3b82f6' // blue-500
    return '#9ca3af' // gray-400 default
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border border-gray-300 rounded-md shadow-lg max-w-sm">
          <p className="font-semibold text-gray-900">{data.name}</p>
          <p className="text-sm text-gray-700 mt-1">
            Budget: <span className="font-medium">${(data.size || 0).toLocaleString()}</span>
          </p>
          {showCategories && data.category ? (
            <>
              <div className="mt-2 pt-2 border-t border-gray-200">
                <p className="text-sm font-bold text-gray-900">Category {data.category}</p>
                <p className="text-xs text-gray-700 mt-1">{data.category_info?.preferred_recommendation}</p>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-700">
              {attributeLabel}: <span className="font-medium">{data.attribute_value || Math.round(data.shade * 4 + 1)}</span> / 5
            </p>
          )}
          {data.service_type && (
            <p className="text-xs text-gray-600 mt-1">Type: {data.service_type}</p>
          )}
        </div>
      )
    }
    return null
  }

  const handleClick = (data: any) => {
    if (onPointClick && data.id) {
      onPointClick(data.id)
    }
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center text-gray-500 bg-gray-50 rounded-lg">
        <p>No data available</p>
      </div>
    )
  }

  // Calculate axis ranges
  const maxBudget = Math.max(...chartData.map(d => d.x))
  const budgetDomain = [0, maxBudget * 1.1] // Add 10% padding

  return (
    <div className="space-y-4">
      <div className="h-[500px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart 
            margin={{ top: 20, right: 30, bottom: 60, left: 80 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            
            {/* Quadrant dividers */}
            {showCategories && (
              <>
                <ReferenceLine 
                  x={medianCost} 
                  stroke="#94a3b8" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  label={{ value: 'Median Cost', position: 'top', fill: '#64748b', fontSize: 12 }}
                />
                {/* Category group dividers */}
                <ReferenceLine 
                  y={4.5} 
                  stroke="#dc2626" 
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  label={{ value: 'Categories 1-4', position: 'right', fill: '#dc2626', fontSize: 10 }}
                />
                <ReferenceLine 
                  y={8.5} 
                  stroke="#ea580c" 
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  label={{ value: 'Categories 5-8', position: 'right', fill: '#ea580c', fontSize: 10 }}
                />
                <ReferenceLine 
                  y={12.5} 
                  stroke="#16a34a" 
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  label={{ value: 'Categories 9-12', position: 'right', fill: '#16a34a', fontSize: 10 }}
                />
              </>
            )}
            
            <XAxis
              type="number"
              dataKey="x"
              name="Budget"
              scale="log"
              domain={[1000, 'auto']}
              allowDataOverflow={false}
              tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
              label={{ 
                value: 'Program Budget (Log Scale)', 
                position: 'bottom',
                offset: 40,
                style: { fontSize: '14px', fill: '#666' }
              }}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={showCategories ? 'Category' : attributeLabel}
              domain={showCategories ? [0, 17] : [0, 5.5]}
              ticks={showCategories ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] : [1, 2, 3, 4, 5]}
              label={{ 
                value: showCategories ? 'PBB Category (1-16)' : `${attributeLabel} Score`, 
                angle: -90, 
                position: 'insideLeft',
                offset: 10,
                style: { fontSize: '14px', fill: '#666', textAnchor: 'middle' }
              }}
              tick={{ fontSize: 11 }}
            />
            <ZAxis 
              type="number" 
              dataKey="z" 
              range={[50, 1000]}
              name="size"
            />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter
              data={chartData}
              fill="#3b82f6"
              onClick={handleClick}
              cursor="pointer"
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={getColor(entry)}
                  stroke="#fff"
                  strokeWidth={1.5}
                  opacity={0.8}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Legend and Interpretation Guide */}
      {!showCategories ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-6">
            {/* Color Legend */}
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900 mb-2">Reading this chart:</div>
              <div className="text-xs text-gray-700 space-y-1">
                <div>• <strong>Horizontal position</strong> = Program budget (logarithmic scale for better visibility)</div>
                <div>• <strong>Vertical position</strong> = {attributeLabel} score (bottom = lower, top = higher)</div>
                <div>• <strong>Bubble size</strong> = Budget amount</div>
                <div>• <strong>Color intensity</strong> = {attributeLabel} level (light = low, dark = high)</div>
              </div>
            </div>

            {/* Color Scale */}
            <div className="flex-shrink-0">
              <div className="text-sm font-medium text-gray-900 mb-2">{attributeLabel} Intensity:</div>
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: getColor({ shade: 0 }) }}></div>
                  <span className="text-xs text-gray-600">Low</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: getColor({ shade: 0.5 }) }}></div>
                  <span className="text-xs text-gray-600">Med</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: getColor({ shade: 1 }) }}></div>
                  <span className="text-xs text-gray-600">High</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-900 mb-3">PBB Category Legend:</div>
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-start space-x-2">
              <div className="w-4 h-4 rounded-full bg-red-500 flex-shrink-0 mt-0.5"></div>
              <div className="text-xs text-gray-700">
                <strong>Categories 1-4:</strong> Transform or transition - explore partnerships, cost recovery, and efficiency gains.
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <div className="w-4 h-4 rounded-full bg-orange-500 flex-shrink-0 mt-0.5"></div>
              <div className="text-xs text-gray-700">
                <strong>Categories 5-8:</strong> Right-size for sustainability - pursue efficiency improvements and alternative funding.
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <div className="w-4 h-4 rounded-full bg-green-500 flex-shrink-0 mt-0.5"></div>
              <div className="text-xs text-gray-700">
                <strong>Categories 9-12:</strong> Invest strategically - grow high-impact services through partnerships and earned revenue.
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <div className="w-4 h-4 rounded-full bg-blue-500 flex-shrink-0 mt-0.5"></div>
              <div className="text-xs text-gray-700">
                <strong>Categories 13-16:</strong> Protect and optimize - preserve essential services through operational excellence.
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-3">
            <strong>Note:</strong> The vertical axis shows category number (1-16). The horizontal axis uses a logarithmic scale to spread out low-cost programs. 
            The median cost line (vertical) divides Low Cost (left) from High Cost (right). Each category is based on Impact, Cost, Mandate, and Reliance dimensions.
          </p>
        </div>
      )}

      {/* Key Insights - only show when not in category mode */}
      {!showCategories && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="text-sm font-medium text-amber-900">🎯 High Priority + Low Budget</div>
            <div className="text-xs text-amber-800 mt-1">
              Programs in the <strong>upper-left</strong> may need more resources
            </div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="text-sm font-medium text-purple-900">💡 Low Priority + High Budget</div>
            <div className="text-xs text-purple-800 mt-1">
              Programs in the <strong>lower-right</strong> may warrant review
            </div>
          </div>
        </div>
      )}
    </div>
  )
}