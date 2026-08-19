import type { CityBuilding } from './cityData';

/**
 * 손배치 스테이지 조립 도구 — 집·동네가 같이 쓴다.
 *
 * 원래 이 함수들은 `stage.house.ts` 안에 있었고 집 상수(벽 두께 0.10m, 높이 2.4m,
 * 미닫이문 색)를 그대로 물고 있었다. 동네를 만들면서 그대로 export 해봤더니
 * 담장(두께 0.18m·높이 1.0m)과 호수 연석(0.30m·0.45m)에는 못 쓴다 —
 * **치수가 인자로 나와야 두 스테이지가 같은 계산을 공유한다.**
 *
 * 그래서 스타일을 필수 인자로 받는다. 각 스테이지 파일은 자기 상수를 묶은
 * 얇은 래퍼를 두고, 호출부는 예전 그대로 쓴다.
 */

/** 바닥 사각형 (x0, z0, x1, z1). 월드 좌표(m) */
export type Rect = readonly [number, number, number, number];

/** 벽 한 장의 치수와 색 */
export interface SlabStyle {
  /** 두께(m) */
  readonly t: number;
  /** 높이(m) */
  readonly h: number;
  readonly color: number;
}

export interface PieceOpts {
  readonly t?: number;
  readonly h?: number;
  readonly color?: number;
  readonly kind?: 'wall' | 'door';
  readonly gate?: number;
  readonly name?: string;
}

/**
 * 선분 (x0,z0)→(x1,z1) 을 두께 t로 부풀린 사각 외곽선.
 *
 * 축정렬 선분만 받는다. 손배치 벽은 전부 축정렬이고, 비스듬한 벽을 지원하면
 * 법선 계산이 필요해지는데 쓸 데가 없다.
 */
export function slab(
  x0: number, z0: number, x1: number, z1: number, t: number,
): CityBuilding['outline'] {
  const h = t / 2;
  // 가로 벽이면 z를, 세로 벽이면 x를 부풀린다
  const horizontal = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
  const [ax, az, bx, bz] = horizontal
    ? [Math.min(x0, x1), z0 - h, Math.max(x0, x1), z0 + h]
    : [x0 - h, Math.min(z0, z1), x0 + h, Math.max(z0, z1)];
  return [[ax, az], [bx, az], [bx, bz], [ax, bz]];
}

/** 벽 한 장. `style`이 기본 치수고 `o`가 그때그때 덮어쓴다. */
export function piece(
  x0: number, z0: number, x1: number, z1: number,
  style: SlabStyle, o: PieceOpts = {},
): CityBuilding {
  return {
    outline: slab(x0, z0, x1, z1, o.t ?? style.t),
    height: o.h ?? style.h,
    kind: o.kind ?? 'wall',
    color: o.color ?? style.color,
    ...(o.gate !== undefined ? { gate: o.gate } : {}),
    ...(o.name !== undefined ? { name: o.name } : {}),
  };
}

/**
 * 문이 뚫린 벽 한 장. 벽을 두 토막으로 자르고 그 사이에 문짝을 세운다.
 *
 * **문짝을 벽에 얹지 않고 벽을 잘라내는 이유**: 문이 열리면(= 문짝 건물이 사라지면)
 * 그 자리가 뻥 뚫려야 한다. 벽 위에 덧대면 문이 사라져도 뒤에 벽이 남는다.
 *
 * @param at 문 중심의 축 좌표 (가로 벽이면 x, 세로 벽이면 z)
 * @param w  문 폭(m)
 */
export function wallWithDoor(
  x0: number, z0: number, x1: number, z1: number,
  at: number, w: number, gate: number, name: string,
  wall: SlabStyle, door: SlabStyle,
  o: PieceOpts = {},
): CityBuilding[] {
  const horizontal = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
  const lo = at - w / 2;
  const hi = at + w / 2;
  const parts: CityBuilding[] = [];

  // **문이 벽 구간 안에 있어야 한다.**
  // 이걸 안 잡으면 문짝만 허공에 서고 그 자리에 벽이 없어서 구역이 통째로 샌다.
  // 실제로 집 맵에서 부엌·화장실을 복도 구간 밖에 두는 바람에 8cm에서 집 밖으로
  // 나갈 수 있었고, 화면상으로는 멀쩡해 보였다 — 도달 범위 검사가 잡았다.
  const [segLo, segHi] = horizontal
    ? [Math.min(x0, x1), Math.max(x0, x1)]
    : [Math.min(z0, z1), Math.max(z0, z1)];
  if (lo < segLo - 1e-9 || hi > segHi + 1e-9) {
    throw new Error(
      `${name}: 문(${lo.toFixed(2)}~${hi.toFixed(2)})이 벽 구간(${segLo.toFixed(2)}~${segHi.toFixed(2)}) 밖이다`,
    );
  }

  const doorOpts: PieceOpts = {
    ...o, h: door.h, kind: 'door', color: door.color, gate, name,
  };

  if (horizontal) {
    const a = Math.min(x0, x1), b = Math.max(x0, x1);
    if (lo - a > 0.01) parts.push(piece(a, z0, lo, z0, wall, o));
    if (b - hi > 0.01) parts.push(piece(hi, z0, b, z0, wall, o));
    parts.push(piece(lo, z0, hi, z0, wall, doorOpts));
  } else {
    const a = Math.min(z0, z1), b = Math.max(z0, z1);
    if (lo - a > 0.01) parts.push(piece(x0, a, x0, lo, wall, o));
    if (b - hi > 0.01) parts.push(piece(x0, hi, x0, b, wall, o));
    parts.push(piece(x0, lo, x0, hi, wall, doorOpts));
  }
  return parts;
}

/** 모서리 기둥. 벽이 만나는 자리에 세워 실루엣을 끊는다. */
export function pillar(
  x: number, z: number, style: SlabStyle, half = 0.09,
): CityBuilding {
  return {
    outline: [[x - half, z - half], [x + half, z - half], [x + half, z + half], [x - half, z + half]],
    height: style.h,
    kind: 'wall',
    color: style.color,
  };
}

/** 사각형을 둘러싸는 벽 네 장. 담장·연석처럼 통째로 막을 때 쓴다. */
export function ring(rect: Rect, style: SlabStyle, o: PieceOpts = {}): CityBuilding[] {
  const [x0, z0, x1, z1] = rect;
  return [
    piece(x0, z0, x1, z0, style, o),
    piece(x0, z1, x1, z1, style, o),
    piece(x0, z0, x0, z1, style, o),
    piece(x1, z0, x1, z1, style, o),
  ];
}

/** 사각형 건물 하나. 담장이 아니라 **덩어리**를 세울 때. */
export function block(
  rect: Rect, height: number, kind: CityBuilding['kind'], color: number, name?: string,
): CityBuilding {
  const [x0, z0, x1, z1] = rect;
  return {
    outline: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]],
    height,
    kind,
    color,
    ...(name !== undefined ? { name } : {}),
  };
}
