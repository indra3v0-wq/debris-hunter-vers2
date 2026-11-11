/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

/**
 * Official State Flag of Mongolia & Soyombo Geometry
 * Defined according to the Constitution and Law of Mongolia on State Symbols.
 * 
 * Proportions: 1:2 (Height : Width)
 * Stripes: 3 equal vertical bars (Red, Eternal Blue, Red)
 * Hoist stripe (left): Official Golden Soyombo (#FFD700)
 * 
 * Soyombo Elements:
 * 1. Flame (3 tongues: past, present, future)
 * 2. Sun (disc) and Moon (crescent)
 * 3. Two triangles pointing DOWN (arrow/spear defense)
 * 4. Two horizontal bars (honesty, fairness)
 * 5. Two intertwining fish / Taijitu in center (vigilance, wisdom)
 * 6. Two vertical side pillars (fortress of unity)
 */

export const MONGOLIA_RED = '#DA2027'; // Pantone 485C
export const MONGOLIA_BLUE = '#003882'; // Pantone 286C
export const SOYOMBO_GOLD = '#FFD700'; // Pure Golden Yellow

/**
 * Official SVG Path data for the Soyombo symbol in a normalized 100 x 240 coordinate system
 */
export const SoyomboSVG: React.FC<{
  className?: string;
  color?: string;
  width?: number | string;
  height?: number | string;
}> = ({
  className = '',
  color = SOYOMBO_GOLD,
  width = '100%',
  height = '100%',
}) => {
  return (
    <svg
      viewBox="0 0 100 240"
      width={width}
      height={height}
      className={className}
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: 'visible' }}
    >
      {/* 1. FLAME WITH 3 TONGUES */}
      {/* Central Flame Tongue */}
      <path d="M50 8 C48 18 45 26 50 36 C55 26 52 18 50 8 Z" />
      {/* Left Flame Tongue */}
      <path d="M36 17 C34 24 37 31 43 36 C40 30 40 23 36 17 Z" />
      {/* Right Flame Tongue */}
      <path d="M64 17 C66 24 63 31 57 36 C60 30 60 23 64 17 Z" />

      {/* 2. SUN & MOON */}
      {/* Sun Disc */}
      <circle cx="50" cy="54" r="12" />
      {/* Moon Crescent beneath Sun */}
      <path d="M34 56 C34 70 66 70 66 56 C61 65 39 65 34 56 Z" />

      {/* 3. UPPER TRIANGLE (Points DOWN) */}
      <polygon points="36,78 64,78 50,94" />

      {/* 4. UPPER HORIZONTAL BAR */}
      <rect x="36" y="99" width="28" height="6" rx="1" />

      {/* 5. CENTER TWO FISH / TAIJITU (Aрга Билиг) */}
      <g transform="translate(50, 126)">
        {/* Outer Circle background */}
        <circle cx="0" cy="0" r="14" />
        {/* Negative space yin-yang cut */}
        <path
          d="M 0 -14 A 14 14 0 0 1 0 14 A 7 7 0 0 1 0 0 A 7 7 0 0 0 0 -14 Z"
          fill={MONGOLIA_RED}
        />
        {/* Fish Eye 1 */}
        <circle cx="0" cy="-7" r="2.2" fill={color} />
        {/* Fish Eye 2 */}
        <circle cx="0" cy="7" r="2.2" fill={MONGOLIA_RED} />
      </g>

      {/* 6. LOWER HORIZONTAL BAR */}
      <rect x="36" y="147" width="28" height="6" rx="1" />

      {/* 7. LOWER TRIANGLE (Points DOWN) */}
      <polygon points="36,158 64,158 50,174" />

      {/* 8. TWO VERTICAL PILLARS (Fortress walls) */}
      {/* Left Pillar */}
      <rect x="23" y="78" width="7" height="96" rx="1" />
      {/* Right Pillar */}
      <rect x="70" y="78" width="7" height="96" rx="1" />
    </svg>
  );
};

/**
 * Full Authentic State Flag of Mongolia as Vector Component
 */
export const MongolianFlag: React.FC<{
  className?: string;
  aspectRatio?: string;
  shadow?: boolean;
}> = ({ className = 'w-16 h-8', shadow = true }) => {
  return (
    <div
      className={`relative inline-flex overflow-hidden rounded-[2px] ${
        shadow ? 'shadow-md shadow-black/40' : ''
      } ${className}`}
      style={{ aspectRatio: '2 / 1' }}
      title="Монгол Улсын Төрийн Далбаа (State Flag of Mongolia)"
    >
      {/* 3 Equal Vertical Stripes */}
      <div className="w-1/3 h-full bg-[#DA2027] relative flex items-center justify-center p-[6%]">
        <SoyomboSVG className="w-full h-full object-contain" />
      </div>
      <div className="w-1/3 h-full bg-[#003882]" />
      <div className="w-1/3 h-full bg-[#DA2027]" />
    </div>
  );
};

/**
 * Draws the official Mongolian Flag onto an HTML5 2D Canvas with exact geometric proportions
 */
export function drawOfficialMongolianFlag(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const stripeW = width / 3;

  // Stripe 1: Left Red (Hoist)
  ctx.fillStyle = MONGOLIA_RED;
  ctx.fillRect(x, y, stripeW, height);

  // Stripe 2: Middle Eternal Blue
  ctx.fillStyle = MONGOLIA_BLUE;
  ctx.fillRect(x + stripeW, y, stripeW, height);

  // Stripe 3: Right Red (Fly)
  ctx.fillStyle = MONGOLIA_RED;
  ctx.fillRect(x + stripeW * 2, y, stripeW, height);

  // Center Soyombo in Left Red Stripe
  const soyomboCX = x + stripeW / 2;
  const soyomboCY = y + height / 2;
  const sScale = height / 260; // normalized to 240px tall soyombo

  ctx.save();
  ctx.translate(soyomboCX, soyomboCY - 120 * sScale);
  ctx.scale(sScale, sScale);

  ctx.fillStyle = SOYOMBO_GOLD;

  // 1. Flame
  ctx.beginPath();
  // Center tongue
  ctx.moveTo(0, -112);
  ctx.bezierCurveTo(-3, -100, -7, -90, 0, -80);
  ctx.bezierCurveTo(7, -90, 3, -100, 0, -112);
  ctx.fill();

  // Left tongue
  ctx.beginPath();
  ctx.moveTo(-16, -102);
  ctx.bezierCurveTo(-18, -94, -14, -86, -7, -80);
  ctx.bezierCurveTo(-10, -87, -11, -95, -16, -102);
  ctx.fill();

  // Right tongue
  ctx.beginPath();
  ctx.moveTo(16, -102);
  ctx.bezierCurveTo(18, -94, 14, -86, 7, -80);
  ctx.bezierCurveTo(10, -87, 11, -95, 16, -102);
  ctx.fill();

  // 2. Sun & Moon
  // Sun circle
  ctx.beginPath();
  ctx.arc(0, -62, 13, 0, Math.PI * 2);
  ctx.fill();

  // Moon crescent
  ctx.beginPath();
  ctx.arc(0, -60, 18, 0.15 * Math.PI, 0.85 * Math.PI, false);
  ctx.arc(0, -64, 14, 0.85 * Math.PI, 0.15 * Math.PI, true);
  ctx.closePath();
  ctx.fill();

  // 3. Upper Triangle (Points DOWN)
  ctx.beginPath();
  ctx.moveTo(-16, -38);
  ctx.lineTo(16, -38);
  ctx.lineTo(0, -22);
  ctx.closePath();
  ctx.fill();

  // 4. Upper Horizontal Bar
  ctx.fillRect(-16, -16, 32, 7);

  // 5. Center Two Fish / Taijitu (Арга Билиг)
  ctx.beginPath();
  ctx.arc(0, 12, 15, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = MONGOLIA_RED;
  ctx.beginPath();
  ctx.arc(0, 12, 15, -Math.PI / 2, Math.PI / 2, false);
  ctx.arc(0, 4.5, 7.5, Math.PI / 2, -Math.PI / 2, true);
  ctx.arc(0, 19.5, 7.5, Math.PI / 2, -Math.PI / 2, false);
  ctx.closePath();
  ctx.fill();

  // Eyes of the fish
  ctx.fillStyle = SOYOMBO_GOLD;
  ctx.beginPath();
  ctx.arc(0, 4.5, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = MONGOLIA_RED;
  ctx.beginPath();
  ctx.arc(0, 19.5, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // 6. Lower Horizontal Bar
  ctx.fillStyle = SOYOMBO_GOLD;
  ctx.fillRect(-16, 34, 32, 7);

  // 7. Lower Triangle (Points DOWN)
  ctx.beginPath();
  ctx.moveTo(-16, 46);
  ctx.lineTo(16, 46);
  ctx.lineTo(0, 62);
  ctx.closePath();
  ctx.fill();

  // 8. Two Vertical Pillars (Fortress walls)
  ctx.fillRect(-31, -38, 9, 100);
  ctx.fillRect(22, -38, 9, 100);

  ctx.restore();
}
