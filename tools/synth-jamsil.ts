/**
 * 잠실 합성 데이터.  `npm run synth-city`
 *
 * OSM을 받기 전에도 파이프라인 전체를 돌려보기 위한 것이다.
 * 배치와 규모는 실제 잠실을 참고했지만 외곽선은 진짜가 아니다 —
 * `npm run fetch-city` 로 받은 실제 데이터가 이 파일을 대체한다.
 *
 * 원점: 롯데월드타워 (37.5125, 127.1025).  x = 동, z = 남.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  BuildingKind, CityBuilding, CityData, CityLandmark, CityWater,
} from '../src/world/cityData';
import { mulberry32 } from '../src/world/generation';

const rand = mulberry32(20260811);

function box(cx: number, cz: number, w: number, d: number, rot = 0): Array<[number, number]> {
  const c = Math.cos(rot), s = Math.sin(rot);
  return ([[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]] as const)
    .map(([x, z]) => [cx + x * c - z * s, cz + x * s + z * c] as [number, number]);
}

function blob(cx: number, cz: number, rx: number, rz: number, n = 14): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const j = 0.86 + rand() * 0.28;
    pts.push([cx + Math.cos(a) * rx * j, cz + Math.sin(a) * rz * j]);
  }
  return pts;
}

const buildings: CityBuilding[] = [];
const add = (o: Array<[number, number]>, height: number, kind: BuildingKind, name?: string) =>
  buildings.push({ outline: o, height, kind, name });

// ── 아파트 단지 4곳 ─────────────────────────────────────────
// 잠실 일대는 30층 안팎 판상형/타워형이 격자로 늘어서 있다.
const COMPLEXES = [
  { cx: 520, cz: 180, cols: 6, rows: 5, name: '단지 A' },
  { cx: -520, cz: -120, cols: 5, rows: 5, name: '단지 B' },
  { cx: 260, cz: 720, cols: 6, rows: 4, name: '단지 C' },
  { cx: -420, cz: 700, cols: 5, rows: 4, name: '단지 D' },
];
for (const c of COMPLEXES) {
  for (let i = 0; i < c.cols; i++) {
    for (let j = 0; j < c.rows; j++) {
      if (rand() < 0.12) continue;   // 빈 자리 = 주차장·놀이터
      const floors = 18 + Math.floor(rand() * 18);
      add(
        box(c.cx + (i - c.cols / 2) * 62 + rand() * 8,
            c.cz + (j - c.rows / 2) * 78 + rand() * 8,
            18 + rand() * 6, 40 + rand() * 22, rand() * 0.2 - 0.1),
        floors * 2.9 + 1.2, 'apartment',
      );
    }
  }
  // 단지 상가·경로당 같은 저층
  for (let k = 0; k < 5; k++) {
    add(box(c.cx + (rand() - 0.5) * 300, c.cz + (rand() - 0.5) * 300,
            22 + rand() * 20, 14 + rand() * 14),
        6 + rand() * 6, 'retail');
  }
}

// ── 대로변 상가·오피스 ──────────────────────────────────────
for (let i = 0; i < 90; i++) {
  const along = (rand() - 0.5) * 1500;
  const side = rand() < 0.5 ? -1 : 1;
  add(box(along, side * (110 + rand() * 60), 16 + rand() * 26, 14 + rand() * 22, rand() * 0.1),
      12 + rand() * 40, 'commercial');
}

// ── 골목 저층 (빌라·다세대) ─────────────────────────────────
for (let i = 0; i < 160; i++) {
  const a = rand() * Math.PI * 2;
  const r = 300 + Math.sqrt(rand()) * 900;
  add(box(Math.cos(a) * r, Math.sin(a) * r * 0.9, 10 + rand() * 10, 9 + rand() * 9, rand() * Math.PI),
      7 + rand() * 9, 'lowrise');
}

// ── 학교·공공 ───────────────────────────────────────────────
for (let i = 0; i < 8; i++) {
  const a = rand() * Math.PI * 2;
  const r = 400 + rand() * 700;
  add(box(Math.cos(a) * r, Math.sin(a) * r, 70 + rand() * 40, 20 + rand() * 12),
      15 + rand() * 8, 'civic');
}

// ── 대형 시설 (사다리 상단을 메우는 것들) ───────────────────
add(box(-70, 40, 190, 110), 55, 'commercial', '롯데월드몰');
add(box(60, 265, 150, 130), 40, 'commercial', '롯데월드 어드벤처');
add(box(170, 330, 55, 55), 45, 'civic', '매직아일랜드 성');
add(blob(1180, 240, 130, 118, 20), 32, 'civic', '종합운동장');
add(box(1180, 480, 120, 90), 26, 'civic', '실내체육관');
add(box(0, 0, 72, 72), 555, 'commercial', '롯데월드타워');
add(box(70, -40, 60, 40), 18, 'civic', '잠실역');

// ── 수역 ────────────────────────────────────────────────────
const water: CityWater[] = [
  { outline: blob(-230, 300, 195, 130, 22), name: '석촌호수 서호' },
  { outline: blob(180, 320, 170, 120, 22), name: '석촌호수 동호' },
  // 한강 — 북쪽 전체를 가로지른다
  { outline: [[-1800, -820], [1800, -900], [1800, -1500], [-1800, -1420]], name: '한강' },
];

// ── 랜드마크 ────────────────────────────────────────────────
// 사다리 꼭대기는 분포가 아니라 손으로 놓는다.
// 마지막 두 번의 "두 배"는 물건 150개가 아니라 이 사건들이어야 한다.
const landmarks: CityLandmark[] = [
  {
    id: 'magic-island', name: '매직아일랜드 성', x: 170, z: 330,
    footprint: [55, 55], height: 45, edible: true,
    line: '저 성은 저작권이— 아, 이미 먹었네요. 모자이크 처리하겠습니다.',
  },
  {
    id: 'stadium', name: '종합운동장', x: 1180, z: 240,
    footprint: [260, 236], height: 32, edible: true,
    line: '경기장을 통째로요? 내일 경기 있는데. ...없대요. 계속하세요.',
  },
  {
    id: 'jamsil-bridge', name: '잠실대교', x: -340, z: -1050,
    footprint: [40, 620], height: 26, edible: true,
    line: '다리는 좀. 다리는 진짜 좀. ...아뇨 계속하세요. 시청률 올라갔어요.',
  },
  {
    id: 'lotte-mall', name: '롯데월드몰', x: -70, z: 40,
    footprint: [190, 110], height: 55, edible: true,
    line: '노트에 "서울의 랜드마크"라고 되어 있는데, 지금 그게 화면에서 사라졌습니다.',
  },
  {
    id: 'lotte-tower', name: '롯데월드타워', x: 0, z: 0,
    footprint: [72, 72], height: 555, edible: true,
    line: '아니 저건— 저건 555미터인데— ...예. 방송 마치겠습니다.',
  },
];

const data: CityData = {
  name: '잠실 (합성)',
  slug: 'jamsil',
  origin: { lat: 37.5125, lon: 127.1025 },
  radius: 1600,
  spawn: { x: -60, z: 470 },   // 석촌호수 서호 남쪽 산책로 (호수 밖)
  buildings, water, landmarks,
};

const out = resolve(process.cwd(), 'src/world/city.jamsil.json');
writeFileSync(out, JSON.stringify(data));
console.log(`건물 ${buildings.length}개, 수역 ${water.length}개, 랜드마크 ${landmarks.length}개 → ${out}`);
