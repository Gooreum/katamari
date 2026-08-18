/** 게임필 노브. THREE 의존성 없음 — 튜닝 스크립트에서도 읽는다. */
export const TUNING = {
  startRadius: 0.025,   // 지름 5cm — 왕자님 키
  pickRatio: 0.85,      // 물체 최대변 <= 지름 * 이 값 → 흡수
  /**
   * 부피 가산 배율. 체감 성장 속도의 핵심 노브.
   *
   * **3.5 → 0.5.** 3.5는 서울 길거리 월드에서 맞춘 값인데 그 월드가 사라졌다.
   * 집 맵에서 다시 재니 「별을 만들어라 1」(목표 10cm)이 **2초**에 끝났다 —
   * 원작이 그 판에 3분을 주는 것과 두 자릿수가 어긋난다.
   *
   * 0.5면 탐욕 시뮬 기준 12초고, 그 시뮬은 벽을 모델링하지 않아 낙관적이라
   * 실제 플레이는 40~60초쯤 된다. 3분 안에 여유 있게 닿는 값이다.
   * `npm run curve` 가 스테이지별 도달 시각을 찍어준다.
   */
  growth: 0.5,
  // ── 부착 ────────────────────────────────────────────────
  /** 물체가 표면 아래로 잠기는 비율. 0.5 = 딱 절반, 낮을수록 많이 튀어나온다 */
  sink: 0.35,
  /** 겹침 판정 반경 배율. 낮추면 서로 파고들며 촘촘해진다 */
  packScale: 0.78,
  /** 겹침 완화 반복 횟수 */
  relaxIterations: 8,
  relaxStrength: 0.55,
  /** 완화가 갇혔을 때 무작위 재시도 횟수 */
  packRestarts: 6,
  /** 겹침 검사할 최대 이웃 수 (각반경 큰 것 우선) */
  packCheckLimit: 220,
  /** 빨려들어가는 시간(초). 0이면 순간이동 */
  attachTime: 0.13,
  /**
   * 표면 점유율 상한. 1.0 = 구 표면을 정확히 덮는 양.
   * 1보다 크게 두면 서로 파고들며 뭉쳐 보인다.
   *
   * 개수가 아니라 점유율로 자르는 게 핵심이다 — 작은 공에 90개는 물리적으로
   * 안 들어가고, 큰 공에 90개는 휑하다. 점유율은 크기에 자동으로 맞춰진다.
   */
  surfaceCoverage: 1.35,
  /** 그래도 개수 상한은 필요하다. 그대로 드로우콜이 되므로. */
  ridePoolSize: 110,
  baseSpeed: 0.45,
  speedPerRadius: 2.0,
  dashMultiplier: 1.7,
  bakeEvery: 80,        // 이만큼 쌓이면 하나의 지오메트리로 구움

  // ── 관성 ────────────────────────────────────────────────
  /** 가속 응답성. 클수록 조작이 즉각적 */
  accelRate: 9,
  /** 클수록 큰 공이 둔해진다. 무게감의 정체 */
  massDrag: 0.55,
  /**
   * 무게감이 포화하기 시작하는 반지름(m).
   *
   * 이게 없으면 드래그가 반지름에 **선형으로 무한정** 커진다.
   * 실측하면 지름 40m에서 응답이 1.33초, 정지 거리가 자기 지름의 1.35배였다 —
   * 키를 놓고도 자기 몸통보다 더 미끄러지니 조종이 아니라 예측을 해야 했다.
   * 하필 그 구간이 3분 세션의 후반, 가장 재미있어야 할 때다.
   *
   * 4m면 지름 8m부터 서서히 포화해서 어느 크기에서든 자기 지름의
   * 0.2~0.35배만 미끄러진다. 작은 공은 영향이 없다
   * (반지름 2.5cm에서 유효 반지름 0.0248 — 소수점 셋째 자리까지 그대로).
   *
   * `npm run handling` 이 이 값의 결과를 크기별로 검사한다.
   */
  dragKnee: 4,

  // ── 충돌 ────────────────────────────────────────────────
  /** 못 먹는 물체와 부딪혔을 때 반발 계수 */
  restitution: 0.55,
  /** 충격 판정 기준 — 현재 최고속도 대비 비율 */
  impactThreshold: 0.5,
  /** 충격 속도(정규화)당 떨어져 나가는 개수 */
  shedPerImpact: 5,
  /** 충돌 후 조작 불능 시간(초) */
  stunTime: 0.22,

  // ── 연출 ────────────────────────────────────────────────
  /** 흡수 시 부풀어오르는 양 (상대 크기에 비례) */
  pulseGain: 0.9,
  pulseDecay: 14,
  squashDecay: 9,
  traumaDecay: 1.8,
  shakeMax: 0.22,

  /** 시점 좌우 회전 속도(rad/s). 2.2면 한 바퀴에 약 2.9초 */
  lookYawSpeed: 2.2,
  /** 상하 시점 속도(rad/s). 좌우보다 느려야 멀미가 덜하다 */
  lookPitchSpeed: 1.2,
  /**
   * 방향키에서 손을 뗀 뒤 자동 추적을 쉬는 시간(초).
   * 0이면 키를 뗄 때마다 카메라가 훅 되돌아가서 플레이어와 싸우는 느낌이 든다.
   */
  lookHold: 2.0,
  /**
   * 상하 시점 범위(rad). 기본 각도는 atan2(3.2, 7.5) = 0.4037 = 23.1° 로,
   * 이게 지금까지의 화면 각도다.
   * 하한을 더 낮추면 5cm 공에서 카메라가 지면에 너무 붙는다.
   */
  pitchMin: 0.15,
  pitchMax: 1.30,
};

export function radiusFromVolume(volume: number): number {
  return Math.cbrt((volume * 3) / (4 * Math.PI));
}

export function volumeFromRadius(radius: number): number {
  return (4 / 3) * Math.PI * radius ** 3;
}

export function speedAt(radius: number): number {
  return TUNING.baseSpeed + radius * TUNING.speedPerRadius;
}

export function canAbsorb(radius: number, size: number): boolean {
  return size <= radius * 2 * TUNING.pickRatio;
}
