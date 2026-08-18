import {
  Color, DirectionalLight, Fog, HemisphereLight, Quaternion, Scene,
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
import { DEFAULT_STAGE, judge, type StageOutcome, type StageRule } from './Stage';

const STEP = 1 / 60;
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
  ) {
    this.subtitle = new Subtitle(rule.name);
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

    // 하늘. 실내에서도 창 밖·문 너머로 보이므로 밝게 둔다.
    this.scene.background = new Color(0x86cdf0);

    /**
     * **반구광이 지배하되 태양이 면을 갈라놓는다.**
     *
     * 세 안(hemi 1.80/1.95/1.35 × sun 0.55/0.45/0.95)을 렌더로 비교했다.
     * 앞의 둘은 반구광이 너무 강해서 물건이 자기 그림자를 못 갖고, 밀집한 실내에서
     * 소품 수백 개가 한 덩어리 얼룩으로 뭉갰다. 태양을 0.95까지 올린 이 값이
     * 물건 하나하나를 덩어리로 읽히게 한다 — 그러면서도 그림자 대비는 여전히 낮다.
     *
     * 아래쪽 색은 바닥 반사광이라 다다미 팔레트와 계열을 맞춘다.
     */
    this.scene.add(new HemisphereLight(0xffffff, 0xd7e8bc, 1.35));
    const sun = new DirectionalLight(0xfff6e4, 0.95);
    sun.position.set(1, 2.2, 1.4);
    this.scene.add(sun);

    this.world = new World(this.scene, city);
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
    this.ball = new Katamari(this.scene);
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
    this.scene.updateMatrixWorld(true);
    this.resolveCollisions();
    this.resolveCity();
    this.resolveDebris();

    // 문이 열리는 건 흡수가 아니라 **사건**이다. 소리와 대사를 둘 다 붙인다.
    // 게이트가 없는 스테이지(OSM 도시)에서는 첫 줄에서 바로 빠져나온다.
    const opened = this.world.city?.openGates(this.ball.diameter);
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
    this.result.show(this.rule, outcome, this.summary, KING);
  }

  private resolveCollisions(): void {
    const p = this.ball.pivot.position;
    const R = this.ball.radius;
    const objects = this.world.objects;

    this.world.hash.query(p.x, p.z, R, this.candidates);

    for (const index of this.candidates) {
      const o = objects[index]!;
      if (o.picked) continue;

      // 구 vs AABB
      const c = o.pos, h = o.half;
      this.closest.set(
        Math.max(c.x - h.x, Math.min(p.x, c.x + h.x)),
        Math.max(c.y - h.y, Math.min(p.y, c.y + h.y)),
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
        this.blockedBy(o.size, d, R, p);
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
  private blockedBy(size: number, d: number, R: number, p: Vector3): void {
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
      this.rule.target,
      this.rule.limit > 0 ? this.rule.limit - this.elapsed : null,
    );
  };

  private onResize = (): void => {
    this.renderer.setSize(innerWidth, innerHeight);
    this.rig.resize(innerWidth / innerHeight);
  };
}
