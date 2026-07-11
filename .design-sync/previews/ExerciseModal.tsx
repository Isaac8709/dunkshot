import { ExerciseModal } from 'dunk-shot'

// ExerciseModal is a full-screen modal (position: fixed) showing a workout
// exercise: header, an embedded Phaser animation panel, set/rep chips, key
// tips, and a YouTube link. In preview the Phaser engine is stubbed, so the
// animation panel is empty while the rest of the modal chrome is real.
//
// The wrapper sets a `transform`, which makes it the containing block for the
// modal's `position: fixed` — so the centered modal is framed inside the card
// (420x680, matching cfg.overrides) instead of escaping to the viewport.

const squat = {
  name: 'Bodyweight Squat',
  nameKo: '맨몸 스쿼트',
  sets: 4,
  reps: '15회',
  notes: '무릎이 발끝을 넘지 않도록 천천히 내려가기',
  videoQuery: '맨몸 스쿼트 정확한 자세',
  animType: 'squat',
}

export function Default() {
  return (
    <div style={{ position: 'relative', width: 420, height: 680, transform: 'translateZ(0)', overflow: 'hidden', background: '#0A0F1A' }}>
      <ExerciseModal exercise={squat} onClose={() => {}} />
    </div>
  )
}
