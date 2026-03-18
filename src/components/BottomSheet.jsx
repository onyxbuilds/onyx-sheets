// ── BOTTOM SHEET ──────────────────────────────────────────
// Reusable slide-up modal component
// Used for Add Row, Add Column, Edit Column etc

export default function BottomSheet({ title, onClose, children, tall }) {
  return (
      <div className="fixed inset-0 bg-black/70 flex items-end z-50">
            <div
                    className={`bg-gray-900 dark:bg-gray-900 w-full rounded-t-3xl p-6 space-y-4 overflow-y-auto ${
                              tall ? 'max-h-[90vh]' : 'max-h-[85vh]'
                                      }`}
                                            >
                                                    {/* Handle bar */}
                                                            <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto -mt-2 mb-2" />

                                                                    {/* Header */}
                                                                            <div className="flex items-center justify-between">
                                                                                      <h2 className="text-white font-bold text-lg">{title}</h2>
                                                                                                <button
                                                                                                            onClick={onClose}
                                                                                                                        className="text-gray-400 text-3xl w-10 h-10 flex items-center justify-center rounded-full active:bg-gray-800"
                                                                                                                                  >
                                                                                                                                              ×
                                                                                                                                                        </button>
                                                                                                                                                                </div>

                                                                                                                                                                        {/* Content */}
                                                                                                                                                                                {children}
                                                                                                                                                                                      </div>
                                                                                                                                                                                          </div>
                                                                                                                                                                                            )
                                                                                                                                                                                            }