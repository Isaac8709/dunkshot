import { useState } from 'react'
import { useGameStore } from '@/store/useGameStore'
import { estimateStandingReach, calculateDunkRequirement, getMotivationalMessage } from '@/utils/trainingCalculator'
import type { UserProfile } from '@/types'

const AVATARS = ['🔥', '⚡', '🌟', '🏃', '💪', '🦁', '🐉', '👑']

export default function SetupScreen() {
  const { setProfile, setScreen } = useGameStore()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: '',
    age: '',
    height: '',
    weight: '',
    currentVertical: '',
    armLength: '',
    avatar: '🔥',
  })

  const update = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const preview = () => {
    if (!form.height || !form.currentVertical) return null
    const h = parseFloat(form.height)
    const v = parseFloat(form.currentVertical)
    const arm = parseFloat(form.armLength) || 0
    const reach = estimateStandingReach(h, arm)
    const profile = {
      id: Date.now().toString(),
      name: form.name || '덩크 챌린저',
      age: parseInt(form.age) || 30,
      height: h,
      weight: parseFloat(form.weight) || 70,
      currentVertical: v,
      armLength: arm,
      standingReach: reach,
      createdAt: new Date().toISOString(),
      avatar: form.avatar,
    }
    return calculateDunkRequirement(profile)
  }

  const req = step >= 3 ? preview() : null

  const handleComplete = () => {
    const h = parseFloat(form.height)
    const arm = parseFloat(form.armLength) || 0
    const profile: UserProfile = {
      id: Date.now().toString(),
      name: form.name || '덩크 챌린저',
      age: parseInt(form.age) || 30,
      height: h,
      weight: parseFloat(form.weight) || 70,
      currentVertical: parseFloat(form.currentVertical) || 0,
      armLength: arm,
      standingReach: estimateStandingReach(h, arm),
      createdAt: new Date().toISOString(),
      avatar: form.avatar,
    }
    setProfile(profile)
    setScreen('menu')
  }

  return (
    <div className="fixed inset-0 arena-bg flex flex-col overflow-hidden safe-top safe-bottom">
      {/* Header */}
      <div className="px-6 pt-4 pb-3 flex items-center gap-3">
        {step > 1 && (
          <button onClick={() => setStep(s => s - 1)} className="text-gray-400 text-lg">←</button>
        )}
        <div className="flex-1">
          <h2 className="text-white font-black text-xl">캐릭터 설정</h2>
          <p className="text-gray-500 text-xs">정확한 분석을 위한 기본 정보</p>
        </div>
        {/* Progress dots */}
        <div className="flex gap-1.5">
          {[1, 2, 3].map(i => (
            <div key={i} className={`w-2 h-2 rounded-full transition-all ${
              i <= step ? 'bg-orange-500 w-4' : 'bg-gray-700'
            }`} />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {step === 1 && (
          <div className="space-y-5 screen-enter">
            <div className="text-center py-4">
              <p className="text-4xl mb-2">{form.avatar}</p>
              <p className="text-gray-400 text-sm">아바타를 선택하세요</p>
              <div className="flex justify-center gap-3 mt-3 flex-wrap">
                {AVATARS.map(a => (
                  <button key={a} onClick={() => update('avatar', a)}
                    className={`text-2xl p-2 rounded-xl transition-all ${
                      form.avatar === a ? 'bg-orange-500 scale-110' : 'bg-dark-700'
                    }`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-gray-400 text-xs font-bold mb-1 block">닉네임</label>
              <input
                type="text"
                placeholder="덩크 챌린저"
                value={form.name}
                onChange={e => update('name', e.target.value)}
                className="w-full bg-dark-700 text-white rounded-xl px-4 py-3 text-base border border-gray-700 focus:border-orange-500 outline-none"
                maxLength={12}
              />
            </div>

            <div>
              <label className="text-gray-400 text-xs font-bold mb-1 block">나이</label>
              <input
                type="number"
                placeholder="30"
                value={form.age}
                onChange={e => update('age', e.target.value)}
                className="w-full bg-dark-700 text-white rounded-xl px-4 py-3 text-base border border-gray-700 focus:border-orange-500 outline-none"
              />
            </div>

          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 screen-enter">
            <div className="card-dark p-4 text-center">
              <p className="text-orange-400 font-bold text-sm mb-1">🎯 덩크슛 분석을 위해</p>
              <p className="text-gray-400 text-xs">정확할수록 더 맞춤화된 훈련 계획이 나옵니다</p>
            </div>

            <div>
              <label className="text-gray-400 text-xs font-bold mb-1 block">키 (cm)</label>
              <input type="number" placeholder="175" value={form.height}
                onChange={e => update('height', e.target.value)}
                className="w-full bg-dark-700 text-white rounded-xl px-4 py-3 text-base border border-gray-700 focus:border-orange-500 outline-none" />
            </div>

            <div>
              <label className="text-gray-400 text-xs font-bold mb-1 block">몸무게 (kg)</label>
              <input type="number" placeholder="75" value={form.weight}
                onChange={e => update('weight', e.target.value)}
                className="w-full bg-dark-700 text-white rounded-xl px-4 py-3 text-base border border-gray-700 focus:border-orange-500 outline-none" />
            </div>

            <div>
              <label className="text-gray-400 text-xs font-bold mb-1 block">팔 길이 (cm) - 선택</label>
              <p className="text-gray-600 text-xs mb-2">어깨 끝 ~ 손끝 (없으면 키로 추정)</p>
              <input type="number" placeholder="80" value={form.armLength}
                onChange={e => update('armLength', e.target.value)}
                className="w-full bg-dark-700 text-white rounded-xl px-4 py-3 text-base border border-gray-700 focus:border-orange-500 outline-none" />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5 screen-enter">
            <div>
              <label className="text-gray-400 text-xs font-bold mb-1 block">
                현재 수직 점프 (cm)
              </label>
              <p className="text-gray-600 text-xs mb-2">
                제자리에서 점프 → 벽에 손바닥 최대한 높이 터치 → 서있을 때 높이와의 차이
              </p>
              <input type="number" placeholder="50" value={form.currentVertical}
                onChange={e => update('currentVertical', e.target.value)}
                className="w-full bg-dark-700 text-white rounded-xl px-4 py-3 text-base border border-gray-700 focus:border-orange-500 outline-none" />
            </div>

            {req && (
              <div className="card-dark p-5 space-y-3">
                <h3 className="text-orange-400 font-bold text-center text-base">📊 덩크슛 분석 결과</h3>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-dark-700 rounded-xl p-3 text-center">
                    <p className="text-gray-500 text-xs">스탠딩 리치</p>
                    <p className="text-white font-bold text-lg">{req.standingReach}<span className="text-xs text-gray-400">cm</span></p>
                  </div>
                  <div className="bg-dark-700 rounded-xl p-3 text-center">
                    <p className="text-gray-500 text-xs">필요 리치</p>
                    <p className="text-white font-bold text-lg">{req.requiredReach}<span className="text-xs text-gray-400">cm</span></p>
                  </div>
                  <div className="bg-dark-700 rounded-xl p-3 text-center">
                    <p className="text-gray-500 text-xs">현재 점프력</p>
                    <p className="text-green-400 font-bold text-lg">{req.currentVertical}<span className="text-xs text-gray-400">cm</span></p>
                  </div>
                  <div className="bg-dark-700 rounded-xl p-3 text-center">
                    <p className="text-gray-500 text-xs">{req.gap <= 0 ? '✅ 달성!' : '부족한 점프'}</p>
                    <p className={`font-bold text-lg ${req.gap <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {req.gap <= 0 ? '0' : req.gap}<span className="text-xs text-gray-400">cm</span>
                    </p>
                  </div>
                </div>

                {req.gap > 0 && (
                  <>
                    <div className="bg-dark-700 rounded-xl p-3 text-center">
                      <p className="text-gray-500 text-xs mb-1">예상 달성 기간</p>
                      <p className="text-orange-400 font-black text-2xl">{req.estimatedMonths}<span className="text-sm text-gray-400">개월</span></p>
                      <p className="text-gray-500 text-xs">꾸준한 훈련 기준</p>
                    </div>

                    {/* Progress bar */}
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>현재 점프력 달성률</span>
                        <span>{Math.round((req.currentVertical / req.requiredVertical) * 100)}%</span>
                      </div>
                      <div className="progress-bar-bg h-3">
                        <div className="progress-bar-fill h-full"
                          style={{ width: `${Math.min(100, (req.currentVertical / req.requiredVertical) * 100)}%` }} />
                      </div>
                    </div>
                  </>
                )}

                <p className="text-center text-sm text-gray-300 leading-relaxed">
                  {getMotivationalMessage(req.gap)}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky action footer — always visible, never hidden by scroll */}
      <div className="px-6 py-4 border-t border-white/10 bg-black/40 backdrop-blur safe-bottom">
        {step === 1 && (
          <button onClick={() => setStep(2)} disabled={!form.name}
            className="btn-neon w-full text-base font-bold disabled:opacity-40">
            다음 →
          </button>
        )}
        {step === 2 && (
          <button onClick={() => setStep(3)} disabled={!form.height}
            className="btn-neon w-full text-base font-bold disabled:opacity-40">
            다음 →
          </button>
        )}
        {step === 3 && (
          <button onClick={handleComplete} disabled={!form.currentVertical}
            className="btn-neon w-full text-base font-bold disabled:opacity-40">
            게임 시작! 🏀
          </button>
        )}
      </div>
    </div>
  )
}
