import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { COURT } from './Court3D'
import { Player3D, type PlayerHandle, makeIdlePose, type PlayerPose } from './Player3D'
import { Ball3D, type BallHandle } from './Ball3D'

/**
 * 2v2 pick & roll trainer.
 *
 * Cast: USER (ball handler, controlled) + SCREENER (AI teammate) vs
 * DEF_ON_BALL + DEF_ROLL (AI defenders).
 *
 * One rep = screener comes up → sets the screen → user drives off it →
 * screener rolls to the rim → user decides: LOB (pass) to the roller,
 * or finish himself (drive dunk / pull-up). The decision quality vs the
 * defense is what gets graded — that's the tactical lesson.
 */

export interface PlayEvent {
  grade: 'perfect' | 'good' | 'normal' | 'miss' | 'early'
  points: number
  label: string
  cue: string
}

interface TacticsWorldProps {
  heldKeys: Set<string>
  passTrigger: number
  finishTrigger: number
  repKey: number            // parent increments to start the next rep
  onPlayEvent: (ev: PlayEvent) => void
  onNetImpulse: () => void
  onPhaseHint: (hint: string) => void
}

type Phase = 'setup' | 'live' | 'lob' | 'rollerFinish' | 'selfDunk' | 'shot' | 'result'
type ScreenState = 'coming' | 'set' | 'rolling'

interface Actor {
  pos: THREE.Vector3
  facing: number
  stride: number
}

const RIM = new THREE.Vector3(0, 0, 0)
const START = {
  user:      new THREE.Vector3(0, 0, 6.8),
  screener:  new THREE.Vector3(2.3, 0, 4.8),
  defOnBall: new THREE.Vector3(0, 0, 5.4),
  defRoll:   new THREE.Vector3(1.9, 0, 3.6),
}

// yaw so the model (forward = +z) looks along direction d
const yawTo = (dx: number, dz: number) => Math.atan2(dx, dz)

function turnToward(a: Actor, targetYaw: number, rate: number) {
  let d = targetYaw - a.facing
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  a.facing += d * rate
}

/** Steer actor toward target; returns remaining distance. */
function seek(a: Actor, target: THREE.Vector3, speed: number, dt: number, sm: (r: number) => number) {
  const dx = target.x - a.pos.x
  const dz = target.z - a.pos.z
  const dist = Math.hypot(dx, dz)
  if (dist > 0.05) {
    const step = Math.min(dist, speed * dt)
    a.pos.x += (dx / dist) * step
    a.pos.z += (dz / dist) * step
    turnToward(a, yawTo(dx, dz), sm(12))
    a.stride += dt * (1 + speed * 0.28)
  }
  return dist
}

// ---- pose helpers (built on the idle pose so every field stays valid) ----

function runPose(a: Actor): PlayerPose {
  return { ...makeIdlePose(a.facing), phase: 'run', stride: a.stride, bodyPitch: 0.10 }
}
function idleFace(a: Actor): PlayerPose {
  return makeIdlePose(a.facing)
}
/** Defensive stance: crouched, arms wide. */
function defensePose(a: Actor): PlayerPose {
  const p = makeIdlePose(a.facing)
  return {
    ...p,
    bodyPitch: 0.18,
    legL: { hip: [-0.5, 0, 0.12], knee: 0.65 },
    legR: { hip: [-0.5, 0, -0.12], knee: 0.65 },
    armL: { shoulder: [-0.35, 0, 1.0], elbow: 0.5 },
    armR: { shoulder: [-0.35, 0, -1.0], elbow: 0.5 },
    ballHand: 'NONE',
  }
}
/** Screen stance: wide base, forearms crossed over the chest. */
function screenPose(a: Actor): PlayerPose {
  const p = makeIdlePose(a.facing)
  return {
    ...p,
    legL: { hip: [-0.35, 0, 0.28], knee: 0.45 },
    legR: { hip: [-0.35, 0, -0.28], knee: 0.45 },
    armL: { shoulder: [-1.1, 0.4, -0.5], elbow: 2.2 },
    armR: { shoulder: [-1.1, -0.4, 0.5], elbow: 2.2 },
    bodyPitch: 0.06,
    ballHand: 'NONE',
  }
}
/** Rolling with a hand up calling for the lob. */
function rollCallPose(a: Actor): PlayerPose {
  const p = runPose(a)
  return { ...p, armR: { shoulder: [-2.7, 0, -0.15], elbow: 0.15 }, ballHand: 'NONE' }
}
/** Mid-air catch → slam. t: 0..1 flight progress. */
function slamPose(facing: number, t: number, hasBall: boolean): PlayerPose {
  const p = makeIdlePose(facing)
  const up: [number, number, number] = [-2.9, 0, -0.15]
  const down: [number, number, number] = [-2.1, 0, -0.5]
  const k = t < 0.55 ? 0 : Math.min(1, (t - 0.55) / 0.25)
  const lerp3 = (a: [number, number, number], b: [number, number, number]): [number, number, number] =>
    [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
  return {
    ...p,
    phase: 'apex',
    armR: { shoulder: lerp3(up, down), elbow: 0.1 + 0.5 * k },
    armL: { shoulder: [-2.6 + 1.2 * k, 0, 0.3], elbow: 0.2 + 0.5 * k },
    legL: { hip: [-0.55, 0, 0.05], knee: 0.95 },
    legR: { hip: [-0.55, 0, -0.05], knee: 0.95 },
    headPitch: -0.3,
    ballHand: hasBall ? 'BOTH' : 'NONE',
  }
}

interface RepState {
  phase: Phase
  t: number
  screenState: ScreenState
  rollTimer: number        // time since roll started
  hedgeDur: number         // how long defRoll jumps at the handler
  switched: boolean        // defenders switched the screen
  screenSlow: number       // remaining "caught on screen" seconds for defOnBall
  // finish bookkeeping
  lobFrom: THREE.Vector3
  lobTo: THREE.Vector3
  lobDur: number
  finish: { make: boolean; ev: PlayEvent } | null
  jumpFrom: THREE.Vector3
  netPulsed: boolean
  resultShownAt: number
  hint: string
}

function freshRep(): RepState {
  return {
    phase: 'setup', t: 0, screenState: 'coming',
    rollTimer: 0, hedgeDur: 0.5 + Math.random() * 0.45,
    switched: Math.random() < 0.25, screenSlow: 0,
    lobFrom: new THREE.Vector3(), lobTo: new THREE.Vector3(), lobDur: 0.55,
    finish: null, jumpFrom: new THREE.Vector3(), netPulsed: false,
    resultShownAt: 0, hint: '',
  }
}

export function TacticsWorld({
  heldKeys, passTrigger, finishTrigger, repKey, onPlayEvent, onNetImpulse, onPhaseHint,
}: TacticsWorldProps) {
  const userRef = useRef<PlayerHandle>(null!)
  const screenerRef = useRef<PlayerHandle>(null!)
  const defOnBallRef = useRef<PlayerHandle>(null!)
  const defRollRef = useRef<PlayerHandle>(null!)
  const ballRef = useRef<BallHandle>(null!)
  const { camera } = useThree()

  const user = useRef<Actor>({ pos: START.user.clone(), facing: Math.PI, stride: 0 })
  const scr = useRef<Actor>({ pos: START.screener.clone(), facing: Math.PI, stride: 0 })
  const dOB = useRef<Actor>({ pos: START.defOnBall.clone(), facing: 0, stride: 0 })
  const dRL = useRef<Actor>({ pos: START.defRoll.clone(), facing: 0, stride: 0 })

  const rep = useRef<RepState>(freshRep())
  const lastPass = useRef(passTrigger)
  const lastFinish = useRef(finishTrigger)
  const dribble = useRef(0)
  const ballPos = useRef(new THREE.Vector3())
  const hintRef = useRef('')

  // New rep whenever the parent bumps repKey
  useEffect(() => {
    rep.current = freshRep()
    user.current.pos.copy(START.user); user.current.facing = Math.PI
    scr.current.pos.copy(START.screener)
    dOB.current.pos.copy(START.defOnBall)
    dRL.current.pos.copy(START.defRoll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repKey])

  const setHint = (h: string) => {
    if (hintRef.current !== h) { hintRef.current = h; onPhaseHint(h) }
  }

  useFrame((_, dt) => {
    const r = rep.current
    const U = user.current, S = scr.current, DB = dOB.current, DR = dRL.current
    if (!userRef.current || !ballRef.current) return
    const sm = (rate: number) => 1 - Math.exp(-rate * dt)
    r.t += dt

    // Which defender is responsible for the roller right now?
    const rollDefender = r.switched && r.screenState === 'rolling' ? DB : DR
    const rollerOpen = Math.hypot(S.pos.x - rollDefender.pos.x, S.pos.z - rollDefender.pos.z)
    const rollerToRim = Math.hypot(S.pos.x, S.pos.z)
    const userToRim = Math.hypot(U.pos.x, U.pos.z)
    const onBallDist = Math.hypot(U.pos.x - DB.pos.x, U.pos.z - DB.pos.z)

    // ================= SETUP =================
    if (r.phase === 'setup') {
      setHint('스크린이 올라옵니다 — 잠시 대기')
      userRef.current.setPose(idleFace(U))
      screenerRef.current.setPose(idleFace(S))
      defOnBallRef.current.setPose(defensePose(DB))
      defRollRef.current.setPose(defensePose(DR))
      const side = new THREE.Vector3(0.35, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), U.facing)
      ballPos.current.set(U.pos.x + side.x, 0.5, U.pos.z + side.z)
      ballRef.current.setPosition(ballPos.current)
      if (r.t > 0.7) { r.phase = 'live'; r.t = 0 }
    }

    // ================= LIVE =================
    if (r.phase === 'live') {
      // ---- user movement ----
      const v = new THREE.Vector3()
      if (heldKeys.has('ArrowUp')) v.z -= 1
      if (heldKeys.has('ArrowDown')) v.z += 1
      if (heldKeys.has('ArrowLeft')) v.x -= 1
      if (heldKeys.has('ArrowRight')) v.x += 1
      if (v.lengthSq() > 0) {
        v.normalize().multiplyScalar(5.5)
        U.pos.x = THREE.MathUtils.clamp(U.pos.x + v.x * dt, -COURT.width / 2 + 0.6, COURT.width / 2 - 0.6)
        U.pos.z = THREE.MathUtils.clamp(U.pos.z + v.z * dt, 0.6, 8.4)
        turnToward(U, yawTo(v.x, v.z), sm(13))
        U.stride += dt * 2.4
        userRef.current.setPose(runPose(U))
      } else {
        turnToward(U, yawTo(-U.pos.x, -U.pos.z), sm(6)) // drift back to facing the rim
        userRef.current.setPose(idleFace(U))
      }

      // ---- screener AI ----
      if (r.screenState === 'coming') {
        // set the screen on the defender's shoulder, on the user's right side
        const spot = new THREE.Vector3(DB.pos.x + 0.65, 0, DB.pos.z + 0.25)
        const d = seek(S, spot, 4.6, dt, sm)
        screenerRef.current.setPose(runPose(S))
        if (d < 0.18) {
          r.screenState = 'set'
          turnToward(S, yawTo(U.pos.x - S.pos.x, U.pos.z - S.pos.z), 1)
          setHint('스크린 SET! 스크린 쪽(오른쪽)으로 드리블 →')
        }
      } else if (r.screenState === 'set') {
        screenerRef.current.setPose(screenPose(S))
        // roll once the user drives past the screen plane
        const passedScreen = Math.hypot(U.pos.x - S.pos.x, U.pos.z - S.pos.z) < 1.5 ||
          (U.pos.x > S.pos.x - 0.4 && U.pos.z < S.pos.z + 0.3)
        if (passedScreen) {
          r.screenState = 'rolling'
          r.rollTimer = 0
          setHint(r.switched ? '수비 스위치! 롤러가 미스매치 — P로 패스!' : '롤! 롤러가 프리해지면 P로 패스')
        }
      } else {
        // rolling to the front of the rim
        r.rollTimer += dt
        seek(S, new THREE.Vector3(0.35, 0, 1.0), 5.0, dt, sm)
        screenerRef.current.setPose(rollCallPose(S))
      }

      // ---- on-ball defender AI ----
      {
        // stay between the user and the rim
        const guard = U.pos.clone().lerp(RIM, 0.22)
        // caught on the screen?
        const distToScreen = Math.hypot(DB.pos.x - S.pos.x, DB.pos.z - S.pos.z)
        if ((r.screenState === 'set' || (r.screenState === 'rolling' && r.rollTimer < 0.4)) && distToScreen < 0.95) {
          r.screenSlow = Math.max(r.screenSlow, 0.9)
        }
        r.screenSlow = Math.max(0, r.screenSlow - dt)
        const target = r.switched && r.screenState === 'rolling'
          ? S.pos.clone().lerp(RIM, 0.3)      // switched: this defender picks up the roller
          : guard
        const speed = (r.screenSlow > 0 ? 0.7 : 4.9)
        seek(DB, target, speed, dt, sm)
        turnToward(DB, yawTo(U.pos.x - DB.pos.x, U.pos.z - DB.pos.z), sm(10))
        defOnBallRef.current.setPose(r.screenSlow > 0 ? screenSlowPose(DB) : defensePose(DB))
      }

      // ---- roll defender AI ----
      {
        let target: THREE.Vector3
        if (r.screenState !== 'rolling') {
          target = S.pos.clone().lerp(RIM, 0.28)
        } else if (r.switched) {
          target = U.pos.clone().lerp(RIM, 0.22)  // switched onto the ball
        } else if (r.rollTimer < r.hedgeDur) {
          target = U.pos.clone().lerp(RIM, 0.12)  // hedge at the handler → window opens
        } else {
          target = S.pos.clone().lerp(RIM, 0.3)   // recover to the roller
        }
        seek(DR, target, 4.6, dt, sm)
        const watch = r.screenState === 'rolling' && !r.switched && r.rollTimer >= r.hedgeDur ? S : U
        turnToward(DR, yawTo(watch.pos.x - DR.pos.x, watch.pos.z - DR.pos.z), sm(10))
        defRollRef.current.setPose(defensePose(DR))
      }

      // ---- dribble ball ----
      dribble.current += dt * 4.5
      const bounce = Math.abs(Math.sin(dribble.current * Math.PI)) * 0.8
      const side = new THREE.Vector3(0.35, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), U.facing)
      ballPos.current.set(U.pos.x + side.x, 0.12 + bounce, U.pos.z + side.z)
      ballRef.current.setPosition(ballPos.current)
      ballRef.current.setSpin(2)

      // ---- PASS decision ----
      if (passTrigger !== lastPass.current) {
        lastPass.current = passTrigger
        if (r.screenState !== 'rolling') {
          r.finish = {
            make: false,
            ev: { grade: 'early', points: 10, label: '패스가 너무 빨라요', cue: '스크린을 타고 수비를 붙인 뒤, 롤이 시작되면 패스하세요' },
          }
          r.phase = 'result'; r.t = 0
          onPlayEvent(r.finish.ev)
        } else {
          const open = rollerOpen > 1.55
          let ev: PlayEvent
          let make = true
          if (open && rollerToRim < 4.8) {
            ev = { grade: 'perfect', points: 120, label: '앨리웁 성공! 교과서적인 픽앤롤', cue: '헤지 타이밍을 읽고 롤러가 림으로 다이브할 때 찔러줬어요' }
          } else if (open) {
            ev = { grade: 'good', points: 70, label: '오픈 패스 성공', cue: '조금 더 림 가까이서 주면 앨리웁이 됩니다' }
          } else if (Math.random() < 0.5) {
            ev = { grade: 'normal', points: 40, label: '터프 피니시', cue: '수비가 롤러에 붙어 있어요 — 이럴 땐 직접 마무리나 리셋이 정답' }
          } else {
            make = false
            ev = { grade: 'miss', points: 0, label: '패스 컷 당함!', cue: '롤러 수비와의 간격(1.5m+)을 확인하고 패스하세요' }
          }
          // launch the lob
          r.finish = { make, ev }
          r.lobFrom.copy(ballPos.current)
          const lead = Math.min(0.45, rollerToRim * 0.1)
          r.lobTo.set(S.pos.x * (1 - lead), make ? 2.6 : 1.4, S.pos.z * (1 - lead) + 0.4)
          r.lobDur = 0.45 + rollerToRim * 0.05
          r.phase = 'lob'; r.t = 0
        }
      }

      // ---- SELF FINISH decision ----
      if (finishTrigger !== lastFinish.current) {
        lastFinish.current = finishTrigger
        const open = onBallDist > 1.5
        let ev: PlayEvent
        let make = true
        if (userToRim < 2.9) {
          if (onBallDist > 1.9) ev = { grade: 'perfect', points: 100, label: '리젝트 드라이브 덩크!', cue: '수비가 스크린에 걸린 틈을 정확히 파고들었어요' }
          else if (open) ev = { grade: 'good', points: 60, label: '드라이브 덩크 성공', cue: '스크린을 더 타이트하게 스치면 완전한 오픈이 됩니다' }
          else if (Math.random() < 0.55) ev = { grade: 'normal', points: 40, label: '컨테스트 덩크', cue: '수비가 회복했어요 — 롤러 패스가 더 좋은 선택이었을 수도' }
          else { make = false; ev = { grade: 'miss', points: 0, label: '블락 위기! 실패', cue: '수비가 붙었을 땐 무리한 돌파보다 패스 아웃' } }
          r.finish = { make, ev }
          r.jumpFrom.copy(U.pos)
          r.phase = 'selfDunk'; r.t = 0
        } else {
          if (open && userToRim < 6.8) ev = { grade: 'good', points: 60, label: '풀업 점퍼!', cue: '스크린 뒤 공간에서의 풀업 — 정석 옵션입니다' }
          else if (Math.random() < 0.3) ev = { grade: 'normal', points: 30, label: '터프샷 성공', cue: '컨테스트 샷은 확률이 낮아요 — 스크린을 더 활용하세요' }
          else { make = false; ev = { grade: 'miss', points: 0, label: '샷 미스', cue: '수비 간격(1.5m+)을 만들고 쏘세요' } }
          r.finish = { make, ev }
          r.jumpFrom.copy(U.pos)
          r.phase = 'shot'; r.t = 0
        }
      }
    }

    // ================= LOB (ball in flight to roller) =================
    if (r.phase === 'lob') {
      const tn = Math.min(1, r.t / r.lobDur)
      const arcH = 1.3
      ballPos.current.lerpVectors(r.lobFrom, r.lobTo, tn)
      ballPos.current.y += Math.sin(tn * Math.PI) * arcH
      ballRef.current.setPosition(ballPos.current)
      ballRef.current.setSpin(3)
      // roller keeps diving; user holds follow-through
      seek(S, new THREE.Vector3(0.35, 0, 0.95), 4.6, dt, sm)
      screenerRef.current.setPose(rollCallPose(S))
      userRef.current.setPose({
        ...idleFace(U),
        armR: { shoulder: [-2.2, 0, -0.4], elbow: 0.25 }, ballHand: 'NONE',
      })
      stepDefendersIdle(dt, sm)
      if (tn >= 1) {
        if (!r.finish!.make) {
          // pass picked off: ball bounces away
          r.phase = 'result'; r.t = 0
          onPlayEvent(r.finish!.ev)
        } else {
          r.phase = 'rollerFinish'; r.t = 0
          r.jumpFrom.copy(S.pos)
        }
      }
    }

    // ================= ROLLER FINISH (catch → slam) =================
    if (r.phase === 'rollerFinish') {
      const dur = 0.65
      const tn = Math.min(1, r.t / dur)
      // roller root: parabola from jumpFrom to just in front of the rim
      const apex = COURT.rimY - 1.55
      const x = THREE.MathUtils.lerp(r.jumpFrom.x, 0, tn)
      const z = THREE.MathUtils.lerp(r.jumpFrom.z, 0.5, tn)
      const y = apex * Math.sin(tn * Math.PI)
      scr.current.pos.set(x, 0, z)
      screenerRef.current.group.position.set(x, y, z)
      turnToward(S, yawTo(-x, -z), sm(14))
      screenerRef.current.setPose(slamPose(S.facing, tn, tn < 0.6))
      // ball rides the hands, then through the net
      if (tn < 0.6) {
        const hand = new THREE.Vector3()
        screenerRef.current.getHandWorldPos('R', hand)
        ballRef.current.setPosition(hand)
      } else {
        const dropT = (tn - 0.6) / 0.4
        ballPos.current.set(0, COURT.rimY - 0.05 - dropT * 0.7, 0)
        ballRef.current.setPosition(ballPos.current)
        if (!r.netPulsed) { r.netPulsed = true; onNetImpulse() }
      }
      userRef.current.setPose(idleFace(U))
      stepDefendersIdle(dt, sm)
      if (tn >= 1) {
        screenerRef.current.group.position.set(x, 0, z)
        r.phase = 'result'; r.t = 0
        onPlayEvent(r.finish!.ev)
      }
    }

    // ================= SELF DUNK =================
    if (r.phase === 'selfDunk') {
      const dur = 0.7
      const tn = Math.min(1, r.t / dur)
      const apex = COURT.rimY - 1.5
      const x = THREE.MathUtils.lerp(r.jumpFrom.x, 0, tn)
      const z = THREE.MathUtils.lerp(r.jumpFrom.z, 0.55, tn)
      const y = (r.finish!.make ? apex : apex * 0.82) * Math.sin(tn * Math.PI)
      U.pos.set(x, 0, z)
      userRef.current.group.position.set(x, y, z)
      turnToward(U, yawTo(-x, -z), sm(14))
      userRef.current.setPose(slamPose(U.facing, tn, tn < 0.58))
      if (tn < 0.58) {
        const hand = new THREE.Vector3()
        userRef.current.getHandWorldPos('R', hand)
        ballRef.current.setPosition(hand)
      } else if (r.finish!.make) {
        const dropT = (tn - 0.58) / 0.42
        ballPos.current.set(0, COURT.rimY - 0.05 - dropT * 0.7, 0)
        ballRef.current.setPosition(ballPos.current)
        if (!r.netPulsed) { r.netPulsed = true; onNetImpulse() }
      } else {
        // clank off the front iron
        const u = (tn - 0.58) / 0.42
        ballPos.current.set(0.3 * u, COURT.rimY + 0.05 + 0.8 * u - 3.2 * u * u, 0.3 + u * 2.0)
        ballRef.current.setPosition(ballPos.current)
      }
      screenerRef.current.setPose(idleFace(S))
      stepDefendersIdle(dt, sm)
      if (tn >= 1) {
        userRef.current.group.position.set(x, 0, z)
        r.phase = 'result'; r.t = 0
        onPlayEvent(r.finish!.ev)
      }
    }

    // ================= JUMP SHOT =================
    if (r.phase === 'shot') {
      const jumpDur = 0.8
      const tn = Math.min(1, r.t / jumpDur)
      const y = 0.5 * Math.sin(Math.min(1, tn / 0.9) * Math.PI)
      userRef.current.group.position.set(U.pos.x, y, U.pos.z)
      turnToward(U, yawTo(-U.pos.x, -U.pos.z), sm(16))
      const rel = THREE.MathUtils.clamp((r.t - 0.28) / 0.12, 0, 1)
      userRef.current.setPose({
        ...idleFace(U),
        phase: 'apex',
        armR: { shoulder: [-1.0 - 1.4 * Math.min(1, r.t / 0.28) - 0.5 * rel, 0, -0.12], elbow: 1.9 * Math.min(1, r.t / 0.28) * (1 - rel) + 0.15 * rel },
        armL: { shoulder: [-1.2, 0, 0.35], elbow: 0.8 },
        ballHand: 'NONE',
      })
      if (r.t < 0.28) {
        // ball in the shooting hand until release; remember the release point
        const hand = new THREE.Vector3()
        userRef.current.getHandWorldPos('R', hand)
        ballPos.current.copy(hand)
        r.lobFrom.copy(hand)
        ballRef.current.setPosition(ballPos.current)
      } else {
        const flightT = 0.55 + Math.hypot(U.pos.x, U.pos.z) * 0.06
        const u = Math.min(1, (r.t - 0.28) / flightT)
        const target = r.finish!.make
          ? new THREE.Vector3(0, COURT.rimY - 0.02, 0)
          : new THREE.Vector3(0, COURT.rimY + 0.04, 0.22) // short — front iron
        const arc = new THREE.Vector3().lerpVectors(r.lobFrom, target, u)
        arc.y += Math.max(1.0, Math.hypot(U.pos.x, U.pos.z) * 0.3) * Math.sin(u * Math.PI)
        ballPos.current.copy(arc)
        ballRef.current.setPosition(arc)
        ballRef.current.setSpin(-2.5)
        if (u >= 1) {
          if (r.finish!.make && !r.netPulsed) { r.netPulsed = true; onNetImpulse() }
          r.phase = 'result'; r.t = 0
          onPlayEvent(r.finish!.ev)
        }
      }
      screenerRef.current.setPose(idleFace(S))
      stepDefendersIdle(dt, sm)
    }

    // ================= RESULT =================
    if (r.phase === 'result') {
      setHint('')
      userRef.current.setPose(idleFace(U))
      screenerRef.current.setPose(idleFace(S))
      stepDefendersIdle(dt, sm)
      // let the ball settle to the floor
      if (ballPos.current.y > 0.13) {
        ballPos.current.y = Math.max(0.13, ballPos.current.y - dt * 3)
        ballRef.current.setPosition(ballPos.current)
      }
    }

    // ---- write root positions for actors not being animated in flight ----
    if (r.phase !== 'selfDunk' && r.phase !== 'shot') userRef.current.group.position.set(U.pos.x, 0, U.pos.z)
    if (r.phase !== 'rollerFinish') screenerRef.current.group.position.set(S.pos.x, 0, S.pos.z)
    defOnBallRef.current.group.position.set(DB.pos.x, 0, DB.pos.z)
    defRollRef.current.group.position.set(DR.pos.x, 0, DR.pos.z)

    // ---- camera: same broadcast framing as the dunk lab ----
    const inAction = r.phase === 'lob' || r.phase === 'rollerFinish' || r.phase === 'selfDunk'
    const px = userRef.current.group.position.x
    const pz = userRef.current.group.position.z
    const camDist = Math.max(11.0, pz + 3.8, 9.5 + Math.abs(px) * 0.9)
    const desired = new THREE.Vector3(
      inAction ? THREE.MathUtils.clamp(px * 0.5, -2, 2) : px * 0.55,
      inAction ? 3.4 : 5.0 * (camDist / 11.0),
      inAction ? 8.2 : camDist,
    )
    camera.position.lerp(desired, sm(inAction ? 8 : 5))
    const look = new THREE.Vector3(
      inAction ? 0 : px * 0.5,
      inAction ? COURT.rimY - 0.4 : 1.15,
      inAction ? 0.5 : THREE.MathUtils.clamp(pz * 0.45, 0.8, 3.4),
    )
    const c = camera as THREE.PerspectiveCamera & { _lt?: THREE.Vector3 }
    if (!c._lt) c._lt = look.clone()
    c._lt.lerp(look, sm(6.5))
    camera.lookAt(c._lt)

    function stepDefendersIdle(dtl: number, sml: (r: number) => number) {
      // defenders sag back toward their men between actions
      seek(DB, U.pos.clone().lerp(RIM, 0.22), 3.4, dtl, sml)
      seek(DR, S.pos.clone().lerp(RIM, 0.28), 3.4, dtl, sml)
      defOnBallRef.current.setPose(defensePose(DB))
      defRollRef.current.setPose(defensePose(DR))
    }
  })

  return (
    <>
      {/* our team — arena orange */}
      <Player3D ref={userRef} jerseyColor="#FF4D1F" shortsColor="#FFFFFF" />
      <Player3D ref={screenerRef} jerseyColor="#FF8A4D" shortsColor="#FFFFFF" />
      {/* defenders — ice blue */}
      <Player3D ref={defOnBallRef} jerseyColor="#2E86AB" shortsColor="#0F2233" skinColor="#C98F63" />
      <Player3D ref={defRollRef} jerseyColor="#5BC0EB" shortsColor="#0F2233" skinColor="#8C5A33" />
      <Ball3D ref={ballRef} />
    </>
  )
}

/** Stumbling pose while caught on the screen. */
function screenSlowPose(a: Actor): PlayerPose {
  const p = makeIdlePose(a.facing)
  return {
    ...p,
    bodyPitch: 0.3,
    bodyRoll: 0.12,
    legL: { hip: [-0.6, 0, 0.1], knee: 0.9 },
    legR: { hip: [-0.2, 0, -0.1], knee: 0.3 },
    armL: { shoulder: [-0.9, 0, 0.7], elbow: 0.9 },
    armR: { shoulder: [-0.4, 0, -0.8], elbow: 0.6 },
    ballHand: 'NONE',
  }
}
