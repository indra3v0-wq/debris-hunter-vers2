/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import confetti from 'canvas-confetti';
import { MissionState, Language } from '../types';
import { calculateDeorbitDeltaV, calculateFuelRequired } from '../simulation/orbitalPhysics';
import { buildModularSpacecraft } from '../three/spacecraftBuilder';
import { buildDebrisModel } from '../three/debrisBuilder';
import { createNasaEarthMesh, createNasaSpaceEnvironment } from '../three/proceduralEarth';
import { sound } from '../utils/audio';
import { TRANSLATIONS } from '../utils/translations';
import { 
  Flame, 
  ArrowRight, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Orbit, 
  RotateCcw,
  Play,
  Pause,
  Camera,
  MapPin,
  Waves,
  Sparkles
} from 'lucide-react';

interface StageDisposalProps {
  language?: Language;
  missionState: MissionState;
  onUpdateState: (partial: Partial<MissionState>) => void;
  onProceedToEvaluation: () => void;
}

type StrategyType = 'reentry' | 'graveyard' | 'drag_sail';
type DisposalCamMode = 'plasma' | 'tracking' | 'trajectory' | 'free';

export const StageDisposal: React.FC<StageDisposalProps> = ({
  language = 'mn',
  missionState,
  onUpdateState,
  onProceedToEvaluation,
}) => {
  const t = TRANSLATIONS[language];
  const canvasMountRef = useRef<HTMLDivElement>(null);

  const target = missionState.selectedMission;
  const initialAlt = target.altitudeKm;

  const [strategy, setStrategy] = useState<StrategyType>('reentry');
  const [isBurning, setIsBurning] = useState<boolean>(false);
  const [disposalComplete, setDisposalComplete] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0); // 0.0 to 1.0
  const [camMode, setCamMode] = useState<DisposalCamMode>('plasma');
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Stack Mass: Spacecraft dry mass + remaining fuel + captured debris mass
  const [fuelKg, setFuelKg] = useState<number>(missionState.fuelRemainingKg);
  const combinedMassKg = missionState.specs.dryMassKg + fuelKg + target.massKg;

  // Delta-V for controlled atmospheric entry (perigee at 45km)
  const deorbitDeltaV = calculateDeorbitDeltaV(initialAlt, 45);
  const deorbitFuelReq = calculateFuelRequired(
    combinedMassKg,
    deorbitDeltaV,
    missionState.design.propulsion.ispSeconds
  );
  const hasEnoughFuel = fuelKg >= deorbitFuelReq;

  // Live telemetry state during reentry
  const [telemetry, setTelemetry] = useState({
    phaseText: t.disposal.phases.retrogradeFlip,
    altitudeKm: initialAlt,
    velocityKms: 7.68,
    mach: 24.8,
    plasmaTempC: 25,
    dynamicPressureKpa: 0,
  });

  const sceneCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const stackGroupRef = useRef<THREE.Group | null>(null);
  const plasmaMeshRef = useRef<THREE.Mesh | null>(null);
  const fragmentParticlesRef = useRef<THREE.Points | null>(null);
  const debrisModelRef = useRef<ReturnType<typeof buildDebrisModel> | null>(null);
  const spacecraftModelRef = useRef<ReturnType<typeof buildModularSpacecraft> | null>(null);

  // 3D Scene Initialization
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);

    // Warm Sun & Atmospheric rim light
    const sun = new THREE.DirectionalLight(0xffedd5, 2.5);
    sun.position.set(15, 12, 18);
    scene.add(sun);

    const hemi = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.1);
    scene.add(hemi);

    // 1. High-Fidelity NASA Blue Marble Earth
    const earthRadius = 24.0;
    const earthBundle = createNasaEarthMesh(earthRadius, isSoftwareGl);
    earthBundle.setSunDirection(sun.position.clone().normalize());
    earthBundle.group.position.set(0, -earthRadius - 2.0, 0);
    scene.add(earthBundle.group);

    // 2. NASA Deep Space Environment (Milky Way galaxy skybox, Moon, Mars, Jupiter, Saturn, stars)
    const spaceEnv = createNasaSpaceEnvironment(isSoftwareGl);
    scene.add(spaceEnv.group);

    // Stack Group (Spacecraft + Docked Debris)
    const stack = new THREE.Group();
    stack.position.set(0, 4.0, 0);
    scene.add(stack);
    stackGroupRef.current = stack;

    // Modular Spacecraft
    const scBundle = buildModularSpacecraft(missionState.design);
    scBundle.group.position.set(0, 0, 1.2);
    stack.add(scBundle.group);
    spacecraftModelRef.current = scBundle;

    // Docked Debris
    const debBundle = buildDebrisModel(target);
    debBundle.group.position.set(0, 0.4, -1.8);
    stack.add(debBundle.group);
    debrisModelRef.current = debBundle;

    // Hypersonic Incandescent Plasma Sheath Shell
    const plasmaGeo = new THREE.ConeGeometry(2.4, 6.0, 24, 1, true);
    const plasmaMat = new THREE.MeshBasicMaterial({
      color: 0xff4500,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const plasmaMesh = new THREE.Mesh(plasmaGeo, plasmaMat);
    plasmaMesh.rotation.x = Math.PI / 2;
    plasmaMesh.position.set(0, 0.2, -2.5);
    stack.add(plasmaMesh);
    plasmaMeshRef.current = plasmaMesh;

    // Thermal Fragmentation Particles (flying burning debris sparks)
    const fragCount = 200;
    const fragGeo = new THREE.BufferGeometry();
    const fragPos = new Float32Array(fragCount * 3);
    const fragVel: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < fragCount; i++) {
      fragPos[i * 3] = (Math.random() - 0.5) * 1.5;
      fragPos[i * 3 + 1] = (Math.random() - 0.5) * 1.5;
      fragPos[i * 3 + 2] = -Math.random() * 8;
      fragVel.push({
        x: (Math.random() - 0.5) * 0.1,
        y: (Math.random() - 0.5) * 0.1,
        z: Math.random() * 0.2 + 0.1,
      });
    }
    fragGeo.setAttribute('position', new THREE.BufferAttribute(fragPos, 3));
    const fragMat = new THREE.PointsMaterial({
      color: 0xfbbf24,
      size: 0.6,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    const fragParticles = new THREE.Points(fragGeo, fragMat);
    stack.add(fragParticles);
    fragmentParticlesRef.current = fragParticles;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 500);
    camera.position.set(0, 3.5, 9.5);
    sceneCameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enabled = false;
    controlsRef.current = controls;

    let frameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // Rotate NASA Earth and cosmic environment
      earthBundle.update(delta);
      spaceEnv.update(delta);

      // Animate fragmentation sparks if active
      if (fragMat.opacity > 0) {
        const pArr = (fragGeo.attributes.position as THREE.BufferAttribute).array as Float32Array;
        for (let i = 0; i < fragCount; i++) {
          pArr[i * 3] += fragVel[i].x;
          pArr[i * 3 + 1] += fragVel[i].y;
          pArr[i * 3 + 2] += fragVel[i].z;
          if (pArr[i * 3 + 2] > 6) {
            pArr[i * 3] = (Math.random() - 0.5) * 1.5;
            pArr[i * 3 + 1] = (Math.random() - 0.5) * 1.5;
            pArr[i * 3 + 2] = -2;
          }
        }
        (fragGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      }

      if (controls.enabled) {
        controls.update();
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      scBundle.dispose();
      debBundle.dispose();
      earthBundle.dispose();
      spaceEnv.dispose();
      plasmaGeo.dispose();
      plasmaMat.dispose();
      fragGeo.dispose();
      fragMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [target]);

  // Camera switcher
  const handleChangeCamera = (mode: DisposalCamMode) => {
    sound.playClick(1150);
    setCamMode(mode);
    const camera = sceneCameraRef.current;
    if (!camera) return;

    if (controlsRef.current) {
      controlsRef.current.enabled = mode === 'free';
      if (mode === 'free') {
        controlsRef.current.target.set(0, 3.5, 0);
      }
    }

    if (mode === 'plasma') {
      camera.position.set(-1.8, 1.2, -5.2);
      camera.lookAt(0, 0.4, 0);
    } else if (mode === 'tracking') {
      camera.position.set(6.5, 4.2, 7.5);
      camera.lookAt(0, 3.5, 0);
    } else if (mode === 'trajectory') {
      camera.position.set(0, 16.0, 22.0);
      camera.lookAt(0, -6.0, 0);
    }
  };

  // Reentry Flight Timeline Loop
  useEffect(() => {
    let animTimer: NodeJS.Timeout;
    if (isBurning && !isPaused && progress < 1) {
      animTimer = setTimeout(() => {
        const nextProgress = Math.min(1, progress + 0.012);
        setProgress(nextProgress);

        // Update 3D scene elements according to reentry phase
        const plasmaMat = plasmaMeshRef.current?.material as THREE.MeshBasicMaterial | undefined;
        const fragMat = fragmentParticlesRef.current?.material as THREE.PointsMaterial | undefined;
        const stack = stackGroupRef.current;
        const camera = sceneCameraRef.current;

        let phaseText = '';
        let altKm = initialAlt;
        let velKms = 7.68;
        let mach = 24.8;
        let tempC = 25;
        let pressKpa = 0;

        if (nextProgress < 0.20) {
          // Phase 1: Retrograde orientation flip
          const p = nextProgress / 0.20;
          phaseText = t.disposal.phases.retrogradeFlip;
          if (stack) {
            stack.rotation.y = p * Math.PI; // 180 flip
          }
          altKm = initialAlt;
          velKms = 7.68;
        } else if (nextProgress < 0.45) {
          // Phase 2: Retrograde Deorbit Burn
          const p = (nextProgress - 0.20) / 0.25;
          phaseText = t.disposal.phases.burnActive;
          if (spacecraftModelRef.current) {
            spacecraftModelRef.current.setThrusterFiring(true);
          }
          altKm = initialAlt - p * (initialAlt - 85);
          velKms = 7.68 - p * 0.25; // deceleration
          velKms = Math.round(velKms * 100) / 100;
          tempC = 25 + p * 150;
        } else if (nextProgress < 0.70) {
          // Phase 3: Hypersonic entry & glowing plasma shockwave
          const p = (nextProgress - 0.45) / 0.25;
          phaseText = t.disposal.phases.hypersonicPlasma;
          altKm = 85 - p * 35; // 85 -> 50 km
          velKms = 7.43 - p * 2.2;
          mach = Math.round((velKms / 0.32) * 10) / 10;
          tempC = Math.round(175 + p * 2400); // reaches ~2600°C!
          pressKpa = Math.round(p * 45);

          // Intense plasma glow
          if (plasmaMat) {
            plasmaMat.opacity = Math.min(0.9, p * 1.3);
            plasmaMat.color.setHex(p > 0.6 ? 0xffffff : 0xff4500);
          }
          if (fragMat) {
            fragMat.opacity = p * 0.7;
          }

          // Camera shakes with hypersonic atmospheric buffeting
          if (camera && camMode !== 'free') {
            camera.position.x += (Math.random() - 0.5) * 0.08;
            camera.position.y += (Math.random() - 0.5) * 0.08;
          }
        } else if (nextProgress < 0.90) {
          // Phase 4: Aerodynamic breakup & fragmentation
          const p = (nextProgress - 0.70) / 0.20;
          phaseText = t.disposal.phases.aerodynamicBreakup;
          altKm = 50 - p * 25; // 50 -> 25 km
          velKms = 5.2 - p * 3.5;
          mach = Math.round((velKms / 0.33) * 10) / 10;
          tempC = Math.round(2575 - p * 800);
          pressKpa = Math.round(45 + p * 80);

          // Explosive fragmentation effect
          if (debrisModelRef.current) {
            debrisModelRef.current.group.scale.set(
              Math.max(0.1, 1 - p * 0.8),
              Math.max(0.1, 1 - p * 0.8),
              Math.max(0.1, 1 - p * 0.8)
            );
            debrisModelRef.current.group.rotation.x += 0.2;
            debrisModelRef.current.group.rotation.y += 0.3;
          }
          if (fragMat) {
            fragMat.opacity = 1.0;
          }
        } else {
          // Phase 5: Point Nemo splashdown
          phaseText = t.disposal.phases.pointNemoSplash;
          altKm = 0;
          velKms = 0.12;
          mach = 0.3;
          tempC = 35;
          pressKpa = 101.3;

          if (plasmaMat) plasmaMat.opacity = 0;
          if (fragMat) fragMat.opacity = 0;
        }

        setTelemetry({
          phaseText,
          altitudeKm: Math.round(altKm * 10) / 10,
          velocityKms: Math.round(velKms * 100) / 100,
          mach,
          plasmaTempC: tempC,
          dynamicPressureKpa: pressKpa,
        });

        if (nextProgress >= 1) {
          setIsBurning(false);
          setDisposalComplete(true);
          sound.playLockChime();

          try {
            confetti({
              particleCount: 100,
              spread: 90,
              origin: { y: 0.6 },
              colors: ['#38bdf8', '#34d399', '#f59e0b'],
            });
          } catch {}

          const remainingFuel = Math.max(0, fuelKg - deorbitFuelReq);
          setFuelKg(Math.round(remainingFuel));

          onUpdateState({
            disposalStrategy: strategy,
            fuelRemainingKg: remainingFuel,
            currentAltitudeKm: 0,
            disposalOutcome: {
              success: true,
              burnDeltaV: Math.round(deorbitDeltaV),
              decayYears: 0.0,
              impactZone: 'Point Nemo, South Pacific Ocean Uninhabited Area (48°52.6′S 123°23.6′W)',
              survivingMassKg: Math.round(target.massKg * 0.12),
              fragmentationAltKm: 64,
            },
          });
        }
      }, 75);
    }
    return () => clearTimeout(animTimer);
  }, [isBurning, isPaused, progress, deorbitDeltaV, deorbitFuelReq, initialAlt, fuelKg, camMode]);

  // Execute Disposal Action
  const handleStartDisposal = () => {
    setIsBurning(true);
    setProgress(0);
    setDisposalComplete(false);
    sound.playClick(900);
    sound.playRocketRumble(3.0);

    // Reentry audio sounds
    setTimeout(() => {
      sound.playPlasmaReentry(5.0);
    }, 2800);

    setTimeout(() => {
      sound.playExplosion();
    }, 5500);
  };

  const handleReset = () => {
    sound.playClick();
    setIsBurning(false);
    setIsPaused(false);
    setProgress(0);
    setDisposalComplete(false);
    if (debrisModelRef.current) {
      debrisModelRef.current.group.scale.set(1, 1, 1);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-48px)] mt-12 bg-slate-950 overflow-hidden select-none">
      {/* 3D WebGL Canvas */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Left: Deorbit Status Badge */}
      <div className="absolute top-4 left-4 z-20 pointer-events-none max-w-sm">
        <div className="aerospace-panel p-3.5 rounded-lg border-sky-500/30">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span className="text-[11px] font-mono font-bold text-sky-400 tracking-wider">
              {t.disposal.badge}
            </span>
          </div>
          <h1 className="text-base font-bold text-white tracking-wide">
            {t.disposal.title}
          </h1>

          <div className="mt-3 p-2.5 bg-slate-950/85 rounded border border-slate-800 text-xs font-mono space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">{t.disposal.stackMass}:</span>
              <span className="text-white font-bold">{combinedMassKg.toLocaleString()} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{t.disposal.fuelRemaining}:</span>
              <span className="text-sky-300 font-bold">{fuelKg} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{t.disposal.deorbitDeltaV}:</span>
              <span className="text-amber-400 font-bold">-{Math.round(deorbitDeltaV)} m/s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{t.disposal.requiredFuel}:</span>
              <span className="text-emerald-400 font-bold">{Math.round(deorbitFuelReq)} kg</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Center: Camera Selector Float Bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
        <div className="aerospace-panel px-3 py-1 rounded-full border-sky-500/30 flex items-center gap-1.5 text-[10px] font-mono">
          <Camera className="w-3.5 h-3.5 text-sky-400" />
          <button
            onClick={() => handleChangeCamera('plasma')}
            className={`px-2.5 py-0.5 rounded-full transition-colors ${camMode === 'plasma' ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'}`}
          >
            1. Plasma Heatshield
          </button>
          <button
            onClick={() => handleChangeCamera('tracking')}
            className={`px-2.5 py-0.5 rounded-full transition-colors ${camMode === 'tracking' ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'}`}
          >
            2. Breakup Tracking
          </button>
          <button
            onClick={() => handleChangeCamera('trajectory')}
            className={`px-2.5 py-0.5 rounded-full transition-colors ${camMode === 'trajectory' ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'}`}
          >
            3. Global Trajectory
          </button>
          <button
            onClick={() => handleChangeCamera('free')}
            className={`px-2.5 py-0.5 rounded-full transition-colors ${camMode === 'free' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'}`}
          >
            {t.common.freeCam}
          </button>
        </div>
      </div>

      {/* Top Right: Live Hypersonic Plasma Telemetry & NASA Component Demise Table */}
      {(isBurning || disposalComplete) && (
        <div className="absolute top-4 right-4 z-20 pointer-events-none max-w-sm">
          <div className="aerospace-panel p-3.5 rounded-lg border-sky-500/40 font-mono text-xs space-y-2.5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-sky-500/20 pb-1.5">
              <div className="text-[10px] text-amber-400 font-bold flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {language === 'mn' ? 'ГИПЕР-ХУРДНЫ ПЛАЗМЫН УСТГАЛТ (NASA DAS)' : 'HYPERSONIC REENTRY ABLATION (NASA DAS)'}
                </span>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
                T &gt; 2500°C
              </span>
            </div>

            <div className="p-2 bg-slate-950/85 rounded border border-slate-800">
              <div className="text-[9px] text-slate-400 uppercase font-semibold">
                {language === 'mn' ? 'Явагдаж буй процесс' : 'Current Reentry Event'}
              </div>
              <div className="text-white font-bold text-xs mt-0.5">
                {telemetry.phaseText}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-1.5 bg-slate-950/80 rounded border border-slate-800">
                <span className="text-slate-400 block text-[9px]">{t.disposal.telemetry.entryAltitude}</span>
                <span className="text-sky-300 font-bold text-sm">{telemetry.altitudeKm} km</span>
              </div>
              <div className="p-1.5 bg-slate-950/80 rounded border border-slate-800">
                <span className="text-slate-400 block text-[9px]">{t.disposal.telemetry.mach}</span>
                <span className="text-emerald-400 font-bold text-sm">Mach {telemetry.mach}</span>
              </div>
              <div className="p-1.5 bg-slate-950/80 rounded border border-slate-800">
                <span className="text-slate-400 block text-[9px]">{t.disposal.telemetry.plasmaTemp}</span>
                <span className="text-rose-400 font-bold text-sm">{telemetry.plasmaTempC}°C</span>
              </div>
              <div className="p-1.5 bg-slate-950/80 rounded border border-slate-800">
                <span className="text-slate-400 block text-[9px]">
                  {language === 'mn' ? 'Динамик Даралт (Q)' : 'Dynamic Pressure'}
                </span>
                <span className="text-amber-300 font-bold text-sm">{telemetry.dynamicPressureKpa} kPa</span>
              </div>
            </div>

            {/* NASA Debris Demise Component Tracker */}
            <div className="p-2 bg-slate-950/90 rounded border border-slate-800 space-y-1.5 text-[10px]">
              <div className="text-[9px] text-sky-400 font-bold flex items-center justify-between">
                <span>{language === 'mn' ? 'ЭД АНГИЙН ШАТАЛТЫН ТӨЛӨВ' : 'COMPONENT DEMISE STATUS'}</span>
                <span>NASA-STD-8719.14</span>
              </div>

              {/* Component 1: Solar Arrays */}
              <div className="flex justify-between items-center">
                <span className="text-slate-300">{language === 'mn' ? '1. GaAs Нарны зайн далавч' : '1. GaAs Solar Wings'}</span>
                <span className={`font-bold ${telemetry.altitudeKm <= 82 ? 'text-rose-400' : 'text-amber-300'}`}>
                  {telemetry.altitudeKm <= 82 ? (language === 'mn' ? '✓ БҮРЭН ШАТСАН (82km)' : '✓ VAPORIZED (82km)') : '800°C ачаалал'}
                </span>
              </div>

              {/* Component 2: Composite Hull Panels */}
              <div className="flex justify-between items-center">
                <span className="text-slate-300">{language === 'mn' ? '2. Карбон их биеийн хавтас' : '2. Composite Shell'}</span>
                <span className={`font-bold ${telemetry.altitudeKm <= 64 ? 'text-rose-400' : 'text-slate-400'}`}>
                  {telemetry.altitudeKm <= 64 ? (language === 'mn' ? '✓ ЗАДАРЧ ХАЙЛСАН (64km)' : '✓ BURNED UP (64km)') : 'Халж байна'}
                </span>
              </div>

              {/* Component 3: Tanks */}
              <div className="flex justify-between items-center">
                <span className="text-slate-300">{language === 'mn' ? '3. Үлдэгдэл түлшний сав' : '3. Residual Fuel Tank'}</span>
                <span className={`font-bold ${telemetry.altitudeKm <= 48 ? 'text-orange-400' : 'text-slate-400'}`}>
                  {telemetry.altitudeKm <= 48 ? (language === 'mn' ? '✓ ТЭСЭРЧ ДЭЛБЭРСЭН (48km)' : '✓ EXPLODED (48km)') : 'Даралт ихсэв'}
                </span>
              </div>

              {/* Component 4: Titanium Engine Core */}
              <div className="flex justify-between items-center">
                <span className="text-slate-300">{language === 'mn' ? '4. Титан хөдөлгүүрийн зүрхэвч' : '4. Titanium Core'}</span>
                <span className={`font-bold ${telemetry.altitudeKm === 0 ? 'text-emerald-400' : 'text-sky-300'}`}>
                  {telemetry.altitudeKm === 0 ? (language === 'mn' ? '✓ ДАЛАЙД УНАСАН (0km)' : '✓ IMPACT SINK (0km)') : 'Тоормослож буй'}
                </span>
              </div>
            </div>

            <div className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 pt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{t.disposal.telemetry.groundCasualtyRisk}</span>
            </div>
          </div>
        </div>
      )}

      {/* Unified Bottom Control Dock */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[96%] max-w-4xl">
        <div className="aerospace-panel rounded-xl overflow-hidden shadow-2xl border-sky-500/40">
          {/* Strategy Selection Cards */}
          {!isBurning && !disposalComplete && (
            <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-2.5 bg-slate-900/95 border-b border-sky-500/20">
              <div
                onClick={() => {
                  sound.playClick();
                  setStrategy('reentry');
                }}
                className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                  strategy === 'reentry'
                    ? 'bg-sky-500/15 border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.25)]'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-xs text-white">{t.disposal.strategies.reentry.name}</span>
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-1.5">
                  {t.disposal.strategies.reentry.desc}
                </p>
                <div className="text-[10px] font-mono text-sky-300">
                  Target: {t.disposal.strategies.reentry.destination}
                </div>
              </div>

              <div
                onClick={() => {
                  sound.playClick();
                  setStrategy('graveyard');
                }}
                className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                  strategy === 'graveyard'
                    ? 'bg-sky-500/15 border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.25)]'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-xs text-white">{t.disposal.strategies.graveyard.name}</span>
                  <Orbit className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-1.5">
                  {t.disposal.strategies.graveyard.desc}
                </p>
                <div className="text-[10px] font-mono text-purple-300">
                  Target: {t.disposal.strategies.graveyard.destination}
                </div>
              </div>

              <div
                onClick={() => {
                  sound.playClick();
                  setStrategy('drag_sail');
                }}
                className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                  strategy === 'drag_sail'
                    ? 'bg-sky-500/15 border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.25)]'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-xs text-white">{t.disposal.strategies.dragSail.name}</span>
                  <Waves className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-1.5">
                  {t.disposal.strategies.dragSail.desc}
                </p>
                <div className="text-[10px] font-mono text-emerald-300">
                  Target: {t.disposal.strategies.dragSail.destination}
                </div>
              </div>
            </div>
          )}

          {/* Action & Status Bar */}
          <div className="px-5 py-4 bg-slate-950/95 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs font-mono">
              {!isBurning && !disposalComplete ? (
                <span className="text-slate-300">
                  {language === 'mn' ? 'Хогоо барьж аваад агаар мандалд шатаах тушаал өгнө үү.' : 'Ready to command retrograde deorbit burn into Point Nemo.'}
                </span>
              ) : isBurning ? (
                <div className="flex items-center gap-2.5">
                  <div className="w-36 bg-slate-800 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-amber-400 h-full transition-all" style={{ width: `${progress * 100}%` }} />
                  </div>
                  <span className="text-amber-300 font-bold">{Math.round(progress * 100)}% REENTRY</span>
                </div>
              ) : (
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  {language === 'mn' ? 'ПОЙНТ НЕМОГИЙН ДАЛАЙД АМЖИЛТТАЙ ШАТААН УСТГАЛАА!' : 'DISPOSAL MISSION SUCCESSFUL! POINT NEMO OCEAN IMPACT.'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {!isBurning && !disposalComplete ? (
                <button
                  disabled={!hasEnoughFuel}
                  onClick={handleStartDisposal}
                  className={`w-full sm:w-auto px-6 py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-colors ${
                    !hasEnoughFuel
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.35)]'
                  }`}
                >
                  <Flame className="w-4 h-4" />
                  <span>{t.disposal.executeBurn}</span>
                </button>
              ) : isBurning ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      sound.playClick();
                      setIsPaused(!isPaused);
                    }}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs"
                    title={isPaused ? t.common.play : t.common.pause}
                  >
                    {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={handleReset}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700 text-xs"
                    title={t.common.reset}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleReset}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t.common.retry}</span>
                  </button>
                  <button
                    onClick={() => {
                      sound.playLockChime();
                      onProceedToEvaluation();
                    }}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.35)]"
                  >
                    <span>{t.disposal.proceedToReport}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Centered Celebration Modal on Reentry Complete */}
      {disposalComplete && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn pointer-events-auto">
          <div className="w-full max-w-lg aerospace-panel rounded-2xl border-emerald-500/50 bg-slate-950/95 p-6 shadow-[0_0_50px_rgba(16,185,129,0.3)] space-y-5 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 mx-auto flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)]">
              <CheckCircle2 className="w-9 h-9 text-emerald-400" />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-mono font-bold text-emerald-400 tracking-widest uppercase">
                {language === 'mn' ? 'АЮУЛГҮЙ БУУЛГАХ АЖИЛЛАГАА АМЖИЛТТАЙ' : 'DISPOSAL MISSION SUCCESSFUL'}
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-wide">
                {language === 'mn' ? 'АГААР МАНДАЛД АЮУЛГҮЙ БУУЛАА' : 'RE-ENTRY COMPLETE'}
              </h2>
            </div>

            {/* Scientific & Educational Note about Point Nemo / SPOUA */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-left font-mono text-xs space-y-2.5">
              <div className="flex items-center gap-2 text-sky-400 font-bold text-[11px]">
                <Waves className="w-4 h-4 text-sky-400" />
                <span>
                  {language === 'mn' ? 'ШИНЖЛЭХ УХААНЫ ТОДОРХОЙЛОЛТ (POINT NEMO / SPOUA)' : 'SCIENTIFIC NOTIFICATION (POINT NEMO / SPOUA)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {language === 'mn'
                  ? 'Сансрын хог хаягдал агаар мандлын 80-45 км өндөрт 2,500°C хүртэл халж ихэнх хэсэг нь ууршин шатаж дууслаа. Өндөр температурт тэсвэртэй титан болон зэвэрдэггүй гангийн үлдэгдэл хэсгүүд дэлхийн хуурай газраас хамгийн алслагдсан Номхон далайн Немо цэгт (South Pacific Oceanic Uninhabited Area - 48°52.6′S 123°23.6′W) хүн аюулгүйгээр живж уналаа.'
                  : 'Atmospheric frictional heating reaching 2,500°C vaporized the majority of orbital debris between 80–45 km altitude. Dense surviving titanium engine components splashed down safely in Point Nemo (South Pacific Oceanic Uninhabited Area - SPOUA), the oceanic pole of inaccessibility with zero risk to human settlements.'}
              </p>
              <div className="flex justify-between items-center text-[10px] text-emerald-400 pt-1 border-t border-slate-800 font-bold">
                <span>NASA ODPO & ESA Clean Space</span>
                <span>Casualty Risk: &lt; 0.00001 (Zero Casualties)</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={handleReset}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-mono text-xs font-bold border border-slate-800 flex items-center justify-center gap-2 min-h-[44px]"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{t.common.retry}</span>
              </button>
              <button
                onClick={() => {
                  sound.playLockChime();
                  onProceedToEvaluation();
                }}
                className="w-full sm:w-auto px-8 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm font-mono flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.5)] active:scale-95 transition-all min-h-[48px]"
              >
                <span>{language === 'mn' ? 'ДААЛГАВАР БИЕЛҮҮЛСЭН ТАЙЛАН ҮЗЭХ' : 'VIEW MISSION EVALUATION REPORT'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
