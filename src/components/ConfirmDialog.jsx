// ── CONFIRM DIALOG ────────────────────────────────────────
// Reusable delete confirmation dialog
// Replaces window.confirm which doesn't work reliably on mobile

export default function ConfirmDialog({ message, onConfirm, onCancel, onThird, confirmLabel = 'Delete', cancelLabel = 'Cancel', thirdLabel }) {
          return (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] px-6">
                    <div className="bg-gray-800 rounded-2xl p-6 w-full space-y-4 shadow-2xl">
                            <p className="text-white text-base text-center leading-relaxed whitespace-pre-line">{message}</p>
                                    <div className="flex flex-col gap-2">
                                              <button
                                                          onClick={onConfirm}
                                                                      className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl text-base active:bg-indigo-700"
                                                                                >{confirmLabel}</button>
                                                                                          {thirdLabel && onThird && (
                                                                                                      <button
                                                                                                                    onClick={onThird}
                                                                                                                                  className="w-full bg-red-600 text-white font-semibold py-3 rounded-xl text-base active:bg-red-700"
                                                                                                                                              >{thirdLabel}</button>
                                                                                                                                                        )}
                                                                                                                                                                  <button
                                                                                                                                                                              onClick={onCancel}
                                                                                                                                                                                          className="w-full bg-gray-700 text-white font-semibold py-3 rounded-xl text-base active:bg-gray-600"
                                                                                                                                                                                                    >{cancelLabel}</button>
                                                                                                                                                                                                            </div>
                                                                                                                                                                                                                  </div>
                                                                                                                                                                                                                      </div>
                                                                                                                                                                                                                        )
                                                                                                                                                                                                                        }