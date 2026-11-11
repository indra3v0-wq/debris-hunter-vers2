/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LaunchVehicle, CalculatedSpecs, SpacecraftDesign, Language, RocketConfig, CalculatedRocketSpecs, MissionState } from '../types';
import confetti from 'canvas-confetti';
import { LAUNCH_VEHICLES } from '../simulation/data';
import { buildRealisticLaunchScene, LaunchCameraMode, LaunchTelemetryData } from '../three/launchAnimation';
import { NavBallHUD } from './NavBallHUD';
import { sound } from '../utils/audio';
import { TRANSLATIONS } from '../utils/translations';
import { 
  Rocket, 
  AlertTriangle, 
  ArrowRight, 
  Play, 
  Pause, 
  RotateCcw, 
  Flame, 
  CheckCircle2, 
  Camera, 
  FastForward, 
  Compass, 
  Layers, 
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Radar,
  Sparkles
} from 'lucide-react';

interface StageLaunchProps {
  language?: Language;
  design: SpacecraftDesign;
  specs: CalculatedSpecs;
  rocketConfig: RocketConfig;
  rocketSpecs: CalculatedRocketSpecs;
  selectedRocket?: LaunchVehicle;
  onSelectRocket?: (rocket: LaunchVehicle) => void;
  onLaunchComplete: () => void;
  onUpdateState?: (partial: Partial<MissionState>) => void;
}

export const StageLaunch: React.FC<StageLaunchProps> = ({
  language = 'mn',
  design,
  specs,
  rocketConfig,
  rocketSpecs,
  onLaunchComplete,
  onUpdateState,
}) => {
  const t = TRANSLATIONS[language];
  const canvasMountRef = useRef<HTMLDivElement>(null);

  const [launching, setLaunching] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [progress, setProgress] = useState(0); // 0.0 to 1.0
  const [cameraMode, setCameraMode] = useState<LaunchCameraMode>('chase');

  // Flight HUD controls
  const [sasActive, setSasActive] = useState(true);
  const [rcsActive, setRcsActive] = useState(false);
  const [manualThrottle, setManualThrottle] = useState(100);
  const [showNavBallMobile, setShowNavBallMobile] = useState(true);
  const [showStagingMobile, setShowStagingMobile] = useState(true);

  const [telemetry, setTelemetry] = useState<LaunchTelemetryData>({
    phaseKey: 'padHold',
    altitudeKm: 0,
    velocityKms: 0,
    downrangeKm: 0,
    mach: 0,
    dynamicPressureKpa: 0,
    gForce: 1.0,
    throttlePct: 0,
    isFairingSeparated: false,
    isBoosterSeparated: false,
    isPayloadDeployed: false,
    pitchDeg: 90,
    rollDeg: 0,
    headingDeg: 90,
  });

  const sceneBundleRef = useRef<ReturnType<typeof buildRealisticLaunchScene> | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const isPayloadOverloaded = specs.wetMassKg > rocketSpecs.maxPayloadToLeoKg;

  // Initialize Three.js WebGL scene
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
    scene.fog = new THREE.FogExp2(0x020617, 0.002);

    // Warm Sun and ambient lighting
    const sunLight = new THREE.DirectionalLight(0xffedd5, 2.8);
    sunLight.position.set(35, 60, 45);
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.85);
    scene.add(hemiLight);

    // Build the user's exact assembled rocket and spacecraft payload
    const bundle = buildRealisticLaunchScene(
      container.clientWidth, 
      container.clientHeight, 
      rocketConfig, 
      design
    );
    scene.add(bundle.group);
    sceneBundleRef.current = bundle;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(bundle.camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxDistance = 150;
    controls.minDistance = 4;
    controls.enabled = false;
    controlsRef.current = controls;

    let frameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (controls.enabled) {
        controls.update();
      }
      renderer.render(scene, bundle.camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      bundle.camera.aspect = container.clientWidth / container.clientHeight;
      bundle.camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      bundle.dispose();
      sunLight.dispose();
      hemiLight.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update camera mode
  const handleChangeCameraMode = (mode: LaunchCameraMode) => {
    sound.playClick(1100);
    setCameraMode(mode);
    if (sceneBundleRef.current) {
      sceneBundleRef.current.setCameraMode(mode);
    }
    if (controlsRef.current) {
      controlsRef.current.enabled = mode === 'free';
      if (mode === 'free') {
        controlsRef.current.target.set(0, 12, 0);
      }
    }
  };

  // Launch countdown loop
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown !== null && countdown > 0) {
      timer = setTimeout(() => {
        sound.playCountdownBeep(false);
        setCountdown(countdown - 1);
      }, 900);
    } else if (countdown === 0) {
      sound.playCountdownBeep(true);
      sound.playRocketRumble(9);
      setCountdown(null);
      setLaunching(true);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Launch animation progress progression
  useEffect(() => {
    let animTimer: NodeJS.Timeout;
    if (launching && !isPaused && progress < 1) {
      animTimer = setTimeout(() => {
        const step = 0.0055 * speedMultiplier;
        const nextProgress = Math.min(1, progress + step);
        setProgress(nextProgress);

        if (sceneBundleRef.current) {
          const telem = sceneBundleRef.current.updateSequence(nextProgress, 0.08);
          setTelemetry(telem);

          // Audio triggers at flight milestones
          if (progress < 0.40 && nextProgress >= 0.40) {
            sound.playStagingSeparation();
          }
          if (progress < 0.55 && nextProgress >= 0.55) {
            sound.playFairingSeparation();
          }
          if (progress < 0.88 && nextProgress >= 0.88) {
            sound.playLockChime();
          }
          if (nextProgress >= 1) {
            sound.playLockChime();
            onUpdateState?.({
              launchSuccess: true,
              atmosphericExitSuccess: true,
              currentAltitudeKm: 520,
              orbitalVelocityKms: 7.74,
            });
            try {
              confetti({
                particleCount: 100,
                spread: 80,
                origin: { y: 0.6 },
                colors: ['#38bdf8', '#34d399', '#f59e0b'],
              });
            } catch {}
          }
        }
      }, 60);
    }
    return () => clearTimeout(animTimer);
  }, [launching, isPaused, progress, speedMultiplier]);

  const handleStartCountdown = () => {
    if (isPayloadOverloaded) {
      sound.playWarning();
      return;
    }
    sound.playClick();
    setCountdown(5);
  };

  // Manual KSP-style staging trigger
  const handleTriggerManualStage = () => {
    sound.playClick(1200);
    if (progress < 0.40) {
      sound.playStagingSeparation();
      setProgress(0.42);
    } else if (progress < 0.55) {
      sound.playFairingSeparation();
      setProgress(0.57);
    } else if (progress < 0.88) {
      sound.playLockChime();
      setProgress(0.90);
    } else {
      handleSkipToOrbit();
    }
  };

  const handleSkipToOrbit = () => {
    sound.playLockChime();
    setProgress(1);
    setLaunching(true);
    onUpdateState?.({
      launchSuccess: true,
      atmosphericExitSuccess: true,
      currentAltitudeKm: 520,
      orbitalVelocityKms: 7.74,
    });
    if (sceneBundleRef.current) {
      const telem = sceneBundleRef.current.updateSequence(1, 0.1);
      setTelemetry(telem);
    }
  };

  const handleResetLaunch = () => {
    sound.playClick();
    setLaunching(false);
    setIsPaused(false);
    setProgress(0);
    setCountdown(null);
    if (sceneBundleRef.current) {
      const telem = sceneBundleRef.current.updateSequence(0, 0.1);
      setTelemetry(telem);
    }
  };

  const getPhaseDescription = (phaseKey: string) => {
    const phases = t.launch.phases as Record<string, string>;
    return phases[phaseKey] || t.launch.phases.padHold;
  };

  return (
    <div className="relative w-full h-[calc(100vh-48px)] mt-12 bg-slate-950 overflow-hidden select-none">
      {/* 3D WebGL Canvas */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Left: Vehicle & Mass Telemetry Badge */}
      <div className="absolute top-3 left-3 z-20 pointer-events-none max-w-[280px] sm:max-w-sm">
        <div className="aerospace-panel p-2.5 sm:p-3.5 rounded-xl border-sky-500/30 bg-slate-950/90 shadow-2xl">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span className="text-[10px] font-mono font-bold text-sky-400 tracking-wider">
              {t.launch.badge}
            </span>
          </div>
          <h1 className="text-sm sm:text-base font-bold text-white tracking-wide">
            {rocketConfig.name}
          </h1>

          {/* Mass check gauge */}
          <div className="mt-2 p-2 bg-slate-950/85 rounded border border-slate-800 text-[11px] font-mono space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">{t.common.wetMass}:</span>
              <span className="text-white font-bold">{specs.wetMassKg.toLocaleString()} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">LEO Limit:</span>
              <span className="text-sky-300 font-bold">{rocketSpecs.maxPayloadToLeoKg.toLocaleString()} kg</span>
            </div>

            {/* Mass Bar */}
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full ${isPayloadOverloaded ? 'bg-rose-500' : 'bg-emerald-400'}`}
                style={{ width: `${Math.min(100, (specs.wetMassKg / rocketSpecs.maxPayloadToLeoKg) * 100)}%` }}
              />
            </div>

            {isPayloadOverloaded ? (
              <div className="text-[10px] text-rose-400 font-bold flex items-center gap-1 pt-0.5">
                <AlertTriangle className="w-3 h-3" />
                <span>{t.launch.overloadWarning}</span>
              </div>
            ) : (
              <div className="text-[10px] text-emerald-400 flex items-center gap-1 pt-0.5">
                <CheckCircle2 className="w-3 h-3" />
                <span>{t.launch.massMargin}: +{(rocketSpecs.maxPayloadToLeoKg - specs.wetMassKg).toLocaleString()} kg</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Camera Selection Bar (Top Center) */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
        <div className="aerospace-panel px-2 py-1 rounded-full border-sky-500/30 flex items-center gap-1 text-[10px] font-mono shadow-xl bg-slate-950/95 max-w-[95vw] overflow-x-auto scrollbar-none">
          <Camera className="w-3.5 h-3.5 text-sky-400 ml-1 mr-0.5 shrink-0" />
          {[
            { id: 'chase', labelMn: 'Дагах', labelEn: 'Chase' },
            { id: 'pad', labelMn: 'Талбай', labelEn: 'Pad' },
            { id: 'tracking', labelMn: 'Телескоп', labelEn: 'Track' },
            { id: 'booster', labelMn: 'Түлхэгч', labelEn: 'Booster' },
            { id: 'cockpit', labelMn: 'Нисгэгч', labelEn: 'Cockpit' },
            { id: 'spacecraft', labelMn: 'Хөлөг', labelEn: 'Craft' },
            { id: 'free', labelMn: 'Чөлөөт', labelEn: 'Free' },
          ].map(c => (
            <button
              key={c.id}
              onClick={() => handleChangeCameraMode(c.id as LaunchCameraMode)}
              className={`px-2 py-0.5 rounded-full transition-colors whitespace-nowrap min-h-[28px] flex items-center ${
                cameraMode === c.id
                  ? 'bg-sky-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {language === 'mn' ? c.labelMn : c.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Countdown Visual Overlay */}
      {countdown !== null && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 pointer-events-none">
          <div className="text-center font-mono">
            <div className="text-7xl sm:text-8xl font-bold text-amber-400 tracking-widest drop-shadow-[0_0_30px_rgba(251,191,36,0.8)]">
              T - 00:0{countdown}
            </div>
            <div className="text-sm text-sky-300 tracking-widest mt-2 uppercase font-semibold">
              {language === 'mn' ? 'ХӨӨРӨХ ТООЛОЛ ЯВАГДАЖ БАЙНА' : 'TERMINAL COUNTDOWN SEQUENCE ACTIVE'}
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM-LEFT: Authentic KSP/NASA NavBall HUD */}
      {launching && showNavBallMobile && (
        <div className="absolute bottom-20 sm:bottom-24 left-3 z-20 pointer-events-auto">
          <NavBallHUD
            language={language}
            pitchDeg={telemetry.pitchDeg}
            rollDeg={telemetry.rollDeg}
            headingDeg={telemetry.headingDeg}
            surfaceVelMs={telemetry.velocityKms * 1000}
            altitudeM={telemetry.altitudeKm * 1000}
            mach={telemetry.mach}
            gForce={telemetry.gForce}
            throttlePct={telemetry.throttlePct}
            sasActive={sasActive}
            onToggleSas={() => {
              sound.playClick(950);
              setSasActive(!sasActive);
            }}
            rcsActive={rcsActive}
            onToggleRcs={() => {
              sound.playClick(1150);
              setRcsActive(!rcsActive);
            }}
            compact={window.innerWidth < 640}
          />
        </div>
      )}

      {/* RIGHT SIDE: KSP-Style Vertical Staging Stack (Matches image_b8b73fad.png & image_3fbef3dd.png) */}
      {launching && showStagingMobile && (
        <div className="absolute top-14 sm:top-16 right-3 z-20 pointer-events-auto max-w-[190px] sm:max-w-[210px] w-full">
          <div className="aerospace-panel p-2.5 rounded-xl border-sky-500/40 bg-slate-950/95 font-mono text-[10px] shadow-2xl space-y-2">
            <div className="flex items-center justify-between border-b border-sky-500/20 pb-1">
              <span className="text-sky-400 font-bold flex items-center gap-1">
                <Layers className="w-3 h-3 text-sky-400" />
                {language === 'mn' ? 'ШАТЛАЛ БА ДАРААЛАЛ' : 'STAGING STACK'}
              </span>
              <span className="text-[9px] text-emerald-400 font-bold">Δv 7,080 m/s</span>
            </div>

            {/* Stages Stack: 05 to 01 */}
            <div className="space-y-1.5">
              {/* Stage 05: Spacecraft / Payload Deploy */}
              <div className={`p-1.5 rounded border transition-all ${
                telemetry.isPayloadDeployed
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                  : progress >= 0.70
                  ? 'bg-sky-500/20 border-sky-400 text-sky-300 animate-pulse'
                  : 'bg-slate-900/80 border-slate-800 text-slate-500'
              }`}>
                <div className="flex justify-between font-bold">
                  <span>05 {language === 'mn' ? 'ХӨЛӨГ САЛГАХ' : 'PAYLOAD'}</span>
                  <span>{telemetry.isPayloadDeployed ? 'DEPLOYED' : 'ARMED'}</span>
                </div>
              </div>

              {/* Stage 04: Fairing Jettison */}
              <div className={`p-1.5 rounded border transition-all ${
                telemetry.isFairingSeparated
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                  : progress >= 0.50
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300 animate-pulse'
                  : 'bg-slate-900/80 border-slate-800 text-slate-500'
              }`}>
                <div className="flex justify-between font-bold">
                  <span>04 {language === 'mn' ? 'ХАВТАС УНАГАХ' : 'FAIRING'}</span>
                  <span>{telemetry.isFairingSeparated ? 'JETTISONED' : 'ATTACHED'}</span>
                </div>
              </div>

              {/* Stage 03: Upper Stage MVac Engine */}
              <div className={`p-1.5 rounded border transition-all ${
                progress >= 0.88
                  ? 'bg-slate-900/80 border-slate-800 text-slate-500'
                  : telemetry.isBoosterSeparated
                  ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                  : 'bg-slate-900/80 border-slate-800 text-slate-500'
              }`}>
                <div className="flex justify-between font-bold">
                  <span>03 {language === 'mn' ? '2-Р ШАТ MVAC' : 'STAGE 2 VAC'}</span>
                  <span className="text-amber-400">{telemetry.isBoosterSeparated && progress < 0.88 ? 'FIRING' : 'READY'}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1 mt-1 overflow-hidden">
                  <div
                    className="bg-sky-400 h-full"
                    style={{ width: `${telemetry.isBoosterSeparated ? Math.max(0, 100 - (progress - 0.4) * 200) : 100}%` }}
                  />
                </div>
              </div>

              {/* Stage 02: Booster Decoupler */}
              <div className={`p-1.5 rounded border transition-all ${
                telemetry.isBoosterSeparated
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                  : progress >= 0.35
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300 animate-pulse'
                  : 'bg-slate-900/80 border-slate-800 text-slate-500'
              }`}>
                <div className="flex justify-between font-bold">
                  <span>02 {language === 'mn' ? 'ШИЛЖИХ ЦАГАРИГ' : 'INTERSTAGE'}</span>
                  <span>{telemetry.isBoosterSeparated ? 'SEPARATED' : 'LOCKED'}</span>
                </div>
              </div>

              {/* Stage 01: Core Booster 9x Nozzles */}
              <div className={`p-1.5 rounded border transition-all ${
                telemetry.isBoosterSeparated
                  ? 'bg-slate-900/80 border-slate-800 text-slate-500'
                  : progress > 0.05
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 shadow-[0_0_8px_rgba(52,211,153,0.3)]'
                  : 'bg-slate-900/80 border-slate-800 text-slate-400'
              }`}>
                <div className="flex justify-between font-bold">
                  <span>01 {language === 'mn' ? 'ҮНДСЭН ТҮЛХЭГЧ (9)' : 'MAIN BOOSTER (9)'}</span>
                  <span className="text-amber-400">{!telemetry.isBoosterSeparated && progress > 0.05 ? 'FIRING' : 'IDLE'}</span>
                </div>
                {/* Fuel gauge bar */}
                <div className="w-full bg-slate-800 rounded-full h-1 mt-1 overflow-hidden">
                  <div
                    className="bg-emerald-400 h-full"
                    style={{ width: `${Math.max(0, 100 - (progress / 0.4) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Manual KSP Stage Push Button */}
            {progress < 1 && (
              <button
                onClick={handleTriggerManualStage}
                className="w-full py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-[0_0_12px_rgba(16,185,129,0.4)] active:scale-95"
              >
                <Flame className="w-3.5 h-3.5 fill-current" />
                <span>GO / {language === 'mn' ? 'ШАТ САЛГАХ' : 'STAGE'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Unified Bottom Control Dock */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-[96%] max-w-5xl pointer-events-auto">
        <div className="aerospace-panel rounded-xl overflow-hidden shadow-2xl border-sky-500/40 bg-slate-950/95">
          {/* Assembled Rocket Specifications Cards (when not launched) */}
          {!launching && (
            <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-2.5 bg-slate-900/95 border-b border-sky-500/20 max-h-56 overflow-y-auto">
              <div className="p-2.5 rounded-lg border bg-sky-500/10 border-sky-400/40 text-left">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-xs text-white">
                    {language === 'mn' ? 'ҮНДСЭН ШАТ 1' : 'CORE STAGE 1'}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400">TWR {rocketSpecs.twrSeaLevel}</span>
                </div>
                <p className="text-[11px] text-slate-300 font-mono mb-1">
                  {rocketConfig.engine.name} ({rocketConfig.engine.thrustKn} kN)
                </p>
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>Түлш: {rocketConfig.fuelLoadKg.toLocaleString()} kg</span>
                  <span className="text-sky-300">Isp: {rocketConfig.engine.ispSeconds}s</span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border bg-slate-950/70 border-slate-800 text-left">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-xs text-white">
                    {language === 'mn' ? 'НЭМЭЛТ ТҮЛХЭГЧ БА ШАТ 2' : 'BOOSTERS & STAGE 2'}
                  </span>
                  <span className="text-[10px] font-mono text-amber-400">{rocketConfig.boosterCount}x Boosters</span>
                </div>
                <p className="text-[11px] text-slate-300 font-mono mb-1">
                  {rocketConfig.boosterCount > 0 ? `${rocketConfig.boosterCount}x хатуу түлшт түлхэгч` : 'Нэмэлт түлхэгчгүй'}
                </p>
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>Савны багтаамж: {rocketConfig.tank.fuelCapacityKg.toLocaleString()} kg</span>
                  <span className="text-emerald-400">Δv: {rocketSpecs.deltaVMs.toLocaleString()} m/s</span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border bg-slate-950/70 border-slate-800 text-left">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-xs text-white">
                    {language === 'mn' ? 'ХАМГААЛАХ ХАВТАС' : 'PAYLOAD FAIRING'}
                  </span>
                  <span className="text-[10px] font-mono text-sky-400">⌀ {rocketConfig.fairing.diameterM}m</span>
                </div>
                <p className="text-[11px] text-slate-300 font-mono mb-1">
                  {rocketConfig.fairing.name}
                </p>
                <div className="flex justify-between text-[10px] font-mono">
                  <span className={specs.wetMassKg <= rocketSpecs.maxPayloadToLeoKg ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    Max LEO: {rocketSpecs.maxPayloadToLeoKg.toLocaleString()} kg
                  </span>
                  <span className="text-slate-400">${rocketSpecs.estimatedLaunchCostM}M</span>
                </div>
              </div>
            </div>
          )}

          {/* Action & Playback Bar */}
          <div className="px-3 sm:px-4 py-2.5 bg-slate-950/95 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            {/* Status & Progress Bar */}
            <div className="text-xs font-mono flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
              {!launching ? (
                <span className="text-slate-300 text-[11px] sm:text-xs">
                  {language === 'mn' ? 'ХӨӨРӨХӨД БЭЛЭН' : 'LAUNCH READY'}: <strong className="text-white">{design.name}</strong> / <strong className="text-sky-400">{rocketConfig.name}</strong>.
                </span>
              ) : progress < 1 ? (
                <div className="flex items-center gap-2.5">
                  <div className="w-28 sm:w-36 bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div className="bg-sky-400 h-full transition-all" style={{ width: `${progress * 100}%` }} />
                  </div>
                  <span className="text-sky-300 font-bold text-xs">{Math.round(progress * 100)}% {language === 'mn' ? 'ХӨӨРӨЛТ' : 'ASCENT'}</span>
                  <span className="text-slate-400 hidden sm:inline">• {getPhaseDescription(telemetry.phaseKey)}</span>
                </div>
              ) : (
                <span className="text-emerald-400 font-bold flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  {t.launch.phases.orbitAchieved}
                </span>
              )}

              {/* Mobile toggles for HUD panels */}
              {launching && (
                <div className="flex items-center gap-1 sm:hidden">
                  <button
                    onClick={() => setShowNavBallMobile(!showNavBallMobile)}
                    className={`px-2 py-1 rounded text-[10px] font-mono border ${showNavBallMobile ? 'bg-sky-500/20 text-sky-300 border-sky-400' : 'bg-slate-900 text-slate-400 border-slate-800'}`}
                  >
                    NavBall
                  </button>
                  <button
                    onClick={() => setShowStagingMobile(!showStagingMobile)}
                    className={`px-2 py-1 rounded text-[10px] font-mono border ${showStagingMobile ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400' : 'bg-slate-900 text-slate-400 border-slate-800'}`}
                  >
                    Stage
                  </button>
                </div>
              )}
            </div>

            {/* Playback & Action Controls */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {!launching ? (
                <button
                  disabled={isPayloadOverloaded || countdown !== null}
                  onClick={handleStartCountdown}
                  className={`w-full sm:w-auto px-6 py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all min-h-[44px] ${
                    isPayloadOverloaded
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.35)] active:scale-95'
                  }`}
                >
                  <Rocket className="w-4 h-4" />
                  <span>{t.launch.startCountdown}</span>
                </button>
              ) : progress < 1 ? (
                <>
                  {/* Play/Pause */}
                  <button
                    onClick={() => {
                      sound.playClick();
                      setIsPaused(!isPaused);
                    }}
                    className="p-2 sm:p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs min-h-[40px] min-w-[40px] flex items-center justify-center"
                    title={isPaused ? t.common.play : t.common.pause}
                  >
                    {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  </button>

                  {/* Speed toggles */}
                  <div className="flex items-center rounded-lg bg-slate-800/80 border border-slate-700 p-0.5 text-[10px] font-mono">
                    {[1, 2, 4].map(spd => (
                      <button
                        key={spd}
                        onClick={() => {
                          sound.playClick();
                          setSpeedMultiplier(spd);
                        }}
                        className={`px-2 py-1.5 rounded transition-colors ${speedMultiplier === spd ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>

                  {/* Skip to orbit */}
                  <button
                    onClick={handleSkipToOrbit}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1 border border-slate-700 min-h-[40px]"
                  >
                    <FastForward className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{t.launch.fastForward}</span>
                  </button>

                  {/* Reset */}
                  <button
                    onClick={handleResetLaunch}
                    className="p-2 sm:p-2.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700 text-xs min-h-[40px] min-w-[40px] flex items-center justify-center"
                    title={t.common.reset}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleResetLaunch}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1 min-h-[44px]"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t.common.retry}</span>
                  </button>
                  <button
                    onClick={() => {
                      sound.playLockChime();
                      onLaunchComplete();
                    }}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(56,189,248,0.35)] min-h-[44px] active:scale-95"
                  >
                    <span>{t.launch.proceedToOrbit}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Centered Orbit Insertion Celebration Modal */}
      {progress >= 1 && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn pointer-events-auto">
          <div className="w-full max-w-md aerospace-panel rounded-2xl border-emerald-500/50 bg-slate-950/95 p-6 shadow-[0_0_50px_rgba(16,185,129,0.35)] space-y-5 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 mx-auto flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)]">
              <CheckCircle2 className="w-9 h-9 text-emerald-400" />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-mono font-bold text-emerald-400 tracking-widest uppercase">
                {language === 'mn' ? 'ХӨӨРӨЛТИЙН ШАТЛАЛ АМЖИЛТТАЙ' : 'ORBIT INSERTION SUCCESSFUL'}
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white font-mono tracking-wide">
                {language === 'mn' ? 'АГААР МАНДЛААС АМЖИЛТТАЙ ГАРЛАА' : 'LAUNCH SUCCESSFUL'}
              </h2>
            </div>

            <p className="text-xs text-slate-300 font-mono leading-relaxed">
              {language === 'mn'
                ? 'Пуужин агаар мандлын зузаан үеийг нэвтэрч, хөлөг 520 км-ийн тойрог замд 7.61 км/с хурдтайгаар тогтворжин орлоо. Сансрын хог илрүүлэх радар бэлэн.'
                : 'Vehicle has cleared the dense atmosphere and successfully stabilized into a 520 km orbit at 7.61 km/s. Spacecraft radar systems online.'}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
              <button
                onClick={handleResetLaunch}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-mono text-xs border border-slate-800 min-h-[44px]"
              >
                <RotateCcw className="w-4 h-4 inline mr-1" />
                <span>{t.common.retry}</span>
              </button>
              <button
                onClick={() => {
                  sound.playLockChime();
                  onLaunchComplete();
                }}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.5)] active:scale-95 transition-all min-h-[44px]"
              >
                <span>{language === 'mn' ? 'ХОГ ИЛРҮҮЛЭХ ШАТ РУУ ШИЛЖИХ' : 'PROCEED TO RADAR DETECTION'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
