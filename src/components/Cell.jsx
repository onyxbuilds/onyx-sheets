// Cell.jsx — Memoized cell component with formula autocomplete and keyboard toggle
import { useState, useRef, memo } from 'react'
import { getDisplayValue, isFormula, formatCellValue } from '../utils/formulas'

const FORMULAS = [
  { name: 'SUM', description: 'Add all numbers', example: '=SUM(A1:A10)' },
  { name: 'AVG', description: 'Average of numbers', example: '=AVG(A1:A10)' },
  { name: 'COUNT', description: 'Count non-empty cells', example: '=COUNT(A1:A10)' },
  { name: 'MIN', description: 'Smallest value', example: '=MIN(A1:A10)' },
  { name: 'MAX', description: 'Largest value', example: '=MAX(A1:A10)' },
]

const TAP_THRESHOLD = 6 // px — movement beyond this is a scroll, not a tap

const Cell = memo(function Cell({ row, col, rows, columns, onSave, isDark }) {
  const [isEditing, setIsEditing] = useState(false)
  const [localValue, setLocalValue] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [isNumericMode, setIsNumericMode] = useState(true)
  const inputRef = useRef(null)
  const inputType = useRef('text')
  const pointerStart = useRef(null)

  const rawValue = row.cells?.[col.id] || ''
  const displayValue = col.type === 'date'
    ? formatCellValue(rawValue, col.type)
    : getDisplayValue(rawValue, rows, columns)

  const text = isDark ? 'text-white' : 'text-gray-900'
  const cellBorder = isDark ? 'border-gray-900' : 'border-gray-200'

  function handleOpen() {
    if (!rawValue.startsWith('=') && col.type === 'date') {
      inputType.current = 'date'
    } else {
      inputType.current = 'text'
    }
    setIsNumericMode(col.type === 'number')
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

  function handlePointerDown(e) {
    pointerStart.current = { x: e.clientX, y: e.clientY }
  }

  function handlePointerUp(e) {
    if (!pointerStart.current) return
    const dx = Math.abs(e.clientX - pointerStart.current.x)
    const dy = Math.abs(e.clientY - pointerStart.current.y)
    pointerStart.current = null
    // Only open if it was a genuine tap (not a scroll)
    if (dx < TAP_THRESHOLD && dy < TAP_THRESHOLD) {
      handleOpen()
    }
  }

  function handleChange(e) {
    const val = e.target.value
    setLocalValue(val)
    if (val.startsWith('=')) {
      const typed = val.slice(1).toUpperCase()
      if (typed === '') {
        setSuggestions(FORMULAS)
      } else {
        setSuggestions(FORMULAS.filter(f => f.name.startsWith(typed)))
      }
    } else {
      setSuggestions([])
    }
  }

  function handleSelectFormula(formulaName) {
    const inserted = `=${formulaName}(:)`
    setLocalValue(inserted)
    setSuggestions([])
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        const cursorPos = formulaName.length + 2
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
            inputMode={col.type === 'number' && isNumericMode ? 'decimal' : 'text'}
            value={localValue}
            onChange={handleChange}
            onBlur={() => setTimeout(() => handleSave(), 150)}
            onKeyDown={handleKeyDown}
            className={`w-full px-4 py-3 text-sm outline-none ${
              isDark
                ? 'bg-indigo-950 text-white border-2 border-indigo-500'
                : 'bg-indigo-50 text-gray-900 border-2 border-indigo-400'
            }`}
            style={{ minHeight: '48px' }}
          />

          {/* Keyboard toggle for number cells */}
          {col.type === 'number' && (
            <button
              onPointerDown={e => {
                e.preventDefault()
                setIsNumericMode(prev => !prev)
                setTimeout(() => inputRef.current?.focus(), 0)
              }}
              className={`absolute right-1 top-1 text-xs px-2 py-1 rounded-lg z-10 active:opacity-70 ${
                isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'
              }`}
            >
              {isNumericMode ? '#→Aa' : 'Aa→#'}
            </button>
          )}

          {/* Formula autocomplete dropdown */}
          {suggestions.length > 0 && (
            <div
              ref={el => {
                if (!el) return
                const rect = el.getBoundingClientRect()
                const spaceBelow = window.innerHeight - rect.top
                if (spaceBelow < 200) {
                  el.style.top = 'auto'
                  el.style.bottom = '100%'
                } else {
                  el.style.top = '100%'
                  el.style.bottom = 'auto'
                }
              }}
              className={`absolute left-0 right-0 z-50 rounded-xl overflow-hidden shadow-2xl border ${
                isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
              }`}
              style={{ top: '100%', minWidth: '220px' }}
            >
              {suggestions.map((formula, index) => (
                <button
                  key={formula.name}
                  onPointerDown={e => {
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
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          className={`px-4 py-3 text-sm cursor-text min-h-12 flex items-center select-none ${
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
