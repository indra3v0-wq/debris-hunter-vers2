/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { 
  createRocketDecalTexture, 
  createMoonTexture,
  createMilkyWaySkyboxTexture,
  createMarsTexture,
  createJupiterTexture,
  createSaturnRingTexture
} from './proceduralTextures';

import { RocketConfig, SpacecraftDesign } from '../types';
import { DEFAULT_ROCKET_CONFIG } from '../simulation/data';
import { buildModularRocket } from './rocketBuilder';
import { buildModularSpacecraft } from './spacecraftBuilder';
import { createLaunchPadEnvironment } from './launchPadEnvironment';
import { createNasaEarthMesh } from './proceduralEarth';

export type LaunchCameraMode = 'chase' | 'pad' | 'tracking' | 'booster' | 'cockpit' | 'spacecraft' | 'free';

export interface LaunchTelemetryData {
  phaseKey: string;
  altitudeKm: number;
  velocityKms: number;
  downrangeKm: number;
  mach: number;
  dynamicPressureKpa: number;
  gForce: number;
  throttlePct: number;
  isFairingSeparated: boolean;
  isBoosterSeparated: boolean;
  isPayloadDeployed: boolean;
  pitchDeg: number;
  rollDeg: number;
  headingDeg: number;
}

export interface LaunchSceneBundle {
  group: THREE.Group;
  camera: THREE.PerspectiveCamera;
  updateSequence: (progress: number, delta: number) => LaunchTelemetryData;
  setCameraMode: (mode: LaunchCameraMode) => void;
  dispose: () => void;
}

export function buildRealisticLaunchScene(
  containerWidth: number, 
  containerHeight: number,
  rocketConfig?: RocketConfig,
  spacecraftDesign?: SpacecraftDesign
): LaunchSceneBundle {
  const root = new THREE.Group();
  const geometriesToDispose: THREE.BufferGeometry[] = [];
  const materialsToDispose: THREE.Material[] = [];
  const texturesToDispose: THREE.Texture[] = [];

  const activeConfig = rocketConfig || DEFAULT_ROCKET_CONFIG;

  // ================= 1. EXHAUST & SPECIAL EFFECTS MATERIALS =================
  const propellant = activeConfig.engine?.type || 'kerolox';
  let coreColor = 0xffffff;
  let outerColor = 0xff5500;
  if (propellant === 'methalox') {
    coreColor = 0x67e8f9;
    outerColor = 0x2563eb;
  } else if (propellant === 'hydrolox') {
    coreColor = 0xa5f3fc;
    outerColor = 0x38bdf8;
  }

  const flameCoreMat = new THREE.MeshBasicMaterial({
    color: coreColor,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.95,
  });
  materialsToDispose.push(flameCoreMat);

  const flameOuterMat = new THREE.MeshBasicMaterial({
    color: outerColor,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.85,
  });
  materialsToDispose.push(flameOuterMat);

  const vaporConeMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  materialsToDispose.push(vaporConeMat);

  // ================= 2. GROUND LAUNCH COMPLEX & UMBILICAL GANTRY =================
  // Uses the full ground launch pad with concrete table, umbilical tower, flame deflector trench,
  // swing arms, deluge steam particles, and hold-down clamps
  const padBundle = createLaunchPadEnvironment(true);
  padBundle.group.position.set(0, 0, 0);
  root.add(padBundle.group);

  // Pad Floodlights
  const padSpot1 = new THREE.SpotLight(0xfff5ea, 5, 45, Math.PI / 4, 0.3);
  padSpot1.position.set(-6, 2, 8);
  padSpot1.target.position.set(0, 8, 0);
  root.add(padSpot1);
  root.add(padSpot1.target);

  const padSpot2 = new THREE.SpotLight(0x38bdf8, 4, 45, Math.PI / 4, 0.3);
  padSpot2.position.set(8, 2, -6);
  padSpot2.target.position.set(0, 8, 0);
  root.add(padSpot2);
  root.add(padSpot2.target);

  // ================= 3. REALISTIC PROCEDURAL 3D EARTH =================
  // High-fidelity Earth with natural green/blue/brown biomes, multi-layered rotating clouds,
  // and thin blue Rayleigh scattering atmospheric glow
  const earthRadius = 75;
  const earthBundle = createNasaEarthMesh(earthRadius, false);
  earthBundle.group.position.set(0, -earthRadius - 1.2, 0);
  earthBundle.group.rotation.y = -Math.PI / 4;
  root.add(earthBundle.group);

  // ================= 4. NASA MILKY WAY SKYBOX & SOLAR SYSTEM PLANETS =================
  // Milky Way Skybox Dome
  const skyRadius = 450;
  const skyGeo = new THREE.SphereGeometry(skyRadius, 32, 32);
  geometriesToDispose.push(skyGeo);
  const skyTex = createMilkyWaySkyboxTexture();
  texturesToDispose.push(skyTex);
  const skyMat = new THREE.MeshBasicMaterial({
    map: skyTex,
    side: THREE.BackSide,
    depthWrite: false,
  });
  materialsToDispose.push(skyMat);
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  root.add(skyDome);

  // 3D Moon in upper sky
  const moonRadius = 6.5;
  const moonGeo = new THREE.SphereGeometry(moonRadius, 32, 32);
  geometriesToDispose.push(moonGeo);
  const moonTex = createMoonTexture();
  texturesToDispose.push(moonTex);
  const moonMat = new THREE.MeshStandardMaterial({
    map: moonTex,
    roughness: 0.9,
    metalness: 0.05,
  });
  materialsToDispose.push(moonMat);
  const moonMesh = new THREE.Mesh(moonGeo, moonMat);
  moonMesh.position.set(-65, 120, -110);
  root.add(moonMesh);

  // MARS (Red Planet) in sky
  const marsGeo = new THREE.SphereGeometry(1.6, 20, 20);
  geometriesToDispose.push(marsGeo);
  const marsTex = createMarsTexture();
  texturesToDispose.push(marsTex);
  const marsMat = new THREE.MeshStandardMaterial({ map: marsTex, roughness: 0.85 });
  materialsToDispose.push(marsMat);
  const marsMesh = new THREE.Mesh(marsGeo, marsMat);
  marsMesh.position.set(130, 95, -160);
  root.add(marsMesh);

  // JUPITER (Gas Giant with Banded Atmosphere & Great Red Spot)
  const jupiterGeo = new THREE.SphereGeometry(5.0, 24, 24);
  geometriesToDispose.push(jupiterGeo);
  const jupiterTex = createJupiterTexture();
  texturesToDispose.push(jupiterTex);
  const jupiterMat = new THREE.MeshStandardMaterial({ map: jupiterTex, roughness: 0.7 });
  materialsToDispose.push(jupiterMat);
  const jupiterMesh = new THREE.Mesh(jupiterGeo, jupiterMat);
  jupiterMesh.position.set(-170, 60, -220);
  root.add(jupiterMesh);

  // SATURN (With Rings)
  const saturnGroup = new THREE.Group();
  saturnGroup.position.set(190, 80, -240);
  root.add(saturnGroup);
  const saturnGeo = new THREE.SphereGeometry(3.6, 24, 24);
  geometriesToDispose.push(saturnGeo);
  const saturnMat = new THREE.MeshStandardMaterial({ color: 0xecd59f, roughness: 0.65 });
  materialsToDispose.push(saturnMat);
  const saturnBody = new THREE.Mesh(saturnGeo, saturnMat);
  saturnGroup.add(saturnBody);

  const ringGeo = new THREE.RingGeometry(4.8, 8.8, 48);
  geometriesToDispose.push(ringGeo);
  const ringTex = createSaturnRingTexture();
  texturesToDispose.push(ringTex);
  const ringMat = new THREE.MeshBasicMaterial({
    map: ringTex,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
  });
  materialsToDispose.push(ringMat);
  const saturnRings = new THREE.Mesh(ringGeo, ringMat);
  saturnRings.rotation.x = Math.PI / 2.3;
  saturnGroup.add(saturnRings);

  // Deep Space Starfield
  const starCount = 800;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const v = new THREE.Vector3(
      (Math.random() - 0.5) * 500,
      Math.random() * 250 + 20,
      (Math.random() - 0.5) * 500
    );
    starPos[i * 3] = v.x;
    starPos[i * 3 + 1] = v.y;
    starPos[i * 3 + 2] = v.z;

    const tempRand = Math.random();
    if (tempRand < 0.25) {
      starColors[i * 3] = 0.7; starColors[i * 3 + 1] = 0.85; starColors[i * 3 + 2] = 1.0;
    } else if (tempRand < 0.75) {
      starColors[i * 3] = 1.0; starColors[i * 3 + 1] = 1.0; starColors[i * 3 + 2] = 1.0;
    } else {
      starColors[i * 3] = 1.0; starColors[i * 3 + 1] = 0.85; starColors[i * 3 + 2] = 0.6;
    }
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
  geometriesToDispose.push(starGeo);

  const starMat = new THREE.PointsMaterial({
    vertexColors: true,
    size: 1.2,
    transparent: true,
    opacity: 0.85,
  });
  materialsToDispose.push(starMat);
  const starField = new THREE.Points(starGeo, starMat);
  root.add(starField);

  // ================= 5. ASCENT SMOKE TRAIL PARTICLE SYSTEM =================
  const smokeCount = 140;
  const smokeParticles: {
    mesh: THREE.Mesh;
    worldPos: THREE.Vector3;
    scale: number;
    opacity: number;
    active: boolean;
    lifetime: number;
  }[] = [];

  const smokeGroup = new THREE.Group();
  root.add(smokeGroup);

  const smokeSphereGeo = new THREE.SphereGeometry(0.8, 8, 8);
  geometriesToDispose.push(smokeSphereGeo);

  for (let i = 0; i < smokeCount; i++) {
    const sMat = new THREE.MeshBasicMaterial({
      color: 0xf1f5f9,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    materialsToDispose.push(sMat);
    const sm = new THREE.Mesh(smokeSphereGeo, sMat);
    sm.visible = false;
    smokeGroup.add(sm);
    smokeParticles.push({
      mesh: sm,
      worldPos: new THREE.Vector3(),
      scale: 1,
      opacity: 0,
      active: false,
      lifetime: 0,
    });
  }
  let nextSmokeIdx = 0;

  // ================= 6. EXACT ASSEMBLED ROCKET VEHICLE =================
  // Built directly via buildModularRocket using the player's customized configuration!
  const rocketRoot = new THREE.Group();
  root.add(rocketRoot);

  const modularRocket = buildModularRocket(activeConfig);
  rocketRoot.add(modularRocket.group);

  // Attach supersonic exhaust plumes to Stage 1 Engine Cluster
  const flameGroup = new THREE.Group();
  flameGroup.position.y = -0.15;
  modularRocket.parts.stage1Group.add(flameGroup);

  const coreFlameGeo = new THREE.ConeGeometry(0.7, 5.5, 16);
  geometriesToDispose.push(coreFlameGeo);
  const coreFlame = new THREE.Mesh(coreFlameGeo, flameCoreMat);
  coreFlame.rotation.x = Math.PI;
  coreFlame.position.y = -2.8;
  flameGroup.add(coreFlame);

  const outerFlameGeo = new THREE.ConeGeometry(1.6, 7.5, 20);
  geometriesToDispose.push(outerFlameGeo);
  const outerFlame = new THREE.Mesh(outerFlameGeo, flameOuterMat);
  outerFlame.rotation.x = Math.PI;
  outerFlame.position.y = -3.8;
  flameGroup.add(outerFlame);

  // Mach diamonds inside the exhaust jet
  const machDiamonds: THREE.Mesh[] = [];
  for (let d = 0; d < 4; d++) {
    const diamondGeo = new THREE.OctahedronGeometry(0.25 - d * 0.04, 0);
    geometriesToDispose.push(diamondGeo);
    const diamond = new THREE.Mesh(diamondGeo, flameCoreMat);
    diamond.position.y = -1.2 - d * 1.3;
    flameGroup.add(diamond);
    machDiamonds.push(diamond);
  }

  // Side Boosters Exhaust Flames
  const sideBoosterFlames: THREE.Group[] = [];
  modularRocket.parts.sideBoosters.forEach(booster => {
    const bFlame = new THREE.Group();
    bFlame.position.y = -0.1;

    const bCoreFlameGeo = new THREE.ConeGeometry(0.32, 3.8, 14);
    geometriesToDispose.push(bCoreFlameGeo);
    const bCoreFlame = new THREE.Mesh(bCoreFlameGeo, flameCoreMat);
    bCoreFlame.rotation.x = Math.PI;
    bCoreFlame.position.y = -1.9;
    bFlame.add(bCoreFlame);

    const bOuterFlameGeo = new THREE.ConeGeometry(0.75, 4.8, 16);
    geometriesToDispose.push(bOuterFlameGeo);
    const bOuterFlame = new THREE.Mesh(bOuterFlameGeo, flameOuterMat);
    bOuterFlame.rotation.x = Math.PI;
    bOuterFlame.position.y = -2.4;
    bFlame.add(bOuterFlame);

    booster.add(bFlame);
    sideBoosterFlames.push(bFlame);
  });

  // Transonic Vapor Cone (Condensation collar at Max-Q)
  const vaporConeGeo = new THREE.ConeGeometry(1.8, 1.2, 24, 1, true);
  geometriesToDispose.push(vaporConeGeo);
  const vaporCone = new THREE.Mesh(vaporConeGeo, vaporConeMat);
  vaporCone.position.set(0, 7.5, 0);
  modularRocket.parts.stage1Group.add(vaporCone);

  // Stage 2 Vacuum Flame (Blue/Violet expansion plume)
  const vacFlameGeo = new THREE.ConeGeometry(1.8, 4.5, 16);
  geometriesToDispose.push(vacFlameGeo);
  const vacFlameMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
  });
  materialsToDispose.push(vacFlameMat);
  const vacFlame = new THREE.Mesh(vacFlameGeo, vacFlameMat);
  vacFlame.rotation.x = Math.PI;
  vacFlame.position.y = 0.42;
  modularRocket.parts.stage2Group.add(vacFlame);

  // Embed User's customized Spacecraft inside the payload berth
  let customSpacecraftBundle: ReturnType<typeof buildModularSpacecraft> | null = null;
  if (spacecraftDesign) {
    customSpacecraftBundle = buildModularSpacecraft(spacecraftDesign);
    customSpacecraftBundle.group.scale.set(0.38, 0.38, 0.38);
    customSpacecraftBundle.group.position.set(0, 0.85, 0);
    modularRocket.parts.payloadGroup.add(customSpacecraftBundle.group);
  }

  // ================= 7. CINEMATIC CAMERA SYSTEM =================
  const camera = new THREE.PerspectiveCamera(48, containerWidth / containerHeight, 0.1, 800);
  camera.position.set(0, 10, 26);

  let currentCamMode: LaunchCameraMode = 'chase';
  const cameraTarget = new THREE.Vector3(0, 8, 0);
  const currentCamPos = new THREE.Vector3(0, 10, 26);

  const setCameraMode = (mode: LaunchCameraMode) => {
    currentCamMode = mode;
  };

  // Initial booster positions for separation math
  const initialBoosterPositions = modularRocket.parts.sideBoosters.map(b => b.position.clone());

  // ================= 8. FLIGHT TIMELINE & SIMULATION TICK =================
  const updateSequence = (progress: number, delta: number): LaunchTelemetryData => {
    // Atmospheric rotation of Earth
    earthBundle.update(delta);
    padBundle.update(delta);

    let phaseKey = 'padHold';
    let altitudeKm = 0;
    let velocityKms = 0;
    let downrangeKm = 0;
    let mach = 0;
    let dynamicPressureKpa = 0;
    let gForce = 1.0;
    let throttlePct = 0;
    let isFairingSeparated = false;
    let isBoosterSeparated = false;
    let isPayloadDeployed = false;
    let pitchDeg = 90;
    let rollDeg = 0;
    let headingDeg = 90;

    if (progress <= 0.05) {
      // Countdown & Ignition on the launch pad table
      phaseKey = progress > 0.02 ? 'ignition' : 'countdown';
      throttlePct = progress > 0.02 ? 100 : 0;
      gForce = progress > 0.02 ? 1.2 : 1.0;

      // Deluge water steam & swing arm retraction
      padBundle.setSteamDensity(progress > 0.02 ? Math.min(0.85, (progress - 0.02) * 30) : 0);
      if (progress > 0.03) {
        padBundle.retractArms(Math.min(1.0, (progress - 0.03) * 30));
      }

      flameGroup.visible = progress > 0.02;
      coreFlame.scale.set(1, 0.4 + Math.random() * 0.2, 1);
      outerFlame.scale.set(1, 0.4 + Math.random() * 0.2, 1);
      sideBoosterFlames.forEach(f => {
        f.visible = progress > 0.02;
      });
    } else if (progress <= 0.15) {
      // Liftoff & Tower Clear (Ground launch complex recedes downward)
      phaseKey = progress < 0.09 ? 'liftoff' : 'towerClear';
      const p = (progress - 0.05) / 0.10;
      altitudeKm = p * 12.0;
      velocityKms = p * 0.72;
      downrangeKm = p * 1.5;
      mach = velocityKms / 0.34;
      gForce = 1.3 + p * 0.5;
      throttlePct = 100;
      pitchDeg = 90 - p * 5;
      rollDeg = p * 12; // Roll program to flight azimuth 90°
      headingDeg = 90;

      rocketRoot.position.y = p * 18.0;
      rocketRoot.rotation.z = -p * 0.05;

      padBundle.retractArms(1.0);
      padBundle.setSteamDensity(Math.max(0, 0.85 - p * 1.5));

      flameGroup.visible = true;
      const flicker = 1 + Math.sin(Date.now() * 0.05) * 0.12;
      coreFlame.scale.set(1, flicker * 1.2, 1);
      outerFlame.scale.set(1, flicker * 1.3, 1);
      sideBoosterFlames.forEach(f => {
        f.visible = true;
      });
    } else if (progress <= 0.35) {
      // Gravity Turn & Max-Q (Troposphere to Stratosphere)
      const p = (progress - 0.15) / 0.20;
      phaseKey = p > 0.4 ? 'maxQ' : 'gravityTurn';
      altitudeKm = 12.0 + p * 38.0;
      velocityKms = 0.72 + p * 1.6;
      downrangeKm = 1.5 + p * 32.0;
      mach = velocityKms / 0.31;
      dynamicPressureKpa = Math.sin(p * Math.PI) * 38.5;
      gForce = 1.8 + p * 1.1;
      throttlePct = dynamicPressureKpa > 30 ? 75 : 100;
      pitchDeg = 85 - p * 35; // 85° down to 50°
      rollDeg = 12;
      headingDeg = 90;

      rocketRoot.position.y = 18.0 + p * 35.0;
      rocketRoot.position.x = p * 18.0;
      rocketRoot.rotation.z = -0.05 - p * 0.35;

      // Vapor Cone condensation at Max-Q
      const coneP = Math.max(0, Math.sin(p * Math.PI));
      vaporConeMat.opacity = coneP * 0.65;
      vaporCone.scale.set(1 + coneP * 0.25, 1, 1 + coneP * 0.25);

      flameGroup.visible = true;
      const flicker = 1 + Math.sin(Date.now() * 0.08) * 0.15;
      outerFlame.scale.set(1 + p * 0.5, flicker * 1.5, 1 + p * 0.5);
    } else if (progress <= 0.50) {
      // MECO & Booster Separation (Mesosphere)
      const p = (progress - 0.35) / 0.15;
      phaseKey = p < 0.4 ? 'meco' : 'boosterSep';
      altitudeKm = 50.0 + p * 32.0;
      velocityKms = 2.32 + p * 0.95;
      downrangeKm = 33.5 + p * 48.0;
      mach = 7.5 + p * 3.0;
      dynamicPressureKpa = Math.max(0, 15 - p * 15);
      gForce = p < 0.2 ? 0.2 : 1.1;
      throttlePct = p < 0.3 ? 0 : 100;
      pitchDeg = 50 - p * 20; // 50° down to 30°
      rollDeg = 12;
      headingDeg = 90;
      vaporConeMat.opacity = 0;

      rocketRoot.position.y = 53.0 + p * 28.0;
      rocketRoot.position.x = 18.0 + p * 25.0;
      rocketRoot.rotation.z = -0.40 - p * 0.18;

      if (p >= 0.3) {
        isBoosterSeparated = true;
        flameGroup.visible = false;
        sideBoosterFlames.forEach(f => {
          f.visible = false;
        });

        const sepP = (p - 0.3) / 0.7;

        // Side boosters jettison outward radially
        modularRocket.parts.sideBoosters.forEach((booster, bIdx) => {
          const initP = initialBoosterPositions[bIdx] || booster.position;
          const dir = new THREE.Vector3(initP.x, 0, initP.z).normalize();
          booster.position.x = initP.x + dir.x * sepP * 5.0;
          booster.position.z = initP.z + dir.z * sepP * 5.0;
          booster.position.y = initP.y - sepP * 6.0;
          booster.rotation.z += 0.01;
        });

        // Stage 1 core drops back
        modularRocket.parts.stage1Group.position.y = -sepP * 14.0;
        modularRocket.parts.stage1Group.position.x = -sepP * 6.0;
        modularRocket.parts.stage1Group.rotation.z += 0.006;

        // Grid fins deploy
        modularRocket.parts.gridFins.forEach(f => {
          f.rotation.z = THREE.MathUtils.damp(f.rotation.z, Math.PI / 2, 8, delta);
        });

        vacFlameMat.opacity = 0.85;
      }
    } else if (progress <= 0.70) {
      // Stage 2 Vacuum Burn & Fairing Jettison (Thermosphere)
      const p = (progress - 0.50) / 0.20;
      phaseKey = p > 0.3 ? 'fairingSep' : 's2Ignition';
      altitudeKm = 82.0 + p * 115.0;
      velocityKms = 3.27 + p * 2.65;
      downrangeKm = 81.5 + p * 145.0;
      mach = 10.5 + p * 8.5;
      dynamicPressureKpa = 0;
      gForce = 2.2 + p * 0.8;
      throttlePct = 100;
      pitchDeg = 30 - p * 20; // 30° down to 10°
      rollDeg = 12;
      headingDeg = 90;
      isBoosterSeparated = true;

      rocketRoot.position.y = 81.0 + p * 30.0;
      rocketRoot.position.x = 43.0 + p * 40.0;
      rocketRoot.rotation.z = -0.58 - p * 0.22;

      // Fairing separation
      if (p >= 0.3) {
        isFairingSeparated = true;
        const fairingP = (p - 0.3) / 0.7;
        modularRocket.parts.fairingLeft.position.x = -fairingP * 7.0;
        modularRocket.parts.fairingLeft.position.y = 1.8 - fairingP * 5.0;
        modularRocket.parts.fairingLeft.rotation.z = -fairingP * 0.9;

        modularRocket.parts.fairingRight.position.x = fairingP * 7.0;
        modularRocket.parts.fairingRight.position.y = 1.8 - fairingP * 5.0;
        modularRocket.parts.fairingRight.rotation.z = fairingP * 0.9;
      }

      vacFlameMat.opacity = 0.9 + Math.sin(Date.now() * 0.05) * 0.1;
      vacFlame.scale.set(1.4 + p * 0.6, 1 + Math.sin(Date.now() * 0.08) * 0.2, 1.4 + p * 0.6);
    } else if (progress <= 0.88) {
      // Orbital Insertion (SECO)
      const p = (progress - 0.70) / 0.18;
      phaseKey = p > 0.85 ? 'seco' : 'orbitAchieved';
      altitudeKm = 197.0 + p * 323.0;
      velocityKms = 5.92 + p * 1.82;
      downrangeKm = 226.5 + p * 380.0;
      mach = 19.0 + p * 5.5;
      dynamicPressureKpa = 0;
      gForce = p > 0.85 ? 0.0 : 3.2;
      throttlePct = p > 0.85 ? 0 : 100;
      pitchDeg = 10 - p * 10; // 10° down to 0° (horizontal to Earth surface)
      rollDeg = 0;
      headingDeg = 90;
      isBoosterSeparated = true;
      isFairingSeparated = true;

      rocketRoot.position.y = 111.0 + p * 20.0;
      rocketRoot.position.x = 83.0 + p * 60.0;
      rocketRoot.rotation.z = -0.80 - p * 0.15;

      if (p > 0.85) {
        vacFlameMat.opacity = 0;
      }
    } else {
      // Spacecraft Deployment & Solar Arrays
      const p = (progress - 0.88) / 0.12;
      phaseKey = 'deploySuccess';
      altitudeKm = 520.0;
      velocityKms = 7.74;
      downrangeKm = 606.5 + p * 150.0;
      mach = 24.5;
      gForce = 0.0;
      throttlePct = 0;
      pitchDeg = 0;
      rollDeg = 0;
      headingDeg = 90;
      isBoosterSeparated = true;
      isFairingSeparated = true;
      isPayloadDeployed = true;

      vacFlameMat.opacity = 0;

      modularRocket.parts.payloadGroup.position.y = 5.2 + p * 5.0;
      if (customSpacecraftBundle) {
        customSpacecraftBundle.group.rotation.y += delta * 0.35;
        customSpacecraftBundle.update(delta);
      }
    }

    // ================= DYNAMIC SMOKE TRAIL EMISSION =================
    if (progress > 0.05 && progress < 0.45 && flameGroup.visible) {
      const rocketWorldPos = new THREE.Vector3();
      flameGroup.getWorldPosition(rocketWorldPos);

      const p = smokeParticles[nextSmokeIdx];
      p.mesh.position.copy(rocketWorldPos);
      p.mesh.position.x += (Math.random() - 0.5) * 0.4;
      p.mesh.position.z += (Math.random() - 0.5) * 0.4;
      p.scale = 0.9;
      p.opacity = 0.85;
      p.active = true;
      p.lifetime = 0;
      p.mesh.visible = true;
      nextSmokeIdx = (nextSmokeIdx + 1) % smokeCount;
    }

    // Update active smoke puffs
    for (let i = 0; i < smokeCount; i++) {
      const p = smokeParticles[i];
      if (p.active) {
        p.lifetime += delta;
        p.scale += delta * 3.5;
        p.opacity = Math.max(0, 0.85 - p.lifetime * 0.45);
        p.mesh.scale.set(p.scale, p.scale, p.scale);
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = p.opacity;

        if (p.opacity <= 0.02 || p.lifetime > 2.5) {
          p.active = false;
          p.mesh.visible = false;
        }
      }
    }

    // ================= DYNAMIC CAMERA MODES & SHAKE =================
    const shakeIntensity = (progress > 0.03 && progress < 0.12) ? 0.08 : (progress > 0.22 && progress < 0.30) ? 0.12 : 0;
    const shakeX = (Math.random() - 0.5) * shakeIntensity;
    const shakeY = (Math.random() - 0.5) * shakeIntensity;

    const rocketMat = rocketRoot.matrixWorld;
    const rocketPos = new THREE.Vector3();
    rocketRoot.getWorldPosition(rocketPos);

    if (currentCamMode === 'chase') {
      const chaseOffset = new THREE.Vector3(-10, -6, 24).applyMatrix4(rocketMat);
      currentCamPos.x = THREE.MathUtils.damp(currentCamPos.x, chaseOffset.x + shakeX, 5, delta);
      currentCamPos.y = THREE.MathUtils.damp(currentCamPos.y, chaseOffset.y + shakeY, 5, delta);
      currentCamPos.z = THREE.MathUtils.damp(currentCamPos.z, chaseOffset.z, 5, delta);
      camera.position.copy(currentCamPos);

      const targetPos = rocketPos.clone().add(new THREE.Vector3(0, 5, 0));
      cameraTarget.x = THREE.MathUtils.damp(cameraTarget.x, targetPos.x, 7, delta);
      cameraTarget.y = THREE.MathUtils.damp(cameraTarget.y, targetPos.y, 7, delta);
      cameraTarget.z = THREE.MathUtils.damp(cameraTarget.z, targetPos.z, 7, delta);
      camera.lookAt(cameraTarget);
    } else if (currentCamMode === 'pad') {
      camera.position.set(-6 + shakeX, 3 + shakeY, 14);
      cameraTarget.copy(rocketPos).add(new THREE.Vector3(0, 4, 0));
      camera.lookAt(cameraTarget);
    } else if (currentCamMode === 'tracking') {
      camera.position.set(-22, 16, 45);
      cameraTarget.copy(rocketPos).add(new THREE.Vector3(0, 3, 0));
      camera.lookAt(cameraTarget);
    } else if (currentCamMode === 'booster') {
      const camOffset = new THREE.Vector3(1.2, 10.5, 0).applyMatrix4(rocketMat);
      camera.position.copy(camOffset);
      const lookOffset = new THREE.Vector3(1.5, -6.0, 0).applyMatrix4(rocketMat);
      camera.lookAt(lookOffset);
    } else if (currentCamMode === 'cockpit') {
      const noseOffset = new THREE.Vector3(0, 16.5, 0).applyMatrix4(rocketMat);
      camera.position.copy(noseOffset);
      const fwdOffset = new THREE.Vector3(0, 28.0, 0).applyMatrix4(rocketMat);
      camera.lookAt(fwdOffset);
    } else if (currentCamMode === 'spacecraft') {
      const payloadWorld = new THREE.Vector3();
      modularRocket.parts.payloadGroup.getWorldPosition(payloadWorld);
      camera.position.set(payloadWorld.x + 4.5, payloadWorld.y + 1.2, payloadWorld.z + 5.5);
      camera.lookAt(payloadWorld);
    }

    return {
      phaseKey,
      altitudeKm: Math.round(altitudeKm * 10) / 10,
      velocityKms: Math.round(velocityKms * 100) / 100,
      downrangeKm: Math.round(downrangeKm),
      mach: Math.round(mach * 10) / 10,
      dynamicPressureKpa: Math.round(dynamicPressureKpa * 10) / 10,
      gForce: Math.round(gForce * 10) / 10,
      throttlePct,
      isFairingSeparated,
      isBoosterSeparated,
      isPayloadDeployed,
      pitchDeg: Math.round(pitchDeg),
      rollDeg: Math.round(rollDeg),
      headingDeg: Math.round(headingDeg),
    };
  };

  const dispose = () => {
    if (customSpacecraftBundle) {
      customSpacecraftBundle.dispose();
    }
    modularRocket.dispose();
    padBundle.dispose();
    earthBundle.dispose();
    geometriesToDispose.forEach(g => g.dispose());
    materialsToDispose.forEach(m => m.dispose());
    texturesToDispose.forEach(t => t.dispose());
    padSpot1.dispose();
    padSpot2.dispose();
  };

  return {
    group: root,
    camera,
    updateSequence,
    setCameraMode,
    dispose,
  };
}

/**
 * Compatible cinematic rocket model for OpeningCinematic
 */
export function buildLaunchRocketScene() {
  const root = new THREE.Group();
  const rocketGroup = new THREE.Group();
  root.add(rocketGroup);

  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.25,
    metalness: 0.8,
  });

  const blackMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.4,
    metalness: 0.6,
  });

  const fireMat = new THREE.MeshBasicMaterial({
    color: 0xff5500,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
  });

  const geometries: THREE.BufferGeometry[] = [];

  const boosterGeo = new THREE.CylinderGeometry(0.7, 0.7, 7.0, 24);
  geometries.push(boosterGeo);
  const boosterMesh = new THREE.Mesh(boosterGeo, whiteMat);
  boosterMesh.position.y = 3.5;
  rocketGroup.add(boosterMesh);

  // Decal
  const decalTex = createRocketDecalTexture();
  const decalMat = new THREE.MeshBasicMaterial({ map: decalTex, transparent: true });
  const decalGeo = new THREE.PlaneGeometry(1.2, 2.4);
  geometries.push(decalGeo);
  const decalMesh = new THREE.Mesh(decalGeo, decalMat);
  decalMesh.position.set(0, 4.2, 0.71);
  rocketGroup.add(decalMesh);

  // Nozzle
  for (let i = 0; i < 9; i++) {
    const nozzleGeo = new THREE.ConeGeometry(0.18, 0.5, 12, 1, true);
    geometries.push(nozzleGeo);
    const nozzle = new THREE.Mesh(nozzleGeo, blackMat);
    nozzle.rotation.x = Math.PI;
    if (i === 0) {
      nozzle.position.set(0, -0.2, 0);
    } else {
      const angle = (i / 8) * Math.PI * 2;
      nozzle.position.set(Math.cos(angle) * 0.45, -0.2, Math.sin(angle) * 0.45);
    }
    rocketGroup.add(nozzle);
  }

  // Upper stage & fairing
  const s2Geo = new THREE.CylinderGeometry(0.7, 0.7, 2.5, 24);
  geometries.push(s2Geo);
  const s2Mesh = new THREE.Mesh(s2Geo, whiteMat);
  s2Mesh.position.y = 8.25;
  rocketGroup.add(s2Mesh);

  const fairingGeo = new THREE.ConeGeometry(0.72, 2.2, 24);
  geometries.push(fairingGeo);
  const fairing = new THREE.Mesh(fairingGeo, whiteMat);
  fairing.position.y = 10.6;
  rocketGroup.add(fairing);

  // Fire plume
  const fireGeo = new THREE.ConeGeometry(1.2, 4.5, 16);
  geometries.push(fireGeo);
  const firePlume = new THREE.Mesh(fireGeo, fireMat);
  firePlume.position.y = -2.4;
  firePlume.rotation.x = Math.PI;
  rocketGroup.add(firePlume);

  return {
    group: root,
    rocketGroup,
    firePlume,
    updateSequence: (p: number) => {
      rocketGroup.position.y = p * 40;
    },
    dispose: () => {
      geometries.forEach(g => g.dispose());
      whiteMat.dispose();
      blackMat.dispose();
      fireMat.dispose();
      decalTex.dispose();
      decalMat.dispose();
    }
  };
}
