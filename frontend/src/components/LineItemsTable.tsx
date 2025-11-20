import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface LineItem {
  id: number
  cost_type: string
  acct_type: string
  acct_number: string
  fund: string
  item_cat1: string
  item_cat2: string
  num_items: number
  total_item_cost: number
  allocation_pct: number
}

interface LineItemsTableProps {
  programId: number
  datasetId: string
}

export function LineItemsTable({ programId, datasetId }: LineItemsTableProps) {
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [loading, setLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  const loadLineItems = async () => {
    if (hasLoaded) {
      // Just toggle if already loaded
      setIsExpanded(!isExpanded)
      return
    }

    setLoading(true)
    try {
      const response = await fetch(
        `http://localhost:8000/api/programs/${programId}/line-items?dataset_id=${datasetId}`
      )
      if (response.ok) {
        const data = await response.json()
        setLineItems(data.line_items || [])
        setHasLoaded(true)
        setIsExpanded(true)
      }
    } catch (error) {
      console.error('Error loading line items:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Toggle Button */}
      <button
        onClick={loadLineItems}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <span className="font-medium text-gray-900">View Line Items</span>
        <div className="flex items-center space-x-2">
          {loading && (
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          )}
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-600" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-600" />
          )}
        </div>
      </button>

      {/* Line Items Table */}
      {isExpanded && hasLoaded && (
        <div className="overflow-x-auto">
          {lineItems.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Cost Type
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Account
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Fund
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Category
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Items
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Cost
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Allocation
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {lineItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm text-gray-900">
                      {item.cost_type || '-'}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <div className="text-gray-900">{item.acct_type || '-'}</div>
                      {item.acct_number && (
                        <div className="text-xs text-gray-500">{item.acct_number}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900">
                      {item.fund || '-'}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <div className="text-gray-900">{item.item_cat1 || '-'}</div>
                      {item.item_cat2 && (
                        <div className="text-xs text-gray-500">{item.item_cat2}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-right text-gray-900">
                      {item.num_items || 0}
                    </td>
                    <td className="px-3 py-2 text-sm text-right font-medium text-gray-900">
                      {formatCurrency(item.total_item_cost || 0)}
                    </td>
                    <td className="px-3 py-2 text-sm text-right text-gray-600">
                      {formatPercent(item.allocation_pct || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={5} className="px-3 py-2 text-sm font-medium text-gray-900 text-right">
                    Total:
                  </td>
                  <td className="px-3 py-2 text-sm font-bold text-gray-900 text-right">
                    {formatCurrency(lineItems.reduce((sum, item) => sum + (item.total_item_cost || 0), 0))}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <div className="px-4 py-8 text-center text-gray-500">
              No line items found for this program
            </div>
          )}
        </div>
      )}
    </div>
  )
}