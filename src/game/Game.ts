import {
  Color, DirectionalLight, Fog, HemisphereLight, PCFSoftShadowMap, Quaternion, Scene,
  Vector3, WebGLRenderer,
} from 'three';
import { InputManager } from '../core/Input';
import { Loop } from '../core/Loop';
import { KeyboardSource } from '../input/KeyboardSource';
import { TouchSource } from '../input/TouchSource';
import { World } from '../world/World';
import type { CityData } from '../world/cityData';
import { Katamari, TUNING } from './Katamari';
import { CameraRig } from './CameraRig';
import { DebrisField } from './Debris';
import { Sfx } from '../audio/Sfx';
import { Narrator } from '../narrative/Narrator';
import { KING } from '../narrative/script.king';
import { Subtitle } from '../ui/Subtitle';
import type { Hud } from '../ui/Hud';
import { Telemetry } from '../ui/Telemetry';
import { Result } from '../ui/Result';
import { DEFAULT_STAGE, judge, type StageNav, type StageOutcome, type StageRule } from './Stage';
import { loadStars, recordStar } from './Progress';

const STEP = 1 / 60;
/** 계속 굴리는 동안 최고 기록을 저장하는 간격(초). 매 프레임 쓸 수는 없다 */
const SAVE_EVERY = 3;

const CULL_INTERVAL = 20;

export class Game {
  private readonly scene = new Scene();
  private readonly renderer: WebGLRenderer;
  private readonly rig: CameraRig;
  private readonly input = new InputManager();
  private readonly world: World;
  private readonly ball: Katamari;
  private readonly loop: Loop;
  private readonly telemetry: Telemetry;
  private readonly debris: DebrisField;
  private readonly sfx = new Sfx();
  private readonly subtitle: Subtitle;
  private readonly narrator: Narrator;
  private readonly result = new Result();

  /** null이면 진행 중. 한 번 정해지면 안 바뀐다 */
  private outcome: StageOutcome = null;
  /**
   * **계속 굴리기.** 판정이 끝난 뒤 제한 없이 이어 굴리는 상태.
   *
   * 판정은 `outcome === null` 일 때만 도므로(`step` 참고) 여기서 다시 끌 게 없다.
   * 이 값은 **HUD와 저장**에만 쓴다 — 목표·시계를 지우고, 최고 기록을 계속 갱신한다.
   */
  private eternal = false;
  /** 계속 굴리는 동안 최고 기록을 저장할 다음 시각(초) */
  private nextSave = 0;

  /** 화자 트리거용 상태 */
  private nextMilestone = 0;
  private sinceAbsorb = 0;
  private biggestLabel = '';
  private biggestSize = 0;

  private elapsed = 0;
  private ticks = 0;

  // 스크래치 — 루프 안에서 절대 할당하지 않는다 (GC 스파이크 = 프레임 드랍)
  private readonly dir = new Vector3();
  private readonly closest = new Vector3();
  private readonly push = new Vector3();
  private readonly normal = new Vector3();
  private readonly impulse = new Vector3();
  private readonly renderPos = new Vector3();
  private readonly renderQuat = new Quaternion();
  private readonly candidates: number[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    private readonly hud: Hud,
    city: CityData | null = null,
    private readonly rule: StageRule = DEFAULT_STAGE,
    /** 없으면 결과 화면이 버튼 없이 뜬다 — 도구·테스트에서 그렇게 쓴다. */
    private readonly nav?: StageNav,
  ) {
    this.subtitle = new Subtitle(rule.name);
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

    // 하늘. 실내에서도 창 밖·문 너머로 보이므로 밝게 둔다.
    this.scene.background = new Color(0x86cdf0);

    /**
     * **태양이 지배하고 반구광은 그늘을 메우기만 한다.**
     *
     * 값의 이력: hemi 1.80 → 1.95 → 1.35 → 0.75, sun 0.55 → 0.45 → 0.95 → 1.65.
     * 계속 같은 방향으로 움직여 왔다 — 반구광을 덜고 태양을 올리는 방향이다.
     * 직전 값(1.35/0.95)의 주석도 「그림자 대비는 여전히 낮다」고 스스로 적어두었고,
     * 실제로 그랬다. star3 화면에서 사과 하나의 밝은 면(#a03e33)과 그늘 면(#813326)을
     * 픽셀로 재보니 **1.56:1**이었다. 그 정도로는 `flatShading` 으로 갈라놓은 면이
     * 서로 구분되지 않는다 — shapes.*.ts 가 부품을 아무리 정교하게 조립해도
     * (「배꼽 줄 하나가 팥과 콩을 가른다」) 화면에서는 실루엣 하나로 뭉친다.
     *
     * **어둡게 만드는 변경이 아니다.** 총광량은 2.30 → 2.40 으로 거의 그대로 두고
     * 직사 비중만 41% → 69% 로 옮겼다. three r169 의 Lambert 조명식
     * (반구 irradiance = mix(ground, sky, .5·n·up + .5)·intensity,
     *  diffuse = albedo·irradiance/π) 에 태양 고도 52°(아래 position 값)를 넣으면:
     *
     *   윗면 계수 0.668 → 0.652  (−2.4%, 전체 밝기는 유지된다)
     *   음지 계수 0.397 → 0.221
     *   명암비   1.68:1 → 2.95:1  ← 이걸 벌리는 게 목적이다
     *
     * **검정 물체는 확인하고 넣었다.** 팔레트에서 가장 어두운 `0x2f2e2c`(개미·TV·클립)의
     * 음지면이 RGB(19,18,17) → (10,10,10)까지 내려간다. 검정끼리 뭉갤 위험이 여기 있어서
     * 반구광을 0.55 가 아니라 **0.75 에서 멈췄다** — 0.55 는 명암비 3.94:1 로 더 좋지만
     * 그 대가로 어두운 물체의 형태가 죽는다.
     *
     * 아래쪽 색은 바닥 반사광이라 다다미 팔레트와 계열을 맞춘다.
     */
    this.scene.add(new HemisphereLight(0xffffff, 0xd7e8bc, 0.75));
    const sun = new DirectionalLight(0xfff6e4, 1.65);
    sun.position.set(1, 2.2, 1.4);
    this.scene.add(sun);

    this.world = new World(this.scene, city);

    /**
     * **접지 그림자.**
     *
     * 여태 씬에 그림자가 **하나도 없었다.** 그래서 아무것도 바닥에 「닿아」 보이지
     * 않았다 — 물건이 전부 바닥 위에 떠 있는 스티커처럼 보였다.
     * 저폴리 씬에서 「거기 놓여 있다」를 만드는 건 폴리곤이 아니라 이것이다.
     *
     * **실내 판에서만 켠다.** 잠실은 반경 2.8km라 정사영 그림자 카메라 하나로는
     * 못 덮는다(캐스케이드가 필요하다). 안개를 `groundSize > 1200` 으로 가른 것과
     * 같은 기준을 쓴다 — 「실내인가 도시인가」를 이 값 하나로 판단하고 있다.
     */
    if (this.world.groundSize <= 1200) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = PCFSoftShadowMap;
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      /**
       * 절두체를 **방 크기에 딱 맞춘다.** 집 맵은 한 변 12m 인데 카메라를 크게 잡으면
       * 2048² 텍셀이 빈 마당에 뿌려져서 정작 거실 그림자가 뭉갠다.
       * `groundSize` 는 지형 반경의 2.6배라 그 절반이면 지형 전체를 덮는다.
       */
      const R = this.world.groundSize / 2;
      const cam = sun.shadow.camera;
      cam.left = -R; cam.right = R; cam.top = R; cam.bottom = -R;
      cam.near = 0.5; cam.far = R * 4 + 10;
      cam.updateProjectionMatrix();
      // 광원을 지형 위로 물려서 절두체 안에 방이 들어오게 한다.
      // 방향(1, 2.2, 1.4)은 그대로 — 그림자 각도가 바뀌면 명암 판단이 무너진다
      sun.position.set(1, 2.2, 1.4).normalize().multiplyScalar(R * 1.6);
      this.scene.add(sun.target);
      // **얇은 물건에서 그림자 여드름(acne)이 난다.** 신문·화투는 두께가 5mm 라
      // 기본 bias 로는 자기 그림자가 표면에 찍힌다. normalBias 가 그걸 법선 방향으로 민다
      // **얇은 물건이 관건이다.** 화투·신문은 두께가 5mm 라 normalBias 를 2cm 로 두면
      // 그림자가 통째로 법선 방향으로 밀려나 사라진다. 물건 두께보다 한참 작게 잡는다
      sun.shadow.bias = -0.0004;
      sun.shadow.normalBias = 0.004;
    }
    /**
     * 안개는 **먼 배경을 하늘에 녹이는 용도로만** 남긴다.
     *
     * 잠실은 반경 2.8km라 안개 없이는 지평선이 칼로 자른 듯 끊긴다.
     * 집 맵은 12m다 — 그 거리에 안개가 낄 이유가 없고, 걸면 방 안이 뿌예진다.
     * 원작 실내 화면에는 안개가 없다.
     */
    if (this.world.groundSize > 1200) {
      this.scene.fog = new Fog(
        0xbfe6f7, this.world.groundSize * 0.40, this.world.groundSize * 1.15,
      );
    }
    // 규칙은 **지름**을 들고 있고 공은 반지름을 쓴다
    this.ball = new Katamari(this.scene, rule.start / 2);
    this.ball.pivot.position.set(this.world.spawn.x, this.ball.radius, this.world.spawn.z);
    this.ball.prevPos.copy(this.ball.pivot.position);
    this.rig = new CameraRig(innerWidth / innerHeight);

    this.input.add(new KeyboardSource());
    if (matchMedia('(pointer: coarse)').matches) {
      this.input.add(new TouchSource(canvas));
    }

    this.debris = new DebrisField(this.scene);
    this.narrator = new Narrator(KING, this.subtitle);
    this.nextMilestone = this.ball.diameter * 2;
    this.telemetry = new Telemetry(this.ball.diameter);
    this.loop = new Loop(STEP, this.step, this.render);
    addEventListener('resize', this.onResize);
    this.onResize();
  }

  /** 결과 화면이 붙으면 여기서 가져간다 */
  get summary(): { diameter: number; count: number; biggest: string; elapsed: number } {
    return {
      diameter: this.ball.diameter,
      count: this.ball.count,
      biggest: this.biggestLabel || '없음',
      elapsed: this.elapsed,
    };
  }

  start(): void {
    this.loop.start();
    this.narrator.fire('start', this.ball.diameter);
  }

  /**
   * 판정이 끝난 뒤 **그 공 그대로** 이어 굴린다.
   *
   * `finish()` 가 `loop.stop()` 만 했으므로 월드도 공도 그대로 살아 있다 —
   * 루프만 다시 켜면 된다. 판정은 `outcome` 이 남아 있어 다시 안 돈다.
   *
   * 원작 「에터널」은 그 판을 **시작 크기부터** 시간 제한 없이 다시 도는 것이다.
   * 이건 그게 아니라 커진 공을 이어 굴리는 쪽이다 — 원작과 다른 점이다.
   */
  resume(): void {
    if (this.outcome === null) return;   // 아직 안 끝났으면 할 일이 없다
    this.eternal = true;
    this.nextSave = this.elapsed + SAVE_EVERY;
    this.result.dispose();
    this.subtitle.mark('계속');
    this.loop.start();
  }
  stop(): void {
    this.loop.stop();
    this.input.dispose();
    this.telemetry.dispose();
    this.subtitle.dispose();
    this.result.dispose();
  }

  // ── 시뮬레이션: 항상 고정 dt ────────────────────────────────
  private step = (dt: number): void => {
    this.elapsed += dt;
    this.ball.snapshot();

    const input = this.input.sample();
    // 시점을 **먼저** 돌린다. 이동 방향은 카메라 기준이라, 순서가 반대면
    // 방향키를 누른 그 프레임의 이동이 한 프레임 늦은 시점으로 계산돼 미끄럽다.
    this.rig.look(input.lookX, input.lookY, dt);
    this.rig.toWorldDirection(input.moveX, input.moveY, this.dir);

    this.ball.drive(this.dir, input.dash, dt);
    this.ball.integrate(dt);
    this.ball.updateFeel(dt);
    // 방향키를 만진 직후에는 자동 추적을 쉰다 — 안 그러면 손 뗄 때마다 카메라가
    // 진행 방향으로 돌아가서 플레이어가 맞춰둔 시점을 매번 빼앗는다.
    // 터치는 lookX/lookY 를 안 만들므로 이 조건이 항상 참이다 = 모바일 동작 불변.
    if (this.dir.lengthSq() > 0 && this.rig.autoFollowReady) {
      this.rig.followDirection(this.dir, dt);
    }

    this.debris.step(dt);
    // 부딪혀서 흔들리는 물건을 제자리로 되돌린다. 흔드는 게 없으면 즉시 빠진다
    this.world.stepNudges(dt);
    // 마당 강아지. 돌아다니는 게 없으면 즉시 빠진다
    this.world.stepWander(dt);
    this.scene.updateMatrixWorld(true);
    this.resolveCollisions();
    this.resolveCity();
    this.resolveDebris();

    // 문이 열리는 건 흡수가 아니라 **사건**이다. 소리와 대사를 둘 다 붙인다.
    // 게이트가 없는 스테이지(OSM 도시)에서는 첫 줄에서 바로 빠져나온다.
    const opened = this.world.city?.openGates(this.ball.diameter);
    // 상판·선반도 같은 규약으로 지운다 — 다리를 먹었는데 상판이 공중에 남으면 안 된다
    this.world.updateSurfaces(this.ball.diameter);
    if (opened !== undefined && opened.length > 0) {
      this.sfx.thud(0.45);
      this.rig.addTrauma(0.3);
      this.narrator.fire('gate', this.ball.diameter);
    }

    if (++this.ticks % CULL_INTERVAL === 0) this.ball.cullBuried();

    // 스테이지 판정. **목표 달성을 먼저 본다** — 마지막 순간에 목표를 넘기며
    // 시간이 다 되는 경우 실패로 보내면 화면에서 본 것과 결과가 어긋난다.
    if (this.outcome === null) {
      const verdict = judge(this.rule, this.ball.diameter, this.elapsed);
      if (verdict !== null) this.finish(verdict);
    }

    /**
     * 계속 굴리는 동안에도 **최고 기록은 갱신한다.** 20m를 만들었는데 하늘의
     * 별이 12m로 남으면 이 모드를 하는 이유가 없다.
     *
     * **깬 판일 때만 저장한다.** `loadCleared()` 가 별 기록에서 파생되므로,
     * 시간 초과한 판에서 계속 굴려 기록이 남으면 그걸 "깼다"로 읽어
     * **다음 판이 열린다.** 제한시간이 통째로 무의미해진다.
     *
     * 매 프레임 `localStorage` 를 쓸 수는 없어 몇 초에 한 번만 들른다.
     * `recordStar` 는 더 클 때만 실제로 쓰므로 대부분은 읽고 끝난다.
     */
    if (this.eternal && this.outcome === 'cleared' && this.elapsed >= this.nextSave) {
      this.nextSave = this.elapsed + SAVE_EVERY;
      recordStar(this.rule.id, this.ball.diameter);
    }

    this.narrator.step(dt);
    this.sinceAbsorb += dt;
    // idle 대사는 쓰지 않는다. 재촉은 이 게임이 주려는 것과 반대다.
    if (this.ball.diameter >= this.nextMilestone) {
      this.nextMilestone = this.ball.diameter * 2;
      this.narrator.fire('milestone', this.ball.diameter);
    }
  };

  /**
   * 판 종료. 루프를 멈추고 왕의 평가를 띄운다.
   *
   * `stop()`을 그대로 쓰지 않는 이유는 입력·자막을 거두면 결과 화면이
   * 같이 사라지기 때문이다. 시뮬만 세우고 화면은 남긴다.
   */
  private finish(outcome: Exclude<StageOutcome, null>): void {
    this.outcome = outcome;
    this.loop.stop();
    this.sfx.thud(outcome === 'cleared' ? 0.6 : 0.3);
    // 다음 별을 여는 건 **판정이지 화면이 아니다.** 결과 카드를 안 보고 나가도 기록은 남는다.
    //
    // **옛 최고를 기록보다 먼저 읽는다.** 순서가 반대면 방금 쓴 값을 읽게 되어
    // 결과 화면이 매번 "자기 기록 경신"이라고 말한다.
    const best = loadStars().get(this.rule.id) ?? 0;
    if (outcome === 'cleared') recordStar(this.rule.id, this.ball.diameter);
    this.result.show(this.rule, outcome, this.summary, KING, this.nav, best,
      () => this.resume());
  }

  private resolveCollisions(): void {
    const p = this.ball.pivot.position;
    const R = this.ball.radius;
    const objects = this.world.objects;

    this.world.hash.query(p.x, p.z, R, this.candidates);

    for (const index of this.candidates) {
      const o = objects[index]!;
      if (o.picked) continue;

      // 구 vs AABB.
      // **y 만 `colY` 를 쓴다.** 밥상처럼 밑이 뚫린 가구는 형상 전체를 그리면서
      // 충돌은 상판만 잡는다 — 렌더 중심(`pos.y`)과 충돌 중심(`colY`)이 갈라진다.
      // 나머지 물체는 `colY === pos.y` 라 지금까지와 똑같다.
      const c = o.pos, h = o.half;
      this.closest.set(
        Math.max(c.x - h.x, Math.min(p.x, c.x + h.x)),
        Math.max(o.colY - h.y, Math.min(p.y, o.colY + h.y)),
        Math.max(c.z - h.z, Math.min(p.z, c.z + h.z)),
      );
      this.push.subVectors(p, this.closest);
      const d = this.push.length();
      if (d >= R) continue;

      if (this.ball.canAbsorb(o.size)) {
        o.picked = true;
        const mesh = this.world.promote(o);
        this.scene.add(mesh);
        this.absorb(mesh, o.volume, o.size, o.label);
      } else if (d > 1e-6) {
        this.blockedBy(o.size, d, R, p, index);
      }
    }
  }

  private absorb(mesh: import('three').Mesh, volume: number, size: number, label: string): void {
    const relative = Math.min(size / this.ball.diameter, 1);
    this.ball.absorb(mesh, volume, size, label);
    this.hud.logPickup(label, size);
    this.telemetry.record(this.elapsed, this.ball.diameter, this.ball.count);
    this.sfx.absorb(relative);
    this.sinceAbsorb = 0;
    if (size > this.biggestSize) {
      this.biggestSize = size;
      this.biggestLabel = label;
    }
    // 자기 몸통만 한 걸 삼키면 화면도 반응해야 한다
    if (relative > 0.45) {
      this.rig.addTrauma(relative * 0.25);
      this.narrator.fire('bigAbsorb', this.ball.diameter);
    }
  }

  /**
   * 못 먹는 물체에 부딪힘.
   * 살짝 스치면 그냥 밀어내고, 세게 박으면 튕겨나가며 붙은 걸 떨어뜨린다.
   * 이 구분이 없으면 벽이 그냥 미끄러운 유리처럼 느껴진다.
   */
  /** `index` 는 부딪힌 물체 — 흔들어주려고 받는다. 건물(`resolveCity`)은 안 넘긴다 */
  private blockedBy(size: number, d: number, R: number, p: Vector3, index?: number): void {
    this.normal.copy(this.push).divideScalar(d);
    this.push.multiplyScalar((R - d) / d);
    p.add(this.push);
    p.y = R;

    const into = -this.ball.velocity.dot(this.normal);
    const threshold = this.ball.speed * TUNING.impactThreshold;
    if (into <= threshold) {
      // 약한 접촉: 벽면을 따라 미끄러진다
      this.ball.velocity.addScaledVector(this.normal, Math.max(0, into));
      return;
    }

    const strength = Math.min((into - threshold) / (this.ball.speed * 1.2), 1);
    this.ball.impact(this.normal, strength);
    this.rig.addTrauma(0.35 + strength * 0.5);
    this.sfx.thud(strength);
    /**
     * **부딪힌 물건도 흔들린다.**
     *
     * 여태 이 함수는 공만 튕기고(`ball.impact`) 화면만 흔들었다(`addTrauma`).
     * 못 먹는 컵을 들이받아도 컵은 미동도 없었다 — 그게 「물건이 반응을 안 한다」의
     * 정체다. 렌더만 흔들므로 충돌·성장 곡선은 그대로다.
     */
    if (index !== undefined) {
      this.world.nudge(index, -this.normal.x, -this.normal.z, strength, this.ball.diameter);
    }
    this.narrator.fire('impact', this.ball.diameter);

    // 큰 걸 들이받을수록 많이 떨어진다
    const bulk = Math.min(size / this.ball.diameter, 2) * 0.5;
    const count = Math.floor(strength * TUNING.shedPerImpact * (0.5 + bulk));
    if (count > 0) {
      this.impulse.copy(this.normal).multiplyScalar(this.ball.speed * 0.6);
      const dropped = this.ball.shed(count);
      this.debris.scatter(dropped, p, this.impulse, this.ball.speed * 0.7);
      if (dropped.length > 0) this.narrator.fire('shed', this.ball.diameter);
    }
  }

  /**
   * 건물 충돌/흡수.
   *
   * 건물은 개수가 많아 매 프레임 전체를 훑을 수 없다.
   * 대신 공 반경 + 여유 안에 들어오는 것만 본다 — 대부분은 거리 검사 한 번에 걸러진다.
   * (건물용 공간 해시가 다음 최적화 지점이다.)
   */
  private resolveCity(): void {
    const city = this.world.city;
    if (!city) return;
    const p = this.ball.pivot.position;
    const R = this.ball.radius;

    for (let i = 0; i < city.entries.length; i++) {
      const e = city.entries[i]!;
      if (e.absorbed) continue;

      const dx = Math.abs(p.x - e.center.x) - e.half.x;
      const dz = Math.abs(p.z - e.center.z) - e.half.z;
      if (dx > R || dz > R) continue;
      if (p.y - R > e.building.height) continue;

      this.closest.set(
        Math.max(e.center.x - e.half.x, Math.min(p.x, e.center.x + e.half.x)),
        Math.max(0, Math.min(p.y, e.building.height)),
        Math.max(e.center.z - e.half.z, Math.min(p.z, e.center.z + e.half.z)),
      );
      this.push.subVectors(p, this.closest);
      const d = this.push.length();
      if (d >= R) continue;

      if (this.ball.canAbsorb(e.size)) {
        const mesh = city.absorb(i);
        this.scene.add(mesh);
        this.absorb(mesh, e.volume, e.size, e.label);
      } else if (d > 1e-6) {
        this.blockedBy(e.size, d, R, p);
      }
    }
  }

  /** 떨어져 나간 것들은 정적 해시에 없으므로 따로 검사한다. 수십 개 규모라 선형이면 충분. */
  private resolveDebris(): void {
    const p = this.ball.pivot.position;
    const R = this.ball.radius;
    for (let i = this.debris.items.length - 1; i >= 0; i--) {
      const dbg = this.debris.items[i]!;
      if (dbg.cooldown > 0) continue;
      const reach = R + dbg.size * 0.5;
      if (p.distanceToSquared(dbg.mesh.position) > reach * reach) continue;
      if (!this.ball.canAbsorb(dbg.size)) continue;
      this.debris.remove(i);
      this.absorb(dbg.mesh, dbg.volume, dbg.size, dbg.label);
    }
  }

  // ── 렌더: 가변 dt + 스텝 사이 보간 ─────────────────────────
  private render = (alpha: number, frameDt: number): void => {
    const pivot = this.ball.pivot;

    // 보간을 위해 잠시 이전 상태 쪽으로 되돌린다
    this.renderPos.copy(pivot.position);
    this.renderQuat.copy(this.ball.group.quaternion);
    pivot.position.lerpVectors(this.ball.prevPos, this.renderPos, alpha);
    this.ball.group.quaternion.slerpQuaternions(this.ball.prevQuat, this.renderQuat, alpha);

    this.rig.frame(pivot.position, this.ball.radius, frameDt);
    this.world.pool.flush();
    this.world.city?.flush();
    this.renderer.render(this.scene, this.rig.camera);

    // 시뮬 상태 복구 — 렌더가 시뮬을 오염시키면 안 된다
    pivot.position.copy(this.renderPos);
    this.ball.group.quaternion.copy(this.renderQuat);

    this.subtitle.update();
    this.telemetry.draw();
    this.hud.update(
      this.ball.diameter,
      this.ball.count,
      this.elapsed,
      this.world.pool.drawCalls + this.ball.drawCalls + this.debris.count +
        (this.world.city?.drawCalls ?? 0) + 1,
      this.ball.visibleAttached,
      // 계속 굴리는 동안엔 목표도 시계도 없다 — 남은 시간이 아니라 흐른 시간을 본다
      this.eternal ? 0 : this.rule.target,
      this.eternal || this.rule.limit <= 0 ? null : this.rule.limit - this.elapsed,
    );
  };

  private onResize = (): void => {
    this.renderer.setSize(innerWidth, innerHeight);
    this.rig.resize(innerWidth / innerHeight);
  };
}
