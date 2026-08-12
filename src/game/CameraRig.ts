import { PerspectiveCamera, Vector3 } from 'three';
import { damp } from '../core/Loop';
import { TUNING } from './tuning';

const TWO_PI = Math.PI * 2;

/**
 * far/near 비율. 24비트 깊이 버퍼에서 z-fighting이 안 나는 선.
 * 이 값이 곧 깊이 정밀도다 — 키우면 near가 작아져 카메라가 벽에 덜 박히지만
 * 먼 거리의 깊이가 뭉개진다.
 */
const DEPTH_RATIO = 12_500;

/** 각도 차이를 -π..π로 감아준다. 이걸 빼먹으면 360도 헛돈다. */
function shortestAngle(from: number, to: number): number {
  return ((to - from + Math.PI * 3) % TWO_PI) - Math.PI;
}

/**
 * 지금까지의 카메라 배치를 극좌표로 바꾼 값.
 *
 * 예전 코드는 `distance = radius*7.5 + 0.35`, `height = radius*3.2 + 0.15` 였다.
 * 상하 시점을 넣으려면 각도를 바꿔야 하는데, 그러려면 이 둘을 (반지름, 각도)로
 * 다시 써야 한다. `pitch === BASE_PITCH` 일 때 **이전과 정확히 같은 값**이 나온다.
 */
const BASE_PITCH = Math.atan2(3.2, 7.5);        // 0.4037 rad = 23.1°
const ORBIT_PER_RADIUS = Math.hypot(7.5, 3.2);  // 8.154
/**
 * 상수항은 **각도가 다르다**: atan2(0.15, 0.35) = 0.4049 ≠ 0.4037.
 * 예전 코드가 반올림한 숫자를 쓴 결과다.
 * 둘을 한 각도로 뭉뚱그리면 약 0.6mm가 어긋난다 — 눈에는 안 보이지만
 * "카메라 배치는 그대로 둔다"는 전제가 깨진다. 그래서 항을 따로 돌린다.
 */
const MIN_PITCH = Math.atan2(0.15, 0.35);       // 0.4049 rad
const ORBIT_MIN = Math.hypot(0.35, 0.15);       // 0.381

export class CameraRig {
  readonly camera: PerspectiveCamera;
  yaw = 0;
  /** 지면 기준 올려본 각(rad). BASE_PITCH 면 지금까지의 화면과 동일하다. */
  pitch = BASE_PITCH;
  /**
   * 방향키를 마지막으로 놓은 뒤 흐른 시간(초).
   * Infinity 로 시작해야 게임 시작 직후부터 자동 추적이 돈다.
   */
  private lookIdle = Infinity;

  /** 카메라 기준 전방 (yaw로부터 파생) */
  readonly forward = new Vector3(0, 0, 1);
  readonly right = new Vector3(1, 0, 0);

  private readonly desired = new Vector3();
  private readonly target = new Vector3();

  /**
   * 트라우마 기반 흔들림 (Squirrel Eiserloh 방식).
   * 흔들림 세기를 trauma² 로 쓰는 게 핵심 — 선형이면 약한 충격에도 지저분하고
   * 감쇠 끝자락이 질질 끌린다. 제곱이면 세게 시작해서 깔끔하게 사라진다.
   */
  private trauma = 0;
  private shakeTime = 0;

  constructor(aspect: number) {
    this.camera = new PerspectiveCamera(58, aspect, 0.01, 1000);
    this.updateBasis();
  }

  private updateBasis(): void {
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    this.forward.set(s, 0, c);
    // forward × up. yaw=0(+Z를 봄)일 때 right = -X 가 맞다 — 부호 헷갈리기 쉬움.
    this.right.set(-c, 0, s);
  }

  /**
   * 카메라가 진행방향을 따라가되, **전진 성분에만 비례**해서 따라간다.
   *
   * 이게 좌우 폭주 버그의 진짜 해법이다.
   * 입력은 카메라 기준인데 카메라가 입력을 100% 따라가면 피드백 루프가 생긴다:
   * D를 누름 → 카메라 90도 회전 → 새 "오른쪽"이 또 90도 → 무한 선회.
   *
   * forwardness로 가중치를 주면:
   *   A/D만  → 0     → 카메라 고정, 옆으로 게걸음
   *   W+D    → 0.707 → 부드러운 선회
   *   S      → 음수 → 0으로 클램프 → 카메라 쪽으로 후진
   */
  followDirection(direction: Vector3, dt: number): void {
    const forwardness = Math.max(0, direction.dot(this.forward));
    if (forwardness <= 0) return;

    const targetYaw = Math.atan2(direction.x, direction.z);
    const delta = shortestAngle(this.yaw, targetYaw);
    this.yaw += delta * damp(2.0 * forwardness, dt);
    this.updateBasis();
  }

  /**
   * 방향키 입력으로 시점을 직접 돌린다.
   *
   * `followDirection()` 보다 **먼저** 불러야 한다 — 같은 프레임의 이동이
   * 새 시점을 바로 반영해야 조작이 미끄럽지 않다.
   */
  look(lookX: number, lookY: number, dt: number): void {
    if (lookX === 0 && lookY === 0) {
      this.lookIdle += dt;
      return;
    }
    this.lookIdle = 0;
    // 부호에 주의. updateBasis()의 규약에서
    //   d(forward)/d(yaw) = (cos y, 0, -sin y) = **-right**
    // 즉 yaw가 커지면 시점이 화면 **왼쪽**으로 간다.
    // lookX = +1 은 "오른쪽으로 돌린다"는 뜻이므로 yaw는 빼야 한다.
    this.yaw -= lookX * TUNING.lookYawSpeed * dt;
    this.pitch = Math.min(
      TUNING.pitchMax,
      Math.max(TUNING.pitchMin, this.pitch + lookY * TUNING.lookPitchSpeed * dt),
    );
    this.updateBasis();
  }

  /**
   * 지금 자동 추적을 해도 되는가.
   *
   * 방향키를 만진 직후에는 쉰다. 안 그러면 키에서 손 뗄 때마다 카메라가
   * 진행 방향으로 훅 돌아가서, 플레이어가 맞춰놓은 시점을 매번 빼앗는다.
   */
  get autoFollowReady(): boolean {
    return this.lookIdle >= TUNING.lookHold;
  }

  addTrauma(amount: number): void {
    this.trauma = Math.min(this.trauma + amount, 1);
  }

  /** 입력(moveX/moveY)을 월드 방향 벡터로. 시뮬이 카메라를 아는 유일한 지점. */
  toWorldDirection(moveX: number, moveY: number, out: Vector3): Vector3 {
    out.set(0, 0, 0);
    out.addScaledVector(this.forward, moveY);
    out.addScaledVector(this.right, moveX);
    if (out.lengthSq() > 1e-9) out.normalize();
    return out;
  }

  /**
   * 반지름에 비례해 거리/높이를 스케일한다.
   * 성장의 쾌감은 공이 커지는 게 아니라 **세상이 작아지는 것**에서 나온다.
   * 이 한 줄 빼면 게임이 통째로 밋밋해진다.
   *
   * near/far도 같이 스케일 — logarithmicDepthBuffer 없이 z-fighting을 없앤다.
   * (log depth는 모바일에서 early-Z를 무력화시켜서 비싸다.)
   */
  frame(ballPos: Vector3, radius: number, frameDt: number): void {
    // 반지름 비례항과 상수항을 각각 자기 각도로 돌린다.
    // pitch === BASE_PITCH 면 예전의 (r*7.5 + 0.35, r*3.2 + 0.15) 가 그대로 나온다.
    const swing = this.pitch - BASE_PITCH;
    const aOrbit = this.pitch;
    const aMin = MIN_PITCH + swing;
    const orbit = radius * ORBIT_PER_RADIUS;
    const distance = Math.cos(aOrbit) * orbit + Math.cos(aMin) * ORBIT_MIN;
    const height = Math.sin(aOrbit) * orbit + Math.sin(aMin) * ORBIT_MIN;

    this.desired.set(
      ballPos.x - this.forward.x * distance,
      ballPos.y + height,
      ballPos.z - this.forward.z * distance,
    );
    this.camera.position.lerp(this.desired, damp(6.5, frameDt));

    if (this.trauma > 0.001) {
      this.trauma = Math.max(0, this.trauma - TUNING.traumaDecay * frameDt);
      this.shakeTime += frameDt * 34;
      // 흔들림 폭도 반지름에 비례해야 한다 — 안 그러면 큰 공에서는 안 보인다
      const amp = this.trauma ** 2 * TUNING.shakeMax * (radius + 0.3);
      this.camera.position.x += Math.sin(this.shakeTime * 1.7) * amp;
      this.camera.position.y += Math.sin(this.shakeTime * 2.3 + 1.1) * amp;
      this.camera.position.z += Math.sin(this.shakeTime * 1.9 + 2.7) * amp;
    }

    this.target.set(ballPos.x, ballPos.y + radius * 0.3, ballPos.z);
    this.camera.lookAt(this.target);

    // near를 far에서 유도한다. 바닥값을 양쪽에 따로 주면(예전 코드) 공이 작을 때
    // far만 600에 걸리고 near는 계속 작아져서 비율이 무너진다 — 5cm 공에서
    // far/near가 600,000까지 벌어졌고, 20m 앞 깊이 해상도가 23.8mm가 되어
    // 지면 위 12mm에 있는 수면이 지면과 싸웠다 (= 화면이 깜빡거림).
    const far = Math.max(radius * 500, 600);
    const near = far / DEPTH_RATIO;
    if (Math.abs(this.camera.near - near) > near * 0.1 || this.camera.far !== far) {
      this.camera.near = near;
      this.camera.far = far;
      this.camera.updateProjectionMatrix();
    }
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
