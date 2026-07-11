import type { ExerciseTemplate } from '@/types'
import ExercisePhaserGame from '@/game/ExercisePhaserGame'

interface Props {
  exercise: ExerciseTemplate
  onClose: () => void
}

const TIPS: Record<string, string[]> = {
  squat:         ['발 어깨 너비로 벌리기', '무릎은 발끝 방향으로', '허리 곧게 유지', '엉덩이가 무릎 높이까지'],
  calf_raise:    ['발 앞꿈치만 계단에 걸치기', '천천히 올라가고 내려오기', '최고점에서 1초 유지', '무릎 살짝 구부려도 OK'],
  bridge:        ['등을 바닥에 붙이고 눕기', '무릎 구부려 발 세우기', '엉덩이 들어올리기', '허리가 아닌 엉덩이로 버티기'],
  ankle:         ['발목 원 그리기 10회씩', '저항밴드 사용하면 효과 ↑', '통증 없는 범위에서 진행', '양발 모두 진행'],
  hip_flexor:    ['한 무릎 바닥에 대고 런지', '앞 무릎 90도 유지', '골반을 앞으로 밀어주기', '30초 유지, 천천히 호흡'],
  hamstring:     ['앉아서 한 발 뻗기', '허리 구부리지 않고 앞으로', '허벅지 뒷쪽 당기는 느낌 확인', '30초 유지'],
  achilles:      ['벽 짚고 발뒤꿈치 바닥에', '무릎 펴서 아킬레스 타깃', '무릎 굽히면 종아리 깊숙이', '각 30초씩'],
  pigeon:        ['엉덩이 완전히 열어주기', '상체는 바닥으로 천천히', '통증 아닌 당기는 느낌', '1분 유지'],
  jump_rope:     ['발목 힘으로 점프 (무릎 최소화)', '팔꿈치 90도 유지', '리듬감 있게 일정 속도', '1분 이상 목표'],
  broad_jump:    ['무릎 구부려 팔 당기기', '팔 스윙과 함께 폭발적으로', '앞으로 멀리 착지', '착지 시 무릎 쿠션'],
  tuck_jump:     ['최대한 높이 점프', '공중에서 무릎을 가슴 쪽으로', '착지할 때 무릎 쿠션', '연속으로 빠르게 반복'],
  split_squat:   ['앞 무릎 90도', '뒷발 의자에 올리면 불가리안', '몸통 곧게 유지', '앞 무릎이 발끝 넘지 않게'],
  plank:         ['팔꿈치 어깨 아래 위치', '몸이 일직선', '엉덩이 너무 올리거나 내리지 않기', '코어에 힘주며 호흡'],
  hip_hinge:     ['엉덩이를 뒤로 빼며 기울이기', '무릎 살짝 구부려 고정', '허리 중립 유지', '햄스트링 당기는 느낌 집중'],
  ball_handle:   ['손가락 끝으로 컨트롤', '시선은 앞 (공 보지 않기)', '낮게 빠르게 드리블', '양손 균형있게 연습'],
  layup:         ['3보 리듬: 받기-오른발-왼발-점프', '림 안쪽 벽에 부드럽게', '비어있는 손으로 보호', '양쪽 손 모두 연습'],
  rim_reach:     ['최대한 높이 점프', '팔 뻗어 림 터치 목표', '한 발 점프도 시도', '매일 기록해서 성장 확인'],
  barbell_squat: ['바는 승모근 위에 올려놓기', '발 어깨 너비+약간 넓게', '무릎 외측으로 밀면서 내려가기', '허리 아치 유지'],
  rdl:           ['바 몸에 가깝게 유지', '무릎 살짝 구부려 고정', '허리 곧게 유지하며 앞으로', '햄스트링 당기는 느낌 집중'],
  depth_jump:    ['박스 위에서 내려서기', '착지 즉시 반사적으로 점프', '지면 접촉 시간 최소화', '발목 힘으로 탄성 활용'],
  box_jump:      ['박스 앞 60cm 위치에 서기', '스쿼트 준비 자세', '폭발적으로 점프', '부드럽게 착지 (무릎 굽혀)'],
  squat_jump:    ['스쿼트 자세로 내려가기', '폭발적으로 최대한 높이', '팔 스윙으로 도움 주기', '착지 후 즉시 다시 스쿼트'],
  foam_roll:     ['천천히 문제 부위 찾기', '압통점에서 20-30초 멈추기', '근육 결 방향으로 롤링', '통증 7/10 이하로 유지'],
  dynamic:       ['큰 동작으로 관절 가열', '각 동작 10-15회 반복', '통증 없는 범위에서 진행', '점점 범위 늘려가기'],
  yoga:          ['호흡과 동작 연결하기', '각 자세 30-60초 유지', '근육 이완에 집중', '무리하지 말고 천천히'],
  single_hop:    ['한 발 착지 안정성 집중', '착지 시 무릎 살짝 굽히기', '균형 잃지 않고 멈추기', '양발 모두 연습'],
  lateral_bound: ['옆으로 최대한 멀리 도약', '한 발로 균형 있게 착지', '무릎 쿠션으로 충격 흡수', '좌우 균형있게'],
  hurdle:        ['무릎 높이 들어 허들 넘기', '엉덩이 회전 크게', '연속으로 빠르게 진행', '유연성과 폭발력 동시에'],
  ankle_bounce:  ['발목만 사용해서 통통 뛰기', '무릎은 거의 굽히지 않기', '접지 시간 최소화', '분당 180회 리듬 목표'],
  approach_jump: ['3-4걸음 도움닫기', '마지막 스텝에서 무릎 올리기', '팔을 위로 힘차게', '한 발 착지 후 양발 점프 가능'],
  vert_test:     ['최대로 손 뻗어 스탠딩 리치 측정', '전력 점프 후 최고 터치 측정', '3회 시도 후 최고값 기록', '매월 측정해 성장 확인'],
  power_clean:   ['폭발적인 풀 동작', '팔꿈치 빠르게 올리기', '발목·무릎·고관절 동시에', '무게보다 속도 집중'],
  plyo_pushup:   ['손이 바닥 떠날 만큼 폭발적으로', '착지 시 팔꿈치 살짝 구부려', '코어 단단히 유지', '속도 > 횟수'],
  dunk_attempt:  ['빠른 도움닫기로 탄성 활용', '점프 정점에서 팔 뻗기', '공을 림 안쪽으로 눌러넣기', '두려워하지 말고 과감하게!'],
  tip_dunk:      ['림 가까이서 공 잡기', '팔 뻗어 팁으로 넣기', '점프 타이밍이 전부', '손가락 끝의 감각 집중'],
  default:       ['호흡 고르게 유지하기', '정확한 자세 먼저, 무게는 그 다음', '통증이 있으면 즉시 중단', '꾸준함이 가장 중요'],
}

export default function ExerciseModal({ exercise, onClose }: Props) {
  const animKey = exercise.animType ?? 'default'
  const tips = TIPS[animKey] ?? TIPS.default

  const handleYoutube = () => {
    if (exercise.videoQuery) {
      const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(exercise.videoQuery)}`
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/85 z-30 flex items-center justify-center px-4 screen-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-dark-800 rounded-3xl w-full max-w-sm p-5 border border-gray-700/50 sheet-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-white font-black text-lg">{exercise.nameKo}</h3>
            <p className="text-gray-500 text-xs">{exercise.name}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="w-10 h-10 -mr-2 -mt-1 flex items-center justify-center text-gray-500 text-xl leading-none press"
          >✕</button>
        </div>

        {/* Phaser Animation */}
        <div className="rounded-2xl overflow-hidden mb-4 flex items-center justify-center bg-[#0d0d1f] border border-gray-700/30" style={{ height: 180 }}>
          <ExercisePhaserGame animType={animKey} />
        </div>

        {/* Set/Rep info */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <span className="bg-orange-500/20 text-orange-400 text-xs font-bold px-3 py-1.5 rounded-full">
            {exercise.sets}세트
          </span>
          {exercise.reps && (
            <span className="bg-dark-700 text-gray-300 text-xs font-bold px-3 py-1.5 rounded-full">
              × {exercise.reps}
            </span>
          )}
          {exercise.duration && (
            <span className="bg-dark-700 text-gray-300 text-xs font-bold px-3 py-1.5 rounded-full">
              {exercise.duration}
            </span>
          )}
          {exercise.weight && (
            <span className="bg-blue-500/20 text-blue-400 text-xs font-bold px-3 py-1.5 rounded-full">
              {exercise.weight}kg
            </span>
          )}
        </div>

        {/* Tips */}
        <div className="bg-dark-700 rounded-2xl p-4 mb-4">
          <p className="text-gray-400 text-xs font-bold mb-2 uppercase tracking-wide">핵심 포인트</p>
          <ul className="space-y-1.5">
            {(exercise.notes ? [exercise.notes, ...tips.slice(0, 3)] : tips).map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                <span className="text-orange-400 font-bold flex-shrink-0">{i + 1}.</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>

        {/* YouTube button */}
        {exercise.videoQuery && (
          <button
            onClick={handleYoutube}
            className="w-full flex items-center justify-center gap-2 bg-red-600/90 hover:bg-red-600 text-white font-bold py-3 rounded-2xl transition-all text-sm"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
              <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.8 15.5V8.5l6.2 3.5-6.2 3.5z" />
            </svg>
            유튜브에서 보기
          </button>
        )}
      </div>
    </div>
  )
}
