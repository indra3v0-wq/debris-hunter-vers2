/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import confetti from 'canvas-confetti';
import { MissionState, Language } from '../types';
import { buildModularSpacecraft } from '../three/spacecraftBuilder';
import { buildDebrisModel } from '../three/debrisBuilder';
import { createNasaEarthMesh, createNasaSpaceEnvironment } from '../three/proceduralEarth';
import { sound } from '../utils/audio';
import { TRANSLATIONS } from '../utils/translations';
import { 
  ShieldCheck, 
  AlertTriangle, 
  ArrowRight, 
  RotateCcw, 
  Play,
  Flame, 
  CheckCircle2, 
  Lock,
  Compass,
  Camera,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Wrench,
  PackageCheck
} from 'lucide-react';

interface StageCaptureProps {
  language?: Language;
  missionState: MissionState;
  onUpdateState: (partial: Partial<MissionState>) => void;
  onProceedToDisposal: () => void;
}

type CaptureStep = 1 | 2 | 3 | 4;
type CaptureCamMode = 'docking' | 'arm' | 'chase' | 'free';

export const StageCapture: React.FC<StageCaptureProps> = ({
  language = 'mn',
  missionState,
  onUpdateState,
  onProceedToDisposal,
}) => {
  const isMn = language === 'mn';
  const t = TRANSLATIONS[language];
  const canvasMountRef = useRef<HTMLDivElement>(null);

  const target = missionState.selectedMission;
  const tool = missionState.design.captureMechanism;

  // Capture phase state
  const [activeStep, setActiveStep] = useState<CaptureStep>(1);
  const [camMode, setCamMode] = useState<CaptureCamMode>('docking');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isLatching, setIsLatching] = useState<boolean>(false);
  const [isStowing, setIsStowing] = useState<boolean>(false);
  const [currentTumbleRate, setCurrentTumbleRate] = useState<number>(target.tumbleRateDegS);
  const [alignmentPct, setAlignmentPct] = useState<number>(45);
  const [captureStatus, setCaptureStatus] = useState<'ready' | 'success' | 'failed'>(
    missionState.isCaptured ? 'success' : 'ready'
  );
  const [failureReason, setFailureReason] = useState<string>('');
  const [hudCollapsed, setHudCollapsed] = useState<boolean>(false);

  const spacecraftRef = useRef<ReturnType<typeof buildModularSpacecraft> | null>(null);
  const debrisRef = useRef<ReturnType<typeof buildDebrisModel> | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sceneCameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // 3D Scene setup
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

    // Warm Sun and rim lighting for space contrast
    const sunLight = new THREE.DirectionalLight(0xfff7ed, 3.0);
    sunLight.position.set(12, 15, 14);
    scene.add(sunLight);

    const earthFillLight = new THREE.DirectionalLight(0x1d4ed8, 0.4);
    earthFillLight.position.set(-10, -10, -10);
    scene.add(earthFillLight);

    // 1. High-Fidelity NASA Blue Marble Earth in background
    const earthRadius = 75;
    const earthBundle = createNasaEarthMesh(earthRadius, isSoftwareGl);
    earthBundle.setSunDirection(sunLight.position.clone().normalize());
    earthBundle.group.position.set(0, -earthRadius - 10, -20);
    scene.add(earthBundle.group);

    // 2. NASA Deep Space Environment
    const spaceEnv = createNasaSpaceEnvironment(isSoftwareGl);
    scene.add(spaceEnv.group);

    // Spacecraft Model (Player's custom spacecraft)
    const scBundle = buildModularSpacecraft(missionState.design);
    scBundle.group.position.set(0, 0, 2.2);
    scene.add(scBundle.group);
    spacecraftRef.current = scBundle;

    // Debris Model
    const debBundle = buildDebrisModel(target);
    debBundle.group.position.set(0, 0.35, -2.0);
    scene.add(debBundle.group);
    debrisRef.current = debBundle;

    // Visual Docking Guidance Crosshair Line
    const guideGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.2, 1.2),
      new THREE.Vector3(0, 0.35, -1.2),
    ]);
    const guideMat = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      dashSize: 0.2,
      gapSize: 0.15,
      transparent: true,
      opacity: 0.65,
    });
    const guideLine = new THREE.Line(guideGeo, guideMat);
    guideLine.computeLineDistances();
    scene.add(guideLine);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 400);
    camera.position.set(0, 1.6, 5.8);
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

      // Debris spin animation (tumbles if not zeroed)
      if (debBundle) {
        debBundle.update(delta * (currentTumbleRate / 10));
      }
      if (scBundle) {
        scBundle.update(delta);
      }

      // Rotate NASA Earth and cosmic environment
      earthBundle.update(delta);
      spaceEnv.update(delta);

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
      guideGeo.dispose();
      guideMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [target]);

  // Camera switcher
  const handleChangeCamera = (mode: CaptureCamMode) => {
    sound.playClick(1050);
    setCamMode(mode);
    const camera = sceneCameraRef.current;
    if (!camera) return;

    if (controlsRef.current) {
      controlsRef.current.enabled = mode === 'free';
      if (mode === 'free') {
        controlsRef.current.target.set(0, 0.4, 0);
      }
    }

    if (mode === 'docking') {
      camera.position.set(0, 1.4, 4.6);
      camera.lookAt(0, 0.35, -2.0);
    } else if (mode === 'arm') {
      camera.position.set(-1.2, 0.8, 1.4);
      camera.lookAt(0, 0.35, -1.5);
    } else if (mode === 'chase') {
      camera.position.set(4.5, 3.0, 7.5);
      camera.lookAt(0, 0.2, 0);
    }
  };

  // Step 1: Align attitude with debris
  const handleAlignAttitude = () => {
    setIsSyncing(true);
    sound.playThruster(1.2);

    if (spacecraftRef.current) {
      spacecraftRef.current.setThrusterFiring(true);
    }

    let progress = alignmentPct;
    const interval = setInterval(() => {
      progress += 6;
      setAlignmentPct(Math.min(100, progress));

      if (progress >= 100) {
        clearInterval(interval);
        setIsSyncing(false);
        setActiveStep(2);
        sound.playLockChime();
        if (spacecraftRef.current) {
          spacecraftRef.current.setThrusterFiring(false);
        }
      }
    }, 100);
  };

  // Step 2: Deploy Robotic Arm
  const handleDeployArm = () => {
    sound.playClick(900);
    sound.playThruster(0.6);

    // Articulate 5-DOF robotic arm: shoulder, elbow, wrist extend and 3 grapple fingers open wide
    let ext = 0;
    const extInterval = setInterval(() => {
      ext += 0.1;
      if (spacecraftRef.current) {
        spacecraftRef.current.setArmKinematics({
          extension: Math.min(1.0, ext),
          aimPitch: 0.08,
          clawOpen: Math.min(1.0, ext * 1.2),
          isGripping: false,
        });
      }
      if (ext >= 1.0) {
        clearInterval(extInterval);
        setActiveStep(3);
      }
    }, 60);
  };

  // Step 3: Mechanical Claw Latch & Grip Debris
  const handleExecuteLatch = () => {
    setIsLatching(true);
    sound.playClick(950);

    setTimeout(() => {
      // Check alignment threshold
      if (alignmentPct < 60) {
        sound.playWarning();
        sound.playExplosion();
        setCaptureStatus('failed');
        setFailureReason(
          isMn
            ? `Тэнхлэгийн тэнцвэржилт хангалтгүй (${alignmentPct}% < 60%). Робот гар хошуу гулсав.`
            : `Attitude alignment insufficient (${alignmentPct}% < 60%). Latch slipped.`
        );
        onUpdateState({
          failedCaptureAttempts: (missionState.failedCaptureAttempts || 0) + 1,
        });
        setIsLatching(false);
        return;
      }

      sound.playCaptureLatch();

      // Clamp 3 grapple fingers securely around target
      if (spacecraftRef.current) {
        spacecraftRef.current.setArmKinematics({
          extension: 1.0,
          aimPitch: 0.08,
          clawOpen: 0,
          isGripping: true,
        });
      }

      // Neutralize tumble to 0
      let dampRate = target.tumbleRateDegS;
      const dampInterval = setInterval(() => {
        dampRate = Math.max(0, dampRate - 1.2);
        setCurrentTumbleRate(Math.round(dampRate * 10) / 10);

        if (dampRate <= 0.1) {
          clearInterval(dampInterval);
          setCurrentTumbleRate(0.0);
          setIsLatching(false);

          // Step 4: Stow into payload berth with synchronous debris retraction
          setIsStowing(true);
          let stowProgress = 0;
          const stowInterval = setInterval(() => {
            stowProgress += 0.1;
            const p = Math.min(1.0, stowProgress);

            // Move debris synchronously with arm towards payload bay
            if (debrisRef.current) {
              debrisRef.current.group.position.set(0, 0.35 - p * 0.10, -2.0 + p * 2.6);
              debrisRef.current.group.scale.set(1 - p * 0.35, 1 - p * 0.35, 1 - p * 0.35);
            }
            if (spacecraftRef.current) {
              spacecraftRef.current.setArmKinematics({
                extension: 1.0 - p * 0.85,
                aimPitch: 0.08 * (1 - p),
                clawOpen: 0,
                isGripping: true,
              });
            }

            if (p >= 1.0) {
              clearInterval(stowInterval);
              setIsStowing(false);
              setCaptureStatus('success');
              setActiveStep(4);

              try {
                confetti({
                  particleCount: 110,
                  spread: 90,
                  origin: { y: 0.5 },
                  colors: ['#38bdf8', '#34d399', '#f59e0b', '#a855f7'],
                });
              } catch {}

              // Update session state: mark captured & increment count
              onUpdateState({
                isCaptured: true,
                capturedCount: (missionState.capturedCount || 0) + 1,
                targetTumbleRateDegS: 0.0,
                captureOutcome: {
                  success: true,
                  reason: isMn
                    ? '3 сарвуут робот гар хогийг найдвартай атгаж, хөлгийн хадгалах хэсэгт бэхэллээ.'
                    : 'Tri-axial robotic grapple firmly secured debris into payload berth.',
                  details: isMn ? 'Эргэлтийн момент 0°/с болж бүрэн зогслоо.' : 'Target momentum neutralized to 0.0 deg/s.',
                },
              });
            }
          }, 80);
        }
      }, 100);
    }, 700);
  };

  const handleResetCapture = () => {
    sound.playClick();
    setActiveStep(1);
    setAlignmentPct(45);
    setCurrentTumbleRate(target.tumbleRateDegS);
    setCaptureStatus('ready');
    setFailureReason('');
    if (debrisRef.current) {
      debrisRef.current.group.position.set(0, 0.35, -2.0);
      debrisRef.current.group.scale.set(1, 1, 1);
    }
    if (spacecraftRef.current) {
      spacecraftRef.current.setArmExtension(0);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-48px)] mt-12 bg-slate-950 overflow-hidden select-none">
      {/* 3D WebGL Canvas */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Left: Target & Telemetry Status Card */}
      <div className="absolute top-3 left-3 z-20 pointer-events-none max-w-[280px] sm:max-w-xs">
        <div className="aerospace-panel p-3 rounded-2xl border-sky-500/30 bg-slate-950/90 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-mono font-bold text-sky-400 tracking-wider">
              {isMn ? 'ЗОРИЛТОТ ОБЪЕКТ' : 'TARGET TELEMETRY'}
            </span>
          </div>
          <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
            {isMn ? target.nameMn : target.name}
          </h2>

          <div className="mt-2 p-2 bg-slate-900/80 rounded-xl border border-slate-800 text-[11px] font-mono space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">{isMn ? 'Эргэлт:' : 'Spin:'}</span>
              <span className={currentTumbleRate > 0.5 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                {currentTumbleRate}°/s {currentTumbleRate <= 0.1 ? (isMn ? '(Тогтворжсон)' : '(Neutralized)') : ''}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{isMn ? 'Тэнцвэржилт:' : 'Alignment:'}</span>
              <span className="text-sky-300 font-bold">{alignmentPct}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full ${alignmentPct >= 70 ? 'bg-emerald-400' : 'bg-sky-400'}`}
                style={{ width: `${alignmentPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Camera Selection Bar (Top Center) */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
        <div className="aerospace-panel px-2.5 py-1 rounded-full border-sky-500/30 flex items-center gap-1.5 text-[10px] font-mono shadow-xl bg-slate-950/95">
          <Camera className="w-3.5 h-3.5 text-sky-400 ml-1 mr-0.5 shrink-0" />
          {[
            { id: 'docking', labelMn: 'Залгалт', labelEn: 'Docking' },
            { id: 'arm', labelMn: 'Гар Кам', labelEn: 'Arm Cam' },
            { id: 'chase', labelMn: 'Хөлөг Тойм', labelEn: 'Chase' },
            { id: 'free', labelMn: '360° Чөлөөт', labelEn: 'Free Cam' },
          ].map(c => (
            <button
              key={c.id}
              onClick={() => handleChangeCamera(c.id as CaptureCamMode)}
              className={`min-h-[32px] px-2.5 py-1 rounded-full transition-colors whitespace-nowrap ${
                camMode === c.id
                  ? 'bg-sky-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {isMn ? c.labelMn : c.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Docking Crosshair Sight in center */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-48 h-48 border border-sky-400/20 rounded-full flex items-center justify-center">
          <div className="w-32 h-32 border border-sky-400/30 rounded-full" />
          <div className="w-2 h-2 rounded-full bg-sky-400" />
        </div>
      </div>

      {/* SUCCESS CELEBRATION MODAL (USER REQ: OBJECT CAPTURED / ОБЪЕКТЫГ БАРЬЖ АВЛАА) */}
      {captureStatus === 'success' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-fadeIn pointer-events-auto">
          <div className="max-w-md w-full bg-slate-950/95 border-2 border-emerald-400/80 rounded-2xl shadow-[0_0_50px_rgba(16,185,129,0.4)] p-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              <PackageCheck className="w-9 h-9" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-widest font-mono">
                OBJECT CAPTURED
              </h2>
              <p className="text-base sm:text-lg font-bold text-emerald-400 mt-1">
                {isMn ? 'ОБЪЕКТЫГ АМЖИЛТТАЙ БАРЬЖ АВЛАА' : 'DEBRIS SECURED IN BERTH'}
              </p>
              <p className="text-xs text-slate-300 mt-2 font-mono leading-relaxed">
                {isMn
                  ? 'Робот гар сарвуугаараа хогийг бүрэн атгаж, хөлгийн хадгалах хэсэгт найдвартай бэхэллээ. Хогийн эргэлтийн хурд 0°/с болж тогтворжив.'
                  : 'Robotic claw locked around target. Debris stowed in berth. Tumble neutralized to 0 deg/s.'}
              </p>
            </div>

            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs font-mono flex items-center justify-between text-slate-300">
              <span>{isMn ? 'Нийт цуглуулсан хог:' : 'Total Captured:'}</span>
              <strong className="text-emerald-400 text-sm">{missionState.capturedCount} объект</strong>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
              <button
                onClick={handleResetCapture}
                className="w-full sm:w-auto px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono font-bold flex items-center justify-center gap-1.5 border border-slate-700 min-h-[44px]"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{isMn ? 'Дахин оролдох' : 'Retry'}</span>
              </button>

              <button
                onClick={() => {
                  sound.playLockChime();
                  onProceedToDisposal();
                }}
                className="w-full flex-1 min-h-[48px] px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm font-mono flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.4)] active:scale-95 transition-all"
              >
                <Flame className="w-4 h-4" />
                <span>{isMn ? 'АЮУЛГҮЙ БУУЛГАЛТЫГ ЭХЛҮҮЛЭХ' : 'PROCEED TO DEORBIT DISPOSAL'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Bottom Control Dock */}
      <div
        className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-[96%] max-w-4xl transition-transform duration-300 pointer-events-auto ${
          hudCollapsed ? 'translate-y-[calc(100%-2.5rem)]' : 'translate-y-0'
        }`}
      >
        <div className="aerospace-panel rounded-2xl overflow-hidden shadow-2xl border-sky-500/40 bg-slate-950/95 backdrop-blur-md">
          {/* Header Bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-sky-500/20 text-xs font-mono">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-sky-400" />
              <span className="font-bold text-white tracking-wide">
                {isMn ? 'РОБОТ ГАРЫН УДИРДЛАГА' : 'ROBOTIC ARM DOCKING INTERFACE'}
              </span>
            </div>

            <button
              onClick={() => {
                sound.playClick();
                setHudCollapsed(!hudCollapsed);
              }}
              className="min-h-[36px] px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors flex items-center gap-1"
            >
              {hudCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              <span>{hudCollapsed ? (isMn ? 'Дэлгэх' : 'Expand') : (isMn ? 'Хураах' : 'Collapse')}</span>
            </button>
          </div>

          {/* Sequential 4-Step Robotic Arm Pipeline */}
          <div className="p-3 bg-slate-950/90 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
            {[
              {
                step: 1,
                titleMn: '1. Тэнхлэг тэгшлэх',
                titleEn: '1. Attitude Align',
                descMn: 'Хөлгийн өнцгийг хогтой уялдуулах',
                descEn: 'Match target orbital attitude',
                done: activeStep > 1,
                active: activeStep === 1,
              },
              {
                step: 2,
                titleMn: '2. Гар сунгах',
                titleEn: '2. Extend Arm',
                descMn: 'Робот гар хог руу чиглэх',
                descEn: 'Articulate arm towards target',
                done: activeStep > 2,
                active: activeStep === 2,
              },
              {
                step: 3,
                titleMn: '3. Сарвуугаар атгах',
                titleEn: '3. Claw Gripper',
                descMn: 'Сарвууг хааж эргэлтийг 0 болгох',
                descEn: 'Lock gripper & zero tumble',
                done: activeStep > 3,
                active: activeStep === 3,
              },
              {
                step: 4,
                titleMn: '4. Хөлөгт татах',
                titleEn: '4. Berth & Stow',
                descMn: 'Хадгалах хэсэгт бэхлэх',
                descEn: 'Stow securely in payload bay',
                done: captureStatus === 'success',
                active: activeStep === 4,
              },
            ].map(item => (
              <div
                key={item.step}
                className={`p-2.5 rounded-xl border transition-all ${
                  item.done
                    ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                    : item.active
                    ? 'bg-sky-500/20 border-sky-400 text-white shadow-[0_0_10px_rgba(56,189,248,0.25)]'
                    : 'bg-slate-900/60 border-slate-800 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold mb-0.5">
                  {item.done ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : null}
                  <span>{isMn ? item.titleMn : item.titleEn}</span>
                </div>
                <p className="text-[10px] text-slate-400 line-clamp-1">{isMn ? item.descMn : item.descEn}</p>
              </div>
            ))}
          </div>

          {/* Action Trigger Buttons */}
          <div className="px-4 py-3 bg-slate-900/95 border-t border-sky-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs font-mono text-slate-400 text-center sm:text-left">
              {failureReason ? (
                <span className="text-rose-400 font-bold">{failureReason}</span>
              ) : (
                <span>
                  {isMn ? 'Механизм:' : 'Mechanism:'} <strong className="text-white">{isMn ? tool.nameMn : tool.name}</strong>
                  <span className="mx-2">•</span>
                  <span>{isMn ? 'Ачаалал:' : 'Payload:'} </span>
                  <strong className="text-sky-300">{target.massKg} kg</strong>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {activeStep === 1 && (
                <button
                  disabled={isSyncing}
                  onClick={handleAlignAttitude}
                  className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs font-mono flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(56,189,248,0.35)] active:scale-95"
                >
                  <Crosshair className="w-4 h-4" />
                  <span>{isSyncing ? (isMn ? 'Тэгшилж байна...' : 'Aligning...') : (isMn ? 'ТЭНХЛЭГ ТЭГШЛЭХ' : 'ALIGN ATTITUDE')}</span>
                </button>
              )}

              {activeStep === 2 && (
                <button
                  onClick={handleDeployArm}
                  className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs font-mono flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(56,189,248,0.35)] active:scale-95"
                >
                  <Wrench className="w-4 h-4" />
                  <span>{isMn ? 'РОБОТ ГАР СУНГАХ' : 'EXTEND ROBOTIC ARM'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {activeStep === 3 && (
                <button
                  disabled={isLatching || isStowing}
                  onClick={handleExecuteLatch}
                  className="w-full sm:w-auto min-h-[44px] px-7 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.4)] active:scale-95"
                >
                  <Lock className="w-4 h-4" />
                  <span>{isLatching ? (isMn ? 'Атгаж байна...' : 'Gripping...') : isStowing ? (isMn ? 'Татаж байна...' : 'Berthing...') : (isMn ? 'САРВУУГААР АТГАХ' : 'LOCK CLAW ON DEBRIS')}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
