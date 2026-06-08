import { useState } from 'react'
import { useGameStore } from '@/store/useGameStore'
import type { DunkType } from '@/types'

const CATEGORY_LABELS = {
  basic: '기본',
  power: '파워',
  acrobatic: '아크로바틱',
  legendary: '전설',
}
const CATEGORY_COLORS = {
  basic: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  power: 'bg-red-500/20 text-red-400 border-red-500/30',
  acrobatic: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  legendary: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
}

function Stars({ count, max = 5 }: { count: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={i < count ? 'star-filled' : 'star-empty'}>★</span>
      ))}
    </div>
  )
}

function DunkCard({ dunk, onSelect }: { dunk: DunkType; onSelect: (d: DunkType) => void }) {
  return (
    <button
      onClick={() => onSelect(dunk)}
      className={`w-full text-left rounded-2xl p-4 transition-all active:scale-95 ${
        dunk.unlocked ? 'card-dark' : 'bg-dark-800/60'
      }`}
      style={{
        border: dunk.unlocked ? '1px solid rgba(255,107,0,0.3)' : '1px solid rgba(255,255,255,0.05)',
        opacity: dunk.unlocked ? 1 : 0.65,
      }}
    >
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${
          dunk.unlocked ? 'bg-dark-700' : 'bg-dark-800 grayscale'
        }`}>
          {dunk.unlocked ? dunk.icon : '🔒'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-bold text-sm">{dunk.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[dunk.category]}`}>
              {CATEGORY_LABELS[dunk.category]}
            </span>
          </div>
          <p className="text-gray-500 text-xs mt-0.5">{dunk.nameEn}</p>
          <div className="flex items-center gap-3 mt-1.5">
            <Stars count={dunk.difficulty} />
            <span className="text-xs bg-dark-700 text-gray-400 px-2 py-0.5 rounded-full">
              {dunk.unlocked ? dunk.controls : dunk.unlockCondition}
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}

export default function DunkDictScreen() {
  const { setScreen, getDunks } = useGameStore()
  const dunks = getDunks()
  const [selected, setSelected] = useState<DunkType | null>(null)
  const [filter, setFilter] = useState<DunkType['category'] | 'all'>('all')

  const filtered = filter === 'all' ? dunks : dunks.filter(d => d.category === filter)
  const unlockedCount = dunks.filter(d => d.unlocked).length

  return (
    <div className="fixed inset-0 arena-bg flex flex-col safe-top safe-bottom">
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <button onClick={() => setScreen('menu')} className="text-gray-400 text-xl">←</button>
        <div className="flex-1">
          <h2 className="text-white font-black text-xl">덩크 도감</h2>
          <p className="text-gray-500 text-xs">
            {unlockedCount}/{dunks.length} 해제 • 코트에서 덩크를 할수록 해제됩니다
          </p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-black text-orange-400">{unlockedCount}</span>
          <span className="text-gray-500 text-xs">/{dunks.length}</span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-5 mb-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['all', 'basic', 'power', 'acrobatic', 'legendary'] as const).map(cat => (
            <button key={cat} onClick={() => setFilter(cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filter === cat ? 'bg-orange-500 text-white' : 'bg-dark-700 text-gray-400'
              }`}>
              {cat === 'all' ? '전체' : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-5 mb-3">
        <div className="progress-bar-bg h-2">
          <div className="progress-bar-fill h-full" style={{ width: `${(unlockedCount / dunks.length) * 100}%` }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2">
        {filtered.map(dunk => (
          <DunkCard key={dunk.id} dunk={dunk} onSelect={setSelected} />
        ))}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/85 z-20 flex items-end" onClick={() => setSelected(null)}>
          <div
            className="bg-dark-800 rounded-t-3xl w-full p-6 safe-bottom"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-4 mb-5">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl ${
                selected.unlocked ? 'bg-dark-700' : 'bg-dark-800 grayscale'
              }`}>
                {selected.unlocked ? selected.icon : '🔒'}
              </div>
              <div className="flex-1">
                <h3 className="text-white font-black text-xl">{selected.name}</h3>
                <p className="text-gray-500 text-sm">{selected.nameEn}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Stars count={selected.difficulty} />
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[selected.category]}`}>
                    {CATEGORY_LABELS[selected.category]}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-dark-700 rounded-xl p-4">
                <p className="text-gray-400 text-xs mb-1 font-bold">설명</p>
                <p className="text-white text-sm leading-relaxed">{selected.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-dark-700 rounded-xl p-3">
                  <p className="text-gray-400 text-xs mb-1 font-bold">
                    {selected.unlocked ? '게임 조작' : '해제 조건'}
                  </p>
                  <p className={`font-bold text-sm ${selected.unlocked ? 'text-green-400' : 'text-orange-400'}`}>
                    {selected.unlocked ? selected.controls : selected.unlockCondition}
                  </p>
                </div>
                <div className="bg-dark-700 rounded-xl p-3">
                  <p className="text-gray-400 text-xs mb-1 font-bold">필요 점프력</p>
                  <p className="text-white font-bold text-sm">{selected.requiredVertical}cm</p>
                </div>
              </div>

              <div className="bg-dark-700 rounded-xl p-4">
                <p className="text-gray-400 text-xs mb-1 font-bold">🌟 유명한 덩크</p>
                <p className="text-yellow-400 text-sm">{selected.famous}</p>
              </div>

              {!selected.unlocked && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 text-center">
                  <p className="text-orange-400 text-sm font-bold">🔒 아직 잠겨 있습니다</p>
                  <p className="text-gray-500 text-xs mt-1">코트에서 덩크를 반복하면 해제됩니다</p>
                  <p className="text-gray-400 text-xs mt-0.5 font-medium">{selected.unlockCondition}</p>
                </div>
              )}
            </div>

            <button onClick={() => setSelected(null)} className="btn-ghost w-full mt-4">
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
