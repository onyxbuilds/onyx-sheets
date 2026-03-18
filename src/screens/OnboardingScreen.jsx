// ── ONBOARDING SCREEN ─────────────────────────────────────
// Shown once after splash on first launch
// 3 swipeable feature cards + get started button

import { useState } from 'react'

const slides = [
  {
      icon: '⚡',
          title: 'Built for speed',
              body: 'Add rows faster than any spreadsheet app on mobile. Designed for your thumb, not a mouse.',
                  color: 'from-yellow-900 to-gray-950'
                    },
                      {
                          icon: '📱',
                              title: 'Touch native',
                                  body: 'Tap to edit. Swipe to navigate. Every interaction designed for a phone screen.',
                                      color: 'from-indigo-900 to-gray-950'
                                        },
                                          {
                                              icon: '🔒',
                                                  title: 'Your data, always',
                                                      body: 'Works completely offline. Your data is saved instantly and never lost.',
                                                          color: 'from-green-900 to-gray-950'
                                                            }
                                                            ]

                                                            export default function OnboardingScreen({ onDone }) {
                                                              const [current, setCurrent] = useState(0)

                                                                function next() {
                                                                    if (current < slides.length - 1) {
                                                                          setCurrent(current + 1)
                                                                              } else {
                                                                                    onDone()
                                                                                        }
                                                                                          }

                                                                                            function skip() {
                                                                                                onDone()
                                                                                                  }

                                                                                                    const slide = slides[current]

                                                                                                      return (
                                                                                                          <div className="fixed inset-0 bg-gray-950 flex flex-col z-[199]">

                                                                                                                {/* Skip button */}
                                                                                                                      <div className="flex justify-end px-6 pt-6">
                                                                                                                              <button
                                                                                                                                        onClick={skip}
                                                                                                                                                  className="text-gray-500 text-sm py-2 px-4"
                                                                                                                                                          >
                                                                                                                                                                    Skip
                                                                                                                                                                            </button>
                                                                                                                                                                                  </div>

                                                                                                                                                                                        {/* Slide content */}
                                                                                                                                                                                              <div className={`flex-1 flex flex-col items-center justify-center px-8 bg-gradient-to-b ${slide.color}`}>
                                                                                                                                                                                                      <div className="text-8xl mb-8">{slide.icon}</div>
                                                                                                                                                                                                              <h2 className="text-white text-3xl font-bold text-center mb-4">
                                                                                                                                                                                                                        {slide.title}
                                                                                                                                                                                                                                </h2>
                                                                                                                                                                                                                                        <p className="text-gray-400 text-base text-center leading-relaxed max-w-xs">
                                                                                                                                                                                                                                                  {slide.body}
                                                                                                                                                                                                                                                          </p>
                                                                                                                                                                                                                                                                </div>

                                                                                                                                                                                                                                                                      {/* Bottom controls */}
                                                                                                                                                                                                                                                                            <div className="px-6 pb-10 pt-6 space-y-4">

                                                                                                                                                                                                                                                                                    {/* Dots */}
                                                                                                                                                                                                                                                                                            <div className="flex justify-center gap-2">
                                                                                                                                                                                                                                                                                                      {slides.map((_, i) => (
                                                                                                                                                                                                                                                                                                                  <button
                                                                                                                                                                                                                                                                                                                                key={i}
                                                                                                                                                                                                                                                                                                                                              onClick={() => setCurrent(i)}
                                                                                                                                                                                                                                                                                                                                                            className={`rounded-full transition-all ${
                                                                                                                                                                                                                                                                                                                                                                            i === current
                                                                                                                                                                                                                                                                                                                                                                                              ? 'w-6 h-2 bg-indigo-500'
                                                                                                                                                                                                                                                                                                                                                                                                                : 'w-2 h-2 bg-gray-700'
                                                                                                                                                                                                                                                                                                                                                                                                                              }`}
                                                                                                                                                                                                                                                                                                                                                                                                                                          />
                                                                                                                                                                                                                                                                                                                                                                                                                                                    ))}
                                                                                                                                                                                                                                                                                                                                                                                                                                                            </div>

                                                                                                                                                                                                                                                                                                                                                                                                                                                                    {/* Next / Get Started button */}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            <button
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      onClick={next}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl text-base active:bg-indigo-700"
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        >
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  {current === slides.length - 1 ? 'Get Started →' : 'Next →'}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          </button>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      )
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      }