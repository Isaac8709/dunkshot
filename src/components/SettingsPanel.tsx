import { useEffect, useState } from 'react'
import { audioManager, type AudioState } from '@/utils/audio'

interface Props {
  open: boolean
  onClose: () => void
}

export default function SettingsPanel({ open, onClose }: Props) {
  const [state, setState] = useState<AudioState>(audioManager.getState())

  useEffect(() => {
    const unsub = audioManager.subscribe(setState)
    return () => { unsub() }
  }, [])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm screen-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md card-premium m-3 p-5 screen-enter"
        style={{ borderRadius: '24px 24px 24px 24px' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="w-12 h-1 bg-white/15 rounded-full mx-auto mb-4" />

        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="eyebrow">⚙ SETTINGS</p>
            <h3 className="title-display text-2xl mt-1">사운드 설정</h3>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 text-white/60 press"
            aria-label="close"
          >
            ✕
          </button>
        </div>

        {/* BGM */}
        <div className="space-y-4">
          <Row
            label="배경음악 (BGM)"
            sub={
              state.bgmSource === 'file'  ? '🎵 사용자 음원 재생 중' :
              state.bgmSource === 'synth' ? '🎹 신스 BGM 재생 중 (파일 없음)' :
                                            '정지됨'
            }
            value={state.bgmVolume}
            muted={state.bgmMuted}
            onMuteToggle={() => audioManager.toggleBgmMute()}
            onChange={v => audioManager.setBgmVolume(v)}
            accent="#FF6B2C"
          />

          <Row
            label="효과음 (SFX)"
            sub="덩크, 콤보, 림 효과음"
            value={state.sfxVolume}
            muted={state.sfxMuted}
            onMuteToggle={() => audioManager.toggleSfxMute()}
            onChange={v => audioManager.setSfxVolume(v)}
            accent="#FFB627"
          />
        </div>

        {/* Info */}
        <div className="mt-5 p-3 rounded-xl bg-white/5 border border-white/10 text-xs leading-relaxed">
          <p className="text-white/70 font-bold mb-1">💡 본인 음원 사용하기</p>
          <p className="text-white/50">
            <code className="text-orange-300">public/audio/dunkshot.mp3</code> 위치에 본인이 보유한 음원 파일을 두면
            자동으로 재생됩니다. 없으면 저작권 free한 신스 BGM이 재생돼요.
          </p>
        </div>

        <button onClick={onClose} className="btn-primary w-full mt-5">
          확인
        </button>
      </div>
    </div>
  )
}

function Row(props: {
  label: string
  sub: string
  value: number
  muted: boolean
  onMuteToggle: () => void
  onChange: (v: number) => void
  accent: string
}) {
  const pct = Math.round(props.value * 100)
  return (
    <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-white font-bold text-sm">{props.label}</p>
          <p className="text-white/40 text-xs mt-0.5">{props.sub}</p>
        </div>
        <button
          onClick={props.onMuteToggle}
          className="w-10 h-10 rounded-xl text-lg press"
          style={{
            background: props.muted ? 'rgba(230,57,70,0.15)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${props.muted ? 'rgba(230,57,70,0.4)' : 'rgba(255,255,255,0.1)'}`,
            color: props.muted ? '#FF6B7A' : '#fff',
          }}
          aria-label={props.muted ? 'unmute' : 'mute'}
        >
          {props.muted ? '🔇' : '🔊'}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          value={props.muted ? 0 : pct}
          disabled={props.muted}
          onChange={e => props.onChange(parseInt(e.target.value) / 100)}
          className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(90deg, ${props.accent} 0%, ${props.accent} ${pct}%, rgba(255,255,255,0.08) ${pct}%, rgba(255,255,255,0.08) 100%)`,
          }}
        />
        <span className="text-white/60 text-xs font-mono w-10 text-right">{pct}%</span>
      </div>
    </div>
  )
}
