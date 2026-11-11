/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { drawOfficialMongolianFlag } from '../components/MongolianFlag';

function makeTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is unavailable');
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/** Blue Marble-style Earth map. Uses the procedural map instead of the misleading orange image asset. */
export function createEarthSurfaceTexture(): THREE.CanvasTexture {
  return makeTexture(2048, 1024, ctx => {
    const { width, height } = ctx.canvas;
    const ocean = ctx.createLinearGradient(0, 0, 0, height);
    ocean.addColorStop(0, '#183d70');
    ocean.addColorStop(0.5, '#1266a0');
    ocean.addColorStop(1, '#183d70');
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, width, height);

    const land = (points: [number, number][], color: string) => {
      ctx.beginPath();
      points.forEach(([x, y], i) => i ? ctx.lineTo(x * width, y * height) : ctx.moveTo(x * width, y * height));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };
    // Recognizable simplified continent silhouettes in an equirectangular projection.
    land([[.06,.20],[.12,.12],[.25,.14],[.32,.24],[.29,.34],[.24,.46],[.18,.43],[.14,.33],[.08,.28]], '#477a45');
    land([[.22,.48],[.31,.45],[.36,.55],[.34,.69],[.29,.86],[.25,.77],[.21,.60]], '#347347');
    land([[.34,.08],[.43,.07],[.42,.18],[.35,.20]], '#e6edf0');
    land([[.45,.22],[.54,.14],[.69,.13],[.84,.16],[.94,.23],[.88,.34],[.80,.43],[.76,.54],[.68,.46],[.60,.40],[.53,.42],[.46,.34]], '#527a46');
    land([[.47,.37],[.60,.35],[.64,.45],[.60,.61],[.55,.76],[.50,.65],[.44,.45]], '#b49a61');
    land([[.75,.65],[.86,.63],[.90,.73],[.85,.81],[.77,.79],[.73,.71]], '#a66f42');
    land([[.92,.76],[.94,.74],[.93,.82]], '#5a8050');
    // Biome accents: rainforest, desert, and high mountains.
    land([[.25,.52],[.31,.51],[.33,.59],[.29,.63],[.25,.58]], '#1f6240');
    land([[.49,.39],[.59,.38],[.60,.44],[.50,.45]], '#c7a466');
    land([[.67,.36],[.76,.37],[.73,.40],[.68,.40]], '#d7c18d');
    ctx.fillStyle = '#f5f8fa';
    ctx.fillRect(0, 0, width, height * .035);
    ctx.fillRect(0, height * .96, width, height * .04);
  });
}

/** Transparent white cloud map layered above the Earth surface. */
export function createEarthCloudTexture(): THREE.CanvasTexture {
  return makeTexture(1024, 512, ctx => {
    ctx.clearRect(0, 0, 1024, 512);
    for (let i = 0; i < 190; i++) {
      const x = Math.random() * 1024;
      const y = 35 + Math.random() * 440;
      const rx = 15 + Math.random() * 75;
      const ry = 4 + Math.random() * 16;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, rx);
      gradient.addColorStop(0, 'rgba(255,255,255,0.76)');
      gradient.addColorStop(.55, 'rgba(255,255,255,0.40)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, (Math.random() - .5) * .2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export function createEarthNightTexture(): THREE.CanvasTexture {
  return makeTexture(1024, 512, ctx => {
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, 1024, 512);
    for (const [x, y] of [[.23,.29],[.51,.31],[.59,.37],[.73,.32],[.80,.35],[.56,.52],[.83,.68]]) {
      for (let i = 0; i < 80; i++) {
        ctx.fillStyle = Math.random() > .3 ? 'rgba(255,190,75,.9)' : 'rgba(255,245,210,.9)';
        ctx.fillRect(x * 1024 + (Math.random() - .5) * 55, y * 512 + (Math.random() - .5) * 32, 2, 2);
      }
    }
  });
}

export function createEarthSpecularTexture(): THREE.CanvasTexture {
  return makeTexture(512, 256, ctx => {
    ctx.fillStyle = '#303030'; ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#d0d0d0';
    for (const p of [[[.06,.2],[.32,.24],[.24,.46]],[[.22,.48],[.36,.55],[.29,.86]],[[.45,.22],[.94,.23],[.76,.54]],[[.47,.37],[.64,.45],[.55,.76]],[[.75,.65],[.90,.73],[.77,.79]]]) {
      ctx.beginPath(); p.forEach(([x,y], i) => i ? ctx.lineTo(x * 512, y * 256) : ctx.moveTo(x * 512, y * 256)); ctx.closePath(); ctx.fill();
    }
  });
}

export function createEarthBumpTexture(): THREE.CanvasTexture {
  return makeTexture(512, 256, ctx => {
    ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = '#b0b0b0'; ctx.lineWidth = 5;
    for (const [x1,y1,x2,y2] of [[.68,.39,.77,.38],[.23,.52,.27,.82],[.16,.22,.22,.40]]) {
      ctx.beginPath(); ctx.moveTo(x1 * 512,y1 * 256); ctx.lineTo(x2 * 512,y2 * 256); ctx.stroke();
    }
  });
}

export function createMoonTexture(): THREE.CanvasTexture {
  return makeTexture(1024, 512, ctx => {
    ctx.fillStyle = '#b8bec8'; ctx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 150; i++) {
      const x = Math.random() * 1024, y = Math.random() * 512, r = 2 + Math.random() * 17;
      ctx.fillStyle = 'rgba(65,72,83,.55)'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(245,248,255,.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x - 1, y - 1, r, 0, Math.PI * 2); ctx.stroke();
    }
  });
}

export function createMilkyWaySkyboxTexture(): THREE.CanvasTexture {
  return makeTexture(1024, 512, ctx => {
    ctx.fillStyle = '#01030a'; ctx.fillRect(0, 0, 1024, 512);
    const band = ctx.createLinearGradient(0, 190, 0, 340);
    band.addColorStop(0, 'rgba(99,102,241,0)'); band.addColorStop(.5, 'rgba(99,102,241,.24)'); band.addColorStop(1, 'rgba(99,102,241,0)');
    ctx.fillStyle = band; ctx.fillRect(0, 160, 1024, 220);
    for (let i = 0; i < 1800; i++) {
      const b = 150 + Math.floor(Math.random() * 106);
      ctx.fillStyle = `rgba(${b},${b},255,${.35 + Math.random() * .65})`;
      ctx.fillRect(Math.random() * 1024, Math.random() * 512, Math.random() > .97 ? 2 : 1, 1);
    }
  });
}

export function createMarsTexture(): THREE.CanvasTexture {
  return makeTexture(512, 256, ctx => {
    ctx.fillStyle = '#b44a28'; ctx.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 45; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(70,30,20,.36)' : 'rgba(230,130,75,.28)';
      ctx.beginPath(); ctx.ellipse(Math.random()*512, Math.random()*256, 8+Math.random()*45, 4+Math.random()*18, Math.random(), 0, Math.PI*2); ctx.fill();
    }
    ctx.fillStyle = '#f1f5f9'; ctx.fillRect(0, 0, 512, 7); ctx.fillRect(0, 249, 512, 7);
  });
}

/** Kept as a compatibility export; the space scene now uses an Earth-like Blue Marble map. */
export function createJupiterTexture(): THREE.CanvasTexture {
  return createEarthSurfaceTexture();
}

export function createSaturnRingTexture(): THREE.CanvasTexture {
  return makeTexture(512, 64, ctx => {
    const grad = ctx.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(.15, 'rgba(190,165,125,.65)');
    grad.addColorStop(.4, 'rgba(220,195,150,.95)'); grad.addColorStop(.68, 'rgba(20,15,10,.05)');
    grad.addColorStop(.74, 'rgba(205,180,140,.85)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 512, 64);
  });
}

export function createGoldMliTexture(): THREE.CanvasTexture {
  return makeTexture(512, 512, ctx => {
    ctx.fillStyle = '#d49b28'; ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#996515'; ctx.lineWidth = 1.5;
    for (let x = 0; x <= 512; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke(); }
    for (let y = 0; y <= 512; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke(); }
  });
}

export function createSolarPanelTexture(): THREE.CanvasTexture {
  return makeTexture(512, 512, ctx => {
    ctx.fillStyle = '#081736'; ctx.fillRect(0, 0, 512, 512);
    for (let x = 0; x < 512; x += 64) for (let y = 0; y < 512; y += 64) {
      ctx.fillStyle = '#123575'; ctx.fillRect(x + 3, y + 3, 58, 58);
      ctx.strokeStyle = 'rgba(200,225,255,.5)'; ctx.strokeRect(x + 3, y + 3, 58, 58);
    }
  });
}

export function createHullPanelTexture(): THREE.CanvasTexture {
  return makeTexture(512, 512, ctx => {
    ctx.fillStyle = '#222938'; ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#64748b';
    for (let x = 0; x <= 512; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke(); }
    for (let y = 0; y <= 512; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke(); }
  });
}

export function createCapsuleHeatShieldTexture(): THREE.CanvasTexture {
  return makeTexture(1024, 1024, ctx => {
    ctx.fillStyle = '#11141a'; ctx.fillRect(0, 0, 1024, 1024);
    for (let x = 0; x < 1024; x += 64) for (let y = 0; y < 1024; y += 64) {
      ctx.fillStyle = `rgb(${18 + Math.floor(Math.random()*14)},20,24)`; ctx.fillRect(x+3,y+3,58,58);
      ctx.strokeStyle = '#05070a'; ctx.strokeRect(x,y,64,64);
    }
  });
}

export function createCapsuleHullTileTexture(): THREE.CanvasTexture {
  return makeTexture(1024, 1024, ctx => {
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, 1024, 1024);
    ctx.strokeStyle = 'rgba(100,116,139,.45)';
    for (let x = 0; x <= 1024; x += 128) for (let y = 0; y <= 1024; y += 96) ctx.strokeRect(x,y,128,96);
    drawOfficialMongolianFlag(ctx, 740, 80, 120, 60);
    ctx.fillStyle = '#0f172a'; ctx.font = 'bold 16px sans-serif'; ctx.fillText('QUASAR // ORBITAL GUARDIAN', 100, 120);
  });
}

export function createCockpitDisplayTexture(): THREE.CanvasTexture {
  return makeTexture(1024, 1024, ctx => {
    ctx.fillStyle = '#030712'; ctx.fillRect(0, 0, 1024, 1024);
    ctx.strokeStyle = '#0284c7'; ctx.lineWidth = 3;
    [[32,32,460,440],[520,32,460,440],[32,510,950,470]].forEach(([x,y,w,h]) => ctx.strokeRect(x,y,w,h));
    ctx.fillStyle = '#10b981'; ctx.font = 'bold 18px monospace'; ctx.fillText('SPACECRAFT SYSTEMS // NOMINAL', 55, 550);
    ctx.fillStyle = '#38bdf8'; ctx.fillText('ORBITAL MAP // EARTH', 545, 62);
    ctx.beginPath(); ctx.arc(750, 250, 80, 0, Math.PI*2); ctx.stroke();
  });
}

export function createRocketHullDetailTexture(): THREE.CanvasTexture {
  return makeTexture(2048, 1024, ctx => {
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, 2048, 1024);
    ctx.strokeStyle = 'rgba(71,85,105,.45)'; ctx.lineWidth = 2;
    for (let y = 100; y < 1024; y += 160) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(2048,y); ctx.stroke(); }
    drawOfficialMongolianFlag(ctx, 1500, 420, 180, 90);
    ctx.fillStyle = '#0f172a'; ctx.font = 'bold 30px monospace'; ctx.fillText('QUASAR // MONGOLIA SPACE PROGRAM', 60, 120);
  });
}

export function createCarbonInterstageTexture(): THREE.CanvasTexture {
  return makeTexture(512, 512, ctx => {
    ctx.fillStyle = '#0b0f19'; ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = '#1e293b';
    for (let x = 0; x < 512; x += 16) for (let y = 0; y < 512; y += 16) if (((x+y)/16)%2===0) ctx.fillRect(x,y,16,16);
  });
}

export function createEngineNozzleTexture(): THREE.CanvasTexture {
  return makeTexture(512, 512, ctx => {
    const grad = ctx.createLinearGradient(0,0,0,512); grad.addColorStop(0,'#b45309'); grad.addColorStop(.3,'#334155'); grad.addColorStop(1,'#0f172a');
    ctx.fillStyle = grad; ctx.fillRect(0,0,512,512);
    ctx.strokeStyle = 'rgba(255,255,255,.16)'; for(let y=10;y<512;y+=14){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke();}
  });
}

export function createRocketDecalTexture(): THREE.CanvasTexture {
  return makeTexture(512, 512, ctx => {
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(0,0,512,512);
    drawOfficialMongolianFlag(ctx, 136, 60, 240, 120);
    ctx.fillStyle = '#0f172a'; ctx.textAlign = 'center'; ctx.font = 'bold 36px sans-serif'; ctx.fillText('QUASAR',256,240);
    ctx.font = '16px monospace'; ctx.fillText('ORBITAL GUARDIAN',256,275);
  });
}
