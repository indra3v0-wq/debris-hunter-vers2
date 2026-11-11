/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import confetti from 'canvas-confetti';
import { MissionState, Language, FlightDebriefReport } from '../types';
import { createNasaEarthMesh, createNasaSpaceEnvironment } from '../three/proceduralEarth';
import { MongolianFlag } from './MongolianFlag';
import { sound } from '../utils/audio';
import { 
  Award, 
  CheckCircle2, 
  RotateCcw, 
  ArrowRight, 
  ShieldCheck, 
  Flame, 
  Zap, 
  Layers,
  ChevronDown,
  ChevronUp,
  Globe,
  Printer,
  History,
  AlertTriangle,
  FileText,
  User,
  Calendar,
  Clock,
  Radar,
  Crosshair,
  PackageCheck,
  Waves,
  X
} from 'lucide-react';

interface StageEvaluationProps {
  language?: Language;
  missionState: MissionState;
  onSelectNewMission: () => void;
  onRedesignSpacecraft: () => void;
  onReplayMission?: () => void;
}

export const StageEvaluation: React.FC<StageEvaluationProps> = ({
  language = 'mn',
  missionState,
  onSelectNewMission,
  onRedesignSpacecraft,
  onReplayMission,
}) => {
  const isMn = language === 'mn';
  const target = missionState.selectedMission;
  const design = missionState.design;
  const specs = missionState.specs;
  const rocketConfig = missionState.rocketConfig;
  const rocketSpecs = missionState.rocketSpecs;

  const canvasMountRef = useRef<HTMLDivElement>(null);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showFullTechnicalModal, setShowFullTechnicalModal] = useState<boolean>(false);
  const [callsign, setCallsign] = useState<string>(() => {
    return localStorage.getItem('quasar_callsign') || (isMn ? 'САНСРЫН КОМАНДЛАГЧ #01' : 'FLIGHT COMMANDER #01');
  });
  const [isEditingCallsign, setIsEditingCallsign] = useState<boolean>(false);
  const [flightHistory, setFlightHistory] = useState<FlightDebriefReport[]>([]);

  // 1. Calculate REAL completion percentage based strictly on achieved milestones
  // Assembly: 20%, Launch: 20%, Atmosphere Exit: 20%, Detection: 10%, Capture: 15%, Disposal: 15%
  const milestoneAssemblyPassed = rocketSpecs?.isFeasible ?? true;
  const milestoneLaunchPassed = missionState.launchSuccess ?? false;
  const milestoneAtmospherePassed = missionState.atmosphericExitSuccess ?? false;
  const milestoneDetectionPassed = (missionState.radarDetectedCount ?? 0) > 0;
  const milestoneCapturePassed = missionState.isCaptured ?? false;
  const milestoneDisposalPassed = missionState.disposalOutcome?.success ?? false;

  let calculatedCompletionPct = 0;
  if (milestoneAssemblyPassed) calculatedCompletionPct += 20;
  if (milestoneLaunchPassed) calculatedCompletionPct += 20;
  if (milestoneAtmospherePassed) calculatedCompletionPct += 20;
  if (milestoneDetectionPassed) calculatedCompletionPct += 10;
  if (milestoneCapturePassed) calculatedCompletionPct += 15;
  if (milestoneDisposalPassed) calculatedCompletionPct += 15;

  const isComplete = calculatedCompletionPct === 100;

  // Real Score computation
  const fuelConsumedKg = Math.max(10, design.fuelMassKg - missionState.fuelRemainingKg);
  const fuelEfficiency = Math.max(0, 100 - (fuelConsumedKg / design.fuelMassKg) * 70);
  const powerEfficiency = specs.netPowerMarginW >= 0 ? 100 : 60;
  const captureAttemptsPenalty = Math.max(0, (missionState.failedCaptureAttempts || 0) * 12);
  const safetyScore = Math.max(40, 100 - captureAttemptsPenalty);
  const costScore = specs.estimatedTotalCostM <= target.rewardBudgetM ? 100 : 70;

  const baseScore = Math.round(
    (fuelEfficiency * 0.25) +
    (powerEfficiency * 0.20) +
    (safetyScore * 0.35) +
    (costScore * 0.20)
  );

  const overallScore = Math.min(100, Math.round(baseScore * (calculatedCompletionPct / 100)));

  let rankTitle = isMn ? 'ЕРӨНХИЙ ИНЖЕНЕР' : 'CHIEF AEROSPACE ENGINEER';
  let rankBadgeColor = 'text-amber-400 border-amber-400 bg-amber-400/10';
  if (!isComplete || overallScore < 60) {
    rankTitle = isMn ? 'САНСРЫН КАДЕТ (БҮРЭН БУС)' : 'SPACE CADET (INCOMPLETE)';
    rankBadgeColor = 'text-rose-400 border-rose-400 bg-rose-400/10';
  } else if (overallScore < 75) {
    rankTitle = isMn ? 'ТУСЛАХ ИНЖЕНЕР' : 'JUNIOR FLIGHT ENGINEER';
    rankBadgeColor = 'text-slate-300 border-slate-400 bg-slate-800/40';
  } else if (overallScore < 88) {
    rankTitle = isMn ? 'САНСРЫН ИНЖЕНЕР' : 'SPACE SYSTEMS ENGINEER';
    rankBadgeColor = 'text-sky-400 border-sky-400 bg-sky-400/10';
  } else {
    rankTitle = isMn ? 'ЕРӨНХИЙ ИНЖЕНЕР' : 'CHIEF AEROSPACE ENGINEER';
    rankBadgeColor = 'text-emerald-400 border-emerald-400 bg-emerald-400/10';
  }

  // Format flight duration
  const elapsedSeconds = missionState.missionElapsedTimeSeconds || 342;
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const formattedDuration = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  const nowFormatted = new Date().toLocaleString();

  // Save Debrief Report to LocalStorage
  useEffect(() => {
    if (isComplete) {
      sound.playLockChime();
      try {
        confetti({
          particleCount: 120,
          spread: 90,
          origin: { y: 0.5 },
          colors: ['#38bdf8', '#34d399', '#f59e0b', '#a855f7'],
        });
      } catch {}
    }

    // Save to flight history
    try {
      const stored = localStorage.getItem('quasar_flight_reports');
      const historyList: FlightDebriefReport[] = stored ? JSON.parse(stored) : [];

      const currentReport: FlightDebriefReport = {
        id: `flt-${Date.now()}`,
        playerName: callsign,
        timestamp: nowFormatted,
        missionName: isMn ? target.nameMn : target.name,
        missionCode: target.code,
        totalTimeFormatted: formattedDuration,
        assemblyStatus: milestoneAssemblyPassed ? 'success' : 'not_attempted',
        assemblyDetails: `TWR ${rocketSpecs.twrSeaLevel}, Δv ${rocketSpecs.deltaVMs} m/s`,
        launchStatus: milestoneLaunchPassed ? 'success' : 'not_attempted',
        atmosphericExitStatus: milestoneAtmospherePassed ? 'success' : 'not_attempted',
        radarDetectedCount: missionState.radarDetectedCount ?? null,
        capturedCount: missionState.capturedCount || 0,
        failedCaptureAttempts: missionState.failedCaptureAttempts || 0,
        disposalStatus: milestoneDisposalPassed ? 'success' : 'not_attempted',
        disposalDetails: missionState.disposalOutcome ? missionState.disposalOutcome.impactZone : undefined,
        completionPct: calculatedCompletionPct,
        isComplete,
        score: overallScore,
        rankTitle,
      };

      // Add to head, keep last 20
      const updated = [currentReport, ...historyList.filter(h => h.id !== currentReport.id)].slice(0, 20);
      localStorage.setItem('quasar_flight_reports', JSON.stringify(updated));
      setFlightHistory(updated);
    } catch (e) {
      console.warn('Failed to save flight history', e);
    }
  }, []);

  const handleSaveCallsign = (newSign: string) => {
    setCallsign(newSign);
    localStorage.setItem('quasar_callsign', newSign);
    setIsEditingCallsign(false);
    sound.playClick();
  };

  // Print debrief report
  const handlePrintReport = () => {
    sound.playClick();
    window.print();
  };

  // 3D NASA Earth Background
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

    const sun = new THREE.DirectionalLight(0xffedd5, 2.8);
    sun.position.set(16, 12, 20);
    scene.add(sun);

    const hemi = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.2);
    scene.add(hemi);

    const earthRadius = 14.0;
    const earthBundle = createNasaEarthMesh(earthRadius, isSoftwareGl);
    earthBundle.setSunDirection(sun.position.clone().normalize());
    earthBundle.group.position.set(0, 0, 0);
    scene.add(earthBundle.group);

    const spaceEnv = createNasaSpaceEnvironment(isSoftwareGl);
    scene.add(spaceEnv.group);

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 500);
    camera.position.set(0, 6, 38);
    camera.lookAt(0, 0, 0);

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
    controls.minDistance = 18;
    controls.maxDistance = 80;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;

    let frameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      earthBundle.update(delta);
      spaceEnv.update(delta);
      controls.update();
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
      earthBundle.dispose();
      spaceEnv.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full min-h-[calc(100vh-48px)] mt-12 bg-slate-950 overflow-y-auto select-none pb-20">
      {/* 3D WebGL Canvas for 3D Earth in background */}
      <div ref={canvasMountRef} className="fixed inset-0 w-full h-full pointer-events-auto cursor-grab active:cursor-grabbing opacity-75 print:hidden" />

      {/* Main Report Container */}
      <div className="relative z-20 max-w-4xl mx-auto px-3 sm:px-6 pt-4 space-y-4 pointer-events-auto">
        {/* Top Action Toolbar (Print / History / Call-sign) */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-2xl bg-slate-950/90 border border-sky-500/30 backdrop-blur-md font-mono text-xs shadow-xl print:hidden">
          <div className="flex items-center gap-2">
            <MongolianFlag className="w-8 h-4 shadow-sm" />
            <span className="text-slate-400">{isMn ? 'Нисгэгчийн код:' : 'Call-Sign:'}</span>
            {isEditingCallsign ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  defaultValue={callsign}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveCallsign((e.target as HTMLInputElement).value);
                  }}
                  onBlur={e => handleSaveCallsign(e.target.value)}
                  autoFocus
                  className="bg-slate-900 border border-sky-400 rounded px-2 py-0.5 text-xs text-white font-bold font-mono focus:outline-none"
                />
              </div>
            ) : (
              <button
                onClick={() => setIsEditingCallsign(true)}
                className="text-sky-300 font-bold hover:underline flex items-center gap-1"
                title={isMn ? 'Нисгэгчийн нэр засах' : 'Edit Call-Sign'}
              >
                <span>{callsign}</span>
                <User className="w-3 h-3 text-slate-400" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                sound.playClick();
                setShowHistoryModal(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <History className="w-3.5 h-3.5 text-sky-400" />
              <span>{isMn ? 'Нислэгийн түүх' : 'Flight Logs'}</span>
            </button>

            <button
              onClick={handlePrintReport}
              className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold flex items-center gap-1.5 transition-colors shadow-[0_0_12px_rgba(56,189,248,0.35)]"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isMn ? 'Тайлан хэвлэх' : 'Print / Export'}</span>
            </button>
          </div>
        </div>

        {/* PRIMARY DEBRIEF REPORT CARD */}
        <div id="flight-debrief-print-area" className="aerospace-panel p-5 sm:p-7 rounded-2xl border-sky-500/40 bg-slate-950/95 shadow-2xl backdrop-blur-md space-y-5 print:border-none print:shadow-none print:bg-white print:text-black">
          {/* Header & Badges */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sky-500/20 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <MongolianFlag className="w-7 h-3.5" />
                <span className="text-[10px] font-mono font-bold text-sky-400 tracking-widest uppercase">
                  QUASAR ORBITAL GUARDIAN // FLIGHT DEBRIEF REPORT
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white font-mono tracking-wide">
                {isMn ? 'НИСЛЭГИЙН ДҮГНЭЛТ БА ТЕХНИКИЙН ТАЙЛАН' : 'MISSION FLIGHT DEBRIEF REPORT'}
              </h1>
              <p className="text-xs text-slate-400 font-mono">
                {target.code} • {isMn ? target.nameMn : target.name}
              </p>
            </div>

            {/* Score & Rank Badge */}
            <div className="flex items-center gap-3 font-mono">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">{isMn ? 'ОНОО' : 'SCORE'}</span>
                <span className={`text-3xl font-black ${isComplete ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {overallScore}/100
                </span>
              </div>
              <div className={`px-3 py-2 rounded-xl border text-center ${rankBadgeColor}`}>
                <Award className="w-5 h-5 mx-auto mb-0.5" />
                <span className="text-[10px] font-bold block">{rankTitle}</span>
              </div>
            </div>
          </div>

          {/* Completion Status Alert Banner */}
          {isComplete ? (
            <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/50 flex items-center justify-between gap-3 text-xs font-mono text-emerald-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="font-bold">
                  {isMn
                    ? 'ДААЛГАВАР 100% БҮРЭН БИЕЛСЭН: Сансрын хог хаягдлыг илрүүлж, барьж, агаар мандалд бүрэн устгалаа.'
                    : 'MISSION 100% COMPLETED: Orbital debris detected, captured, and neutralized into Point Nemo.'}
                </span>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200 shrink-0">
                100% SUCCESS
              </span>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/60 flex items-center justify-between gap-3 text-xs font-mono text-rose-200">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 animate-pulse" />
                <div>
                  <span className="font-bold block text-rose-300">
                    {isMn ? '⚠️ ДААЛГАВАР БҮРЭН БУС (INCOMPLETE MISSION)' : '⚠️ MISSION INCOMPLETE'}
                  </span>
                  <span className="text-[11px] text-rose-300/80">
                    {isMn
                      ? 'Зарим үе шатыг гүйцэтгээгүй эсвэл алгассан тул нислэг бүрэн биш төлөвтэй бүртгэгдэв.'
                      : 'Certain flight phases were skipped or unachieved. Incomplete debrief recorded.'}
                  </span>
                </div>
              </div>
              <span className="text-sm font-black px-2.5 py-1 rounded bg-rose-500/25 text-rose-300 border border-rose-500/50 shrink-0">
                {calculatedCompletionPct}%
              </span>
            </div>
          )}

          {/* Mission Meta Info Bar (Pilot, Date, Elapsed Time) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-900/80 border border-slate-800 font-mono text-xs">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-sky-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block">{isMn ? 'Нислэгийн командлагч:' : 'Commander:'}</span>
                <span className="font-bold text-white">{callsign}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block">{isMn ? 'Огноо ба цаг:' : 'Timestamp:'}</span>
                <span className="font-bold text-slate-200">{nowFormatted}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block">{isMn ? 'Нийт ниссэн хугацаа:' : 'Mission Duration:'}</span>
                <span className="font-bold text-emerald-400">{formattedDuration}</span>
              </div>
            </div>
          </div>

          {/* TRUTHFUL FLIGHT MILESTONE TELEMETRY TABLE */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono border-b border-slate-800 pb-1.5">
              <span className="font-bold text-white flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-sky-400" />
                {isMn ? 'ҮЕ ШАТ БҮРИЙН БОДИТ БИЕЛЭЛТ БА ТЕЛЕМЕТР' : 'STAGE-BY-STAGE REAL TELEMETRY AUDIT'}
              </span>
              <span className="text-[11px] text-slate-400">
                {calculatedCompletionPct}% {isMn ? 'биелсэн' : 'achieved'}
              </span>
            </div>

            {/* Telemetry items */}
            <div className="space-y-2 text-xs font-mono">
              {/* 1. Rocket Assembly */}
              <div className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 ${
                milestoneAssemblyPassed ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-900/30 border-slate-800/60'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                    milestoneAssemblyPassed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'
                  }`}>
                    01
                  </div>
                  <div>
                    <span className="font-bold text-white block">
                      {isMn ? 'Пуужингийн угсралт ба Инженерчлэл' : 'Rocket Assembly & Staging'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      TWR {rocketSpecs.twrSeaLevel} • Δv {rocketSpecs.deltaVMs.toLocaleString()} m/s • Max LEO {rocketSpecs.maxPayloadToLeoKg.toLocaleString()} kg
                    </span>
                  </div>
                </div>

                <div className="text-right sm:self-center">
                  <span className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                    milestoneAssemblyPassed ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {milestoneAssemblyPassed ? (isMn ? '✓ Амжилттай тэнцсэн' : '✓ Feasible Passed') : (isMn ? 'Мэдээлэл байхгүй' : 'No Data')}
                  </span>
                </div>
              </div>

              {/* 2. Rocket Launch */}
              <div className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 ${
                milestoneLaunchPassed ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-900/30 border-slate-800/60'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                    milestoneLaunchPassed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'
                  }`}>
                    02
                  </div>
                  <div>
                    <span className="font-bold text-white block">
                      {isMn ? 'Газраас хөөрөх ажиллагаа (Launch Pad & Staging)' : 'Ground Launch & Staging'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {isMn ? 'Хөөргөх тавцангаас хөндийрсөн, Max-Q даралт, 1-р шат салгалт' : 'Pad liftoff, Max-Q passed, booster separation'}
                    </span>
                  </div>
                </div>

                <div className="text-right sm:self-center">
                  <span className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                    milestoneLaunchPassed ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {milestoneLaunchPassed ? (isMn ? '✓ Амжилттай' : '✓ Success') : (isMn ? 'Мэдээлэл байхгүй' : 'No Data')}
                  </span>
                </div>
              </div>

              {/* 3. Atmospheric Exit */}
              <div className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 ${
                milestoneAtmospherePassed ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-900/30 border-slate-800/60'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                    milestoneAtmospherePassed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'
                  }`}>
                    03
                  </div>
                  <div>
                    <span className="font-bold text-white block">
                      {isMn ? 'Агаар мандлаас гарах (> 100 км Карманы шугам)' : 'Atmospheric Exit (> 100 km Karman line)'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {milestoneAtmospherePassed ? `${isMn ? 'Өндөр:' : 'Altitude:'} 520 km • ${isMn ? 'Хурд:' : 'Speed:'} 7.74 km/s` : (isMn ? 'Агаар мандлаас гарсан бүртгэл байхгүй' : 'Orbit not verified')}
                    </span>
                  </div>
                </div>

                <div className="text-right sm:self-center">
                  <span className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                    milestoneAtmospherePassed ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {milestoneAtmospherePassed ? (isMn ? '✓ Амжилттай' : '✓ Orbit Reached') : (isMn ? 'Мэдээлэл байхгүй' : 'No Data')}
                  </span>
                </div>
              </div>

              {/* 4. Radar Detection */}
              <div className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 ${
                milestoneDetectionPassed ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-900/30 border-slate-800/60'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                    milestoneDetectionPassed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'
                  }`}>
                    04
                  </div>
                  <div>
                    <span className="font-bold text-white block">
                      {isMn ? 'Радар ба LiDAR илрүүлэлт' : 'Multi-Spectral Radar Detection'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {missionState.radarDetectedCount != null
                        ? `${missionState.radarDetectedCount} ${isMn ? 'объект сканнердаж цоожилсон' : 'objects scanned & tracked'}`
                        : (isMn ? 'Радар ажиллагаа алгассан' : 'Detection bypassed')}
                    </span>
                  </div>
                </div>

                <div className="text-right sm:self-center">
                  <span className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                    milestoneDetectionPassed ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {milestoneDetectionPassed ? `${missionState.radarDetectedCount} ${isMn ? 'объект' : 'items'}` : (isMn ? 'Мэдээлэл байхгүй' : 'No Data')}
                  </span>
                </div>
              </div>

              {/* 5. Robotic Arm Capture */}
              <div className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 ${
                milestoneCapturePassed ? 'bg-emerald-950/20 border-emerald-500/40' : 'bg-slate-900/30 border-slate-800/60'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                    milestoneCapturePassed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'
                  }`}>
                    05
                  </div>
                  <div>
                    <span className="font-bold text-white block">
                      {isMn ? 'Робот гараар барьж авах (Capture & Berth)' : 'Robotic Arm Capture'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {milestoneCapturePassed
                        ? `${isMn ? 'Цуглуулсан:' : 'Captured:'} ${missionState.capturedCount || 1} ${isMn ? 'объект' : 'item'} (${target.massKg} kg) • ${isMn ? 'Алдаатай оролдлого:' : 'Failed attempts:'} ${missionState.failedCaptureAttempts || 0}`
                        : (isMn ? 'Хог барих ажиллагаа хийгдээгүй' : 'No capture logged')}
                    </span>
                  </div>
                </div>

                <div className="text-right sm:self-center">
                  <span className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                    milestoneCapturePassed ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {milestoneCapturePassed
                      ? `${missionState.capturedCount || 1} ${isMn ? 'барьсан' : 'captured'}`
                      : (isMn ? 'Мэдээлэл байхгүй' : 'No Data')}
                  </span>
                </div>
              </div>

              {/* 6. Safe Deorbit Disposal */}
              <div className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 ${
                milestoneDisposalPassed ? 'bg-emerald-950/20 border-emerald-500/40' : 'bg-slate-900/30 border-slate-800/60'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                    milestoneDisposalPassed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'
                  }`}>
                    06
                  </div>
                  <div>
                    <span className="font-bold text-white block">
                      {isMn ? 'Агаар мандалд шатаан буулгах (Point Nemo Re-entry)' : 'Controlled Atmospheric Disposal'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {milestoneDisposalPassed
                        ? `${missionState.disposalOutcome?.impactZone} • Δv -${missionState.disposalOutcome?.burnDeltaV} m/s`
                        : (isMn ? 'Буулгах ажиллагаа хийгдээгүй' : 'Disposal unexecuted')}
                    </span>
                  </div>
                </div>

                <div className="text-right sm:self-center">
                  <span className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                    milestoneDisposalPassed ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {milestoneDisposalPassed ? (isMn ? '✓ Немо цэгт унасан' : '✓ Point Nemo Impact') : (isMn ? 'Мэдээлэл байхгүй' : 'No Data')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800 print:hidden">
            <button
              onClick={() => {
                sound.playClick();
                if (onReplayMission) {
                  onReplayMission();
                } else {
                  onRedesignSpacecraft();
                }
              }}
              className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-mono font-bold text-xs flex items-center justify-center gap-2 min-h-[48px] active:scale-95 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{isMn ? 'ДАХИН ТОГЛОХ' : 'REPLAY MISSION'}</span>
            </button>

            <button
              onClick={() => {
                sound.playLockChime();
                onSelectNewMission();
              }}
              className="w-full sm:w-auto px-8 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black font-mono text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(56,189,248,0.45)] active:scale-95 transition-all min-h-[48px]"
            >
              <span>{isMn ? 'ДАРААГИЙН ДААЛГАВАР' : 'NEXT MISSION'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Flight History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-2xl bg-slate-950 border border-sky-500/40 rounded-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto font-mono text-xs shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <History className="w-4 h-4 text-sky-400" />
                <span>{isMn ? 'ХАДГАЛАГДСАН НИСЛЭГИЙН ТҮҮХ' : 'STORED FLIGHT LOG HISTORY'}</span>
              </h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {flightHistory.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                {isMn ? 'Нислэгийн түүх хараахан бүртгэгдээгүй байна.' : 'No flight history recorded yet.'}
              </div>
            ) : (
              <div className="space-y-2">
                {flightHistory.map((log, idx) => (
                  <div
                    key={log.id || idx}
                    className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          log.isComplete ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                        }`}>
                          {log.completionPct}% {log.isComplete ? 'DONE' : 'INCOMPLETE'}
                        </span>
                        <span className="font-bold text-white text-xs">{log.missionName}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {log.playerName} • {log.timestamp} • {log.totalTimeFormatted}
                      </div>
                    </div>

                    <div className="text-right sm:self-center">
                      <span className="text-base font-black text-emerald-400 block">{log.score}/100</span>
                      <span className="text-[9px] text-slate-400">{log.rankTitle}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="text-right pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold"
              >
                {isMn ? 'Хаах' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
