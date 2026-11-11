/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';

export interface LaunchPadBundle {
  group: THREE.Group;
  towerGroup: THREE.Group;
  swingArm1: THREE.Group;
  swingArm2: THREE.Group;
  padBaseMesh: THREE.Mesh;
  steamParticles: THREE.Points;
  retractArms: (progress: number) => void;
  setSteamDensity: (opacity: number) => void;
  update: (deltaSeconds: number) => void;
  dispose: () => void;
}

/**
 * Creates a high-fidelity Ground Launch Complex & Umbilical Gantry Tower
 * Based on authentic Baikonur / Cape Canaveral LC-39A / Vostochny launch complexes.
 */
export function createLaunchPadEnvironment(isDaylight = true): LaunchPadBundle {
  const group = new THREE.Group();
  const geometriesToDispose: THREE.BufferGeometry[] = [];
  const materialsToDispose: THREE.Material[] = [];

  // 1. Concrete Materials
  const padConcreteMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.88,
    metalness: 0.12,
  });
  materialsToDispose.push(padConcreteMat);

  const trenchMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.95,
    metalness: 0.05,
  });
  materialsToDispose.push(trenchMat);

  const towerTrussMat = new THREE.MeshStandardMaterial({
    color: 0xc2410c, // Aerospace Safety Red / Orange
    roughness: 0.5,
    metalness: 0.7,
  });
  materialsToDispose.push(towerTrussMat);

  const gantrySteelMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.4,
    metalness: 0.8,
  });
  materialsToDispose.push(gantrySteelMat);

  const terrainMat = new THREE.MeshStandardMaterial({
    color: isDaylight ? 0x2e4228 : 0x141d1a, // Steppe grass / ground
    roughness: 0.92,
    metalness: 0.04,
  });
  materialsToDispose.push(terrainMat);

  // 2. Surrounding Ground Terrain
  const terrainGeo = new THREE.PlaneGeometry(350, 350, 24, 24);
  geometriesToDispose.push(terrainGeo);
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.rotation.x = -Math.PI / 2;
  terrainMesh.position.y = -0.65;
  group.add(terrainMesh);

  // Distant mountain ridge horizon
  const ridgeGeo = new THREE.ConeGeometry(80, 28, 12);
  geometriesToDispose.push(ridgeGeo);
  const ridgeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.95 });
  materialsToDispose.push(ridgeMat);
  for (let m = 0; m < 5; m++) {
    const ridge = new THREE.Mesh(ridgeGeo, ridgeMat);
    const mAngle = (m / 5) * Math.PI * 2;
    ridge.position.set(Math.cos(mAngle) * 160, 10, Math.sin(mAngle) * 160);
    ridge.scale.set(1.2 + (m % 2) * 0.4, 0.7 + (m % 3) * 0.3, 1.2);
    group.add(ridge);
  }

  // 3. Concrete Launch Pad Foundation Table
  const padBaseGeo = new THREE.BoxGeometry(36, 1.3, 36);
  geometriesToDispose.push(padBaseGeo);
  const padBaseMesh = new THREE.Mesh(padBaseGeo, padConcreteMat);
  padBaseMesh.position.y = -0.05;
  group.add(padBaseMesh);

  // Flame Deflector Trench beneath rocket core
  const trenchGeo = new THREE.BoxGeometry(10, 4, 28);
  geometriesToDispose.push(trenchGeo);
  const trenchMesh = new THREE.Mesh(trenchGeo, trenchMat);
  trenchMesh.position.set(0, -2.1, 0);
  group.add(trenchMesh);

  // Hold-Down Clamps around rocket base (4 units)
  const clampGeo = new THREE.BoxGeometry(0.4, 0.7, 0.5);
  geometriesToDispose.push(clampGeo);
  for (let c = 0; c < 4; c++) {
    const cAngle = (c / 4) * Math.PI * 2;
    const clamp = new THREE.Mesh(clampGeo, gantrySteelMat);
    clamp.position.set(Math.cos(cAngle) * 1.6, 0.35, Math.sin(cAngle) * 1.6);
    clamp.rotation.y = -cAngle;
    group.add(clamp);
  }

  // 4. Launch Umbilical Tower (Truss Structure)
  const towerGroup = new THREE.Group();
  towerGroup.position.set(-3.6, 0, 0);
  group.add(towerGroup);

  const towerColGeo = new THREE.BoxGeometry(0.35, 24, 0.35);
  geometriesToDispose.push(towerColGeo);
  for (let cx of [-1.3, 1.3]) {
    for (let cz of [-1.3, 1.3]) {
      const col = new THREE.Mesh(towerColGeo, towerTrussMat);
      col.position.set(cx, 12, cz);
      towerGroup.add(col);
    }
  }

  // Cross Platforms along tower height
  for (let py = 2.5; py <= 23; py += 3.2) {
    const platGeo = new THREE.BoxGeometry(3.0, 0.22, 3.0);
    geometriesToDispose.push(platGeo);
    const plat = new THREE.Mesh(platGeo, gantrySteelMat);
    plat.position.y = py;
    towerGroup.add(plat);

    // Diagonal truss bracing
    const diagGeo = new THREE.CylinderGeometry(0.06, 0.06, 3.6, 6);
    geometriesToDispose.push(diagGeo);
    const diag1 = new THREE.Mesh(diagGeo, towerTrussMat);
    diag1.position.set(0, py - 1.6, 1.3);
    diag1.rotation.z = Math.PI / 4;
    towerGroup.add(diag1);
  }

  // Lightning Mast on top of tower
  const mastGeo = new THREE.CylinderGeometry(0.04, 0.15, 6, 8);
  geometriesToDispose.push(mastGeo);
  const mast = new THREE.Mesh(mastGeo, gantrySteelMat);
  mast.position.set(0, 26.5, 0);
  towerGroup.add(mast);

  // Red beacon on top of mast
  const beaconGeo = new THREE.SphereGeometry(0.18, 12, 12);
  geometriesToDispose.push(beaconGeo);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  materialsToDispose.push(beaconMat);
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  beacon.position.set(0, 29.5, 0);
  towerGroup.add(beacon);

  // 5. Retractable Umbilical Swing Arms
  // Lower swing arm (Stage 1 propellant & avionics umbilical)
  const swingArm1 = new THREE.Group();
  swingArm1.position.set(1.3, 8.0, 0);
  towerGroup.add(swingArm1);

  const arm1Geo = new THREE.BoxGeometry(2.4, 0.4, 0.4);
  geometriesToDispose.push(arm1Geo);
  const arm1Mesh = new THREE.Mesh(arm1Geo, gantrySteelMat);
  arm1Mesh.position.x = 1.2;
  swingArm1.add(arm1Mesh);

  // Upper swing arm (Stage 2 & Fairing air conditioning / telemetry umbilical)
  const swingArm2 = new THREE.Group();
  swingArm2.position.set(1.3, 15.0, 0);
  towerGroup.add(swingArm2);

  const arm2Geo = new THREE.BoxGeometry(2.4, 0.35, 0.35);
  geometriesToDispose.push(arm2Geo);
  const arm2Mesh = new THREE.Mesh(arm2Geo, gantrySteelMat);
  arm2Mesh.position.x = 1.2;
  swingArm2.add(arm2Mesh);

  // 6. Deluge Water Steam System (Erupts during ignition)
  const steamCount = 180;
  const steamGeo = new THREE.BufferGeometry();
  const steamPos = new Float32Array(steamCount * 3);
  const steamVel: { x: number; y: number; z: number }[] = [];

  for (let i = 0; i < steamCount; i++) {
    steamPos[i * 3] = (Math.random() - 0.5) * 4;
    steamPos[i * 3 + 1] = -1.2;
    steamPos[i * 3 + 2] = (Math.random() - 0.5) * 4;
    steamVel.push({
      x: (Math.random() - 0.5) * 0.18,
      y: Math.random() * 0.25 + 0.08,
      z: (Math.random() - 0.5) * 0.18,
    });
  }

  steamGeo.setAttribute('position', new THREE.BufferAttribute(steamPos, 3));
  geometriesToDispose.push(steamGeo);

  const steamMat = new THREE.PointsMaterial({
    color: 0xf1f5f9,
    size: 2.2,
    transparent: true,
    opacity: 0,
    blending: THREE.NormalBlending,
  });
  materialsToDispose.push(steamMat);

  const steamParticles = new THREE.Points(steamGeo, steamMat);
  group.add(steamParticles);

  // Retract swing arms helper
  const retractArms = (progress: number) => {
    // Swing arms rotate back away from the rocket (yaw away by ~75 degrees)
    swingArm1.rotation.y = -progress * (Math.PI / 2.3);
    swingArm2.rotation.y = -progress * (Math.PI / 2.3);
  };

  const setSteamDensity = (opacity: number) => {
    steamMat.opacity = opacity;
  };

  const update = (deltaSeconds: number) => {
    // Animate steam billows if active
    if (steamMat.opacity > 0) {
      const posArr = (steamGeo.attributes.position as THREE.BufferAttribute).array as Float32Array;
      for (let i = 0; i < steamCount; i++) {
        posArr[i * 3] += steamVel[i].x;
        posArr[i * 3 + 1] += steamVel[i].y;
        posArr[i * 3 + 2] += steamVel[i].z;
        if (posArr[i * 3 + 1] > 18) {
          posArr[i * 3] = (Math.random() - 0.5) * 4;
          posArr[i * 3 + 1] = -1.2;
          posArr[i * 3 + 2] = (Math.random() - 0.5) * 4;
        }
      }
      (steamGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  };

  const dispose = () => {
    geometriesToDispose.forEach(g => g.dispose());
    materialsToDispose.forEach(m => m.dispose());
  };

  return {
    group,
    towerGroup,
    swingArm1,
    swingArm2,
    padBaseMesh,
    steamParticles,
    retractArms,
    setSteamDensity,
    update,
    dispose,
  };
}
