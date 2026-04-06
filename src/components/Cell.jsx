// Cell.jsx — Memoized cell component with formula autocomplete
import { useState, useRef, memo } from 'react'
import { getDisplayValue, isFormula, formatCellValue } from '../utils/formulas'

const FORMULAS = [
  { name: 'SUM', description: 'Add all numbers', example: '=SUM(A1:A10)' },
  { name: 'AVG', description: 'Average of numbers', example: '=AVG(A1:A10)' },
  { name: 'COUNT', description: 'Count non-empty cells', example: '=COUNT(A1:A10)' },
  { name: 'MIN', description: 'Smallest value', example: '=MIN(A1:A10)' },
  { name: 'MAX', description: 'Largest value', example: '=MAX(A1:A10)' },
]

const Cell = memo(function Cell({ row, col, rows, columns, onSave, isDark }) {
  const [isEditing, setIsEditing] = useState(false)
  const [localValue, setLocalValue] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const inputRef = useRef(null)
  const inputType = useRef('text')

  const rawValue = row.cells?.[col.id] || ''
  const displayValue = col.type === 'date'
    ? formatCellValue(rawValue, col.type)
    : getDisplayValue(rawValue, rows, columns)

  const text = isDark ? 'text-white' : 'text-gray-900'
  const cellBorder = isDark ? 'border-gray-900' : 'border-gray-200'

  function handleOpen() {
    if (!rawValue.startsWith('=') && col.type === 'date') {
      inputType.current = 'date'
    } else if (col.type === 'number') {
      inputType.current = 'text'
    } else {
      inputType.current = 'text'
    }
    setLocalValue(rawValue)
    setIsEditing(true)
    setSuggestions([])
    setTimeout(() => {
      inputRef.current?.focus()
      if (inputType.current === 'date') {
        inputRef.current?.showPicker?.()
      }
    }, 0)
  }

  function handleChange(e) {
    const val = e.target.value
    setLocalValue(val)

    // Show formula suggestions when = is typed
    if (val.startsWith('=')) {
      const typed = val.slice(1).toUpperCase()
      if (typed === '' ) {
        // Show all formulas when just = is typed
        setSuggestions(FORMULAS)
      } else {
        // Filter formulas by what's been typed after =
        const filtered = FORMULAS.filter(f => f.name.startsWith(typed))
        setSuggestions(filtered)
      }
    } else {
      setSuggestions([])
    }
  }

  function handleSelectFormula(formulaName) {
    // Insert formula with cursor positioned between the brackets
    const inserted = `=${formulaName}(:)`
    setLocalValue(inserted)
    setSuggestions([])
    // Focus input and position cursor between ( and :
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        // Position cursor after = and formula name and (
        const cursorPos = formulaName.length + 2 // = + name + (
        inputRef.current.setSelectionRange(cursorPos, cursorPos)
      }
    }, 0)
  }

  function handleSave() {
    setIsEditing(false)
    setSuggestions([])
    if (localValue !== rawValue) {
      onSave(row.id, col.id, localValue)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      if (suggestions.length > 0) {
        handleSelectFormula(suggestions[0].name)
      } else {
        handleSave()
      }
    }
    if (e.key === 'Escape') {
      setLocalValue(rawValue)
      setSuggestions([])
      setIsEditing(false)
    }
    if (e.key === 'Tab' && suggestions.length > 0) {
      e.preventDefault()
      handleSelectFormula(suggestions[0].name)
    }
  }

  const isError = String(displayValue).startsWith('#')
  const isFormulaCell = isFormula(rawValue)

  return (
    <td
      className={`border-l border-b ${cellBorder} relative`}
      style={{ minWidth: '140px', maxWidth: '140px' }}
    >
      {isEditing ? (
        <div className="relative">
          <input
            ref={inputRef}
            type={inputType.current}
            value={localValue}
            onChange={handleChange}
            onBlur={() => {
              // Small delay so tapping a suggestion registers before blur
              setTimeout(() => {
                handleSave()
              }, 150)
            }}
            onKeyDown={handleKeyDown}
            className={`w-full px-4 py-3 text-sm outline-none ${
              isDark
                ? 'bg-indigo-950 text-white border-2 border-indigo-500'
                : 'bg-indigo-50 text-gray-900 border-2 border-indigo-400'
            }`}
            style={{ minHeight: '48px' }}
          />

          {/* Formula autocomplete dropdown */}
          {suggestions.length > 0 && (
            <div
              className={`absolute left-0 right-0 z-50 rounded-xl overflow-hidden shadow-2xl border ${
                isDark
                  ? 'bg-gray-900 border-gray-700'
                  : 'bg-white border-gray-200'
              }`}
              style={{ top: '100%', minWidth: '220px' }}
            >
              {suggestions.map((formula, index) => (
                <button
                  key={formula.name}
                  onPointerDown={(e) => {
                    e.preventDefault()
                    handleSelectFormula(formula.name)
                  }}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 active:opacity-70 ${
                    index < suggestions.length - 1
                      ? isDark ? 'border-b border-gray-800' : 'border-b border-gray-100'
                      : ''
                  } ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-bold font-mono ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                      ={formula.name}( )
                    </div>
                    <div className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {formula.description}
                    </div>
                    <div className={`text-xs mt-0.5 font-mono ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                      {formula.example}
                    </div>
                  </div>
                </button>
              ))}
              <div className={`px-4 py-2 text-xs ${isDark ? 'text-gray-600 bg-gray-950' : 'text-gray-400 bg-gray-50'}`}>
                Tap to insert · Enter to select first
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          onPointerDown={handleOpen}
          className={`px-4 py-3 text-sm cursor-text min-h-12 flex items-center ${
            isError
              ? 'text-red-400 font-mono'
              : isFormulaCell
              ? isDark ? 'text-indigo-300' : 'text-indigo-600'
              : text
          }`}
        >
          {displayValue || (
            <span className={`text-xs ${isDark ? 'text-gray-700' : 'text-gray-300'}`}>
              tap to edit
            </span>
          )}
        </div>
      )}
    </td>
  )
})

export default Cell
