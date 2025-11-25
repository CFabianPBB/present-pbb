import { useState } from 'react'
import { ChevronDown, ChevronUp, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { API_BASE_URL } from '../config/api';

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

type SortField = 'cost_type' | 'acct_type' | 'fund' | 'item_cat1' | 'num_items' | 'total_item_cost' | 'allocation_pct'
type SortDirection = 'asc' | 'desc' | null

export function LineItemsTable({ programId, datasetId }: LineItemsTableProps) {
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [loading, setLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

  const loadLineItems = async () => {
    if (hasLoaded) {
      // Just toggle if already loaded
      setIsExpanded(!isExpanded)
      return
    }

    setLoading(true)
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/programs/${programId}/line-items?dataset_id=${datasetId}`
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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortDirection(null)
        setSortField(null)
      }
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getSortedLineItems = () => {
    if (!sortField || !sortDirection) {
      return lineItems
    }

    return [...lineItems].sort((a, b) => {
      let aVal = a[sortField]
      let bVal = b[sortField]

      // Handle null/empty values
      if (!aVal && !bVal) return 0
      if (!aVal) return sortDirection === 'asc' ? 1 : -1
      if (!bVal) return sortDirection === 'asc' ? -1 : 1

      // String comparison for text fields
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.toLowerCase().localeCompare(bVal.toLowerCase())
        return sortDirection === 'asc' ? comparison : -comparison
      }

      // Numeric comparison
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }

      return 0
    })
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
    return `${value.toFixed(1)}%`
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 text-gray-400" />
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="h-3 w-3 text-blue-600" />
    }
    return <ArrowDown className="h-3 w-3 text-blue-600" />
  }

  const sortedLineItems = getSortedLineItems()

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
                  <th 
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('cost_type')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Cost Type</span>
                      <SortIcon field="cost_type" />
                    </div>
                  </th>
                  <th 
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('acct_type')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Account</span>
                      <SortIcon field="acct_type" />
                    </div>
                  </th>
                  <th 
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('fund')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Fund</span>
                      <SortIcon field="fund" />
                    </div>
                  </th>
                  <th 
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('item_cat1')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Category</span>
                      <SortIcon field="item_cat1" />
                    </div>
                  </th>
                  <th 
                    className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('num_items')}
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>Items</span>
                      <SortIcon field="num_items" />
                    </div>
                  </th>
                  <th 
                    className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('total_item_cost')}
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>Cost</span>
                      <SortIcon field="total_item_cost" />
                    </div>
                  </th>
                  <th 
                    className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('allocation_pct')}
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>Allocation</span>
                      <SortIcon field="allocation_pct" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedLineItems.map((item) => (
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
                    {formatCurrency(sortedLineItems.reduce((sum, item) => sum + (item.total_item_cost || 0), 0))}
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