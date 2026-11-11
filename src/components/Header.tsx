/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GameStage, Language, MissionState } from '../types';
import { sound } from '../utils/audio';
import { TRANSLATIONS } from '../utils/translations';
import { MongolianFlag } from './MongolianFlag';
import { 
  Rocket, 
  Orbit, 
  Radar, 
  Crosshair, 
  Wrench, 
  Award, 
  Flame, 
  HelpCircle, 
  Volume2, 
  VolumeX, 
  RotateCcw,
  ShieldCheck,
  Globe,
  Home,
  CheckCircle2,
  Lock,
  ChevronDown,
  ChevronUp,
  Settings,
  X,
  FileText,
  Sliders,
  Sparkles,
  Layers
} from 'lucide-react';

interface HeaderProps {
  currentStage: GameStage;
  language: Language;
  onSetLanguage: (lang: Language) => void;
  onSelectStage: (stage: GameStage) => void;
  onOpenAcademy: () => void;
  onResetMission: () => void;
  budgetM: number;
  missionState: MissionState;
  missionProgressPct: number;
  graphicsQuality: 'high' | 'medium' | 'low';
  onSetGraphicsQuality: (quality: 'high' | 'medium' | 'low') => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentStage,
  language,
  onSetLanguage,
  onSelectStage,
  onOpenAcademy,
  onResetMission,
  budgetM,
  missionState,
  missionProgressPct,
  graphicsQuality,
  onSetGraphicsQuality,
}) => {
  const [muted, setMuted] = useState(sound.getMuted());
  const [showProgressDrawer, setShowProgressDrawer] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showMissionDrawer, setShowMissionDrawer] = useState(false);
  const [showSpecsDrawer, setShowSpecsDrawer] = useState(false);

  const t = TRANSLATIONS[language];
  const isMn = language === 'mn';

  const handleToggleSound = () => {
    const isMuted = sound.toggleMute();
    setMuted(isMuted);
    if (!isMuted) sound.playClick(900);
  };

  // 6 user-defined core milestones with exact percentages
  const MILESTONES = [
    {
      id: 'assembly',
      nameMn: 'Пуужин угсрах',
      nameEn: 'Rocket Assembly',
      pct: 20,
      cumulative: 20,
      stage: 'rocket_lab' as GameStage,
      isDone: missionProgressPct >= 20,
      isCurrent: currentStage === 'rocket_lab' || currentStage === 'design_lab',
    },
    {
      id: 'launch',
      nameMn: 'Пуужин хөөргөх',
      nameEn: 'Rocket Launch',
      pct: 20,
      cumulative: 40,
      stage: 'launch_config' as GameStage,
      isDone: missionProgressPct >= 40,
      isCurrent: currentStage === 'launch_config' && missionProgressPct < 60,
    },
    {
      id: 'atmosphere_exit',
      nameMn: 'Агаар мандлаас гарах',
      nameEn: 'Atmospheric Exit',
      pct: 20,
      cumulative: 60,
      stage: 'launch_config' as GameStage,
      isDone: missionProgressPct >= 60,
      isCurrent: currentStage === 'launch_config' && missionProgressPct >= 40 && missionProgressPct < 60,
    },
    {
      id: 'detection',
      nameMn: 'Хог илрүүлэх',
      nameEn: 'Debris Detection',
      pct: 10,
      cumulative: 70,
      stage: 'target_detection' as GameStage,
      isDone: missionProgressPct >= 70,
      isCurrent: currentStage === 'target_detection',
    },
    {
      id: 'capture',
      nameMn: 'Хог барьж авах',
      nameEn: 'Debris Capture',
      pct: 15,
      cumulative: 85,
      stage: 'debris_capture' as GameStage,
      isDone: missionProgressPct >= 85,
      isCurrent: currentStage === 'approach_sync' || currentStage === 'debris_capture',
    },
    {
      id: 'disposal',
      nameMn: 'Аюулгүй буулгах',
      nameEn: 'Safe Disposal',
      pct: 15,
      cumulative: 100,
      stage: 'deorbit_disposal' as GameStage,
      isDone: missionProgressPct >= 100,
      isCurrent: currentStage === 'deorbit_disposal',
    },
  ];

  // Current milestone label
  const currentMilestone = MILESTONES.find(m => m.isCurrent) || 
    (missionProgressPct >= 100 ? { nameMn: 'Даалгавар биелэв', nameEn: 'Mission Complete' } : MILESTONES[0]);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 bg-slate-950/95 border-b border-sky-500/25 px-2.5 sm:px-4 py-2 select-none shadow-lg backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          {/* ZONE 1: BRAND & MONGOLIAN INSIGNIA */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                sound.playClick();
                onSelectStage('main_menu');
              }}
              className="flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all min-h-[44px]"
              title={isMn ? 'Үндсэн цэс рүү буцах' : 'Return to Main Menu'}
            >
              <MongolianFlag className="w-7 h-3.5 shrink-0" />
              <div className="text-left">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="font-bold text-white text-sm sm:text-base tracking-wider font-mono">QUASAR</span>
                  <span className="text-[10px] text-sky-400 font-mono font-medium tracking-widest hidden md:inline">
                    {isMn ? 'ОРБИТАЛ' : 'GUARDIAN'}
                  </span>
                </div>
              </div>
            </button>

            {/* Captured debris counter badge */}
            {missionState.capturedCount > 0 && (
              <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{isMn ? 'Устгасан хог:' : 'Debris Cleared:'} {missionState.capturedCount}</span>
              </div>
            )}
          </div>

          {/* ZONE 2: MISSION PROGRESS BAR (FOCUSED & MINIMAL) */}
          <div className="flex-1 max-w-md mx-auto">
            <button
              onClick={() => {
                sound.playClick();
                setShowProgressDrawer(!showProgressDrawer);
              }}
              className="w-full text-left p-1 rounded-lg hover:bg-slate-900/60 transition-colors group cursor-pointer"
            >
              <div className="flex items-center justify-between text-xs font-mono mb-1">
                <span className="font-bold text-white text-[11px] sm:text-xs tracking-wider flex items-center gap-1.5">
                  <span className="text-sky-400">MISSION PROGRESS</span>
                  <span className="text-slate-400">—</span>
                  <span className="text-emerald-400 font-extrabold">{missionProgressPct}%</span>
                </span>
                <span className="text-[11px] text-slate-300 truncate max-w-[140px] sm:max-w-[200px] text-right group-hover:text-sky-300 transition-colors">
                  {isMn ? currentMilestone.nameMn : currentMilestone.nameEn}
                </span>
              </div>
              {/* Actual Progress Bar */}
              <div className="w-full bg-slate-900 border border-slate-800 rounded-full h-2 overflow-hidden shadow-inner">
                <div 
                  className="bg-gradient-to-r from-sky-500 via-sky-400 to-emerald-400 h-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(56,189,248,0.5)]"
                  style={{ width: `${Math.max(2, missionProgressPct)}%` }}
                />
              </div>
            </button>
          </div>

          {/* ZONE 3: COLLAPSIBLE DRAWERS & SETTINGS CONTROLS */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Mission Briefing Drawer Toggle */}
            <button
              onClick={() => {
                sound.playClick();
                setShowMissionDrawer(true);
              }}
              className="min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-sky-300 border border-slate-800 hover:border-sky-500/40 text-xs font-mono flex items-center justify-center gap-1.5 transition-colors"
              title={isMn ? 'Даалгаврын мэдээлэл' : 'Mission Briefing'}
            >
              <FileText className="w-4 h-4 text-sky-400" />
              <span className="hidden lg:inline text-[11px]">{isMn ? 'Даалгавар' : 'Briefing'}</span>
            </button>

            {/* Spacecraft / Rocket Specs Drawer Toggle */}
            <button
              onClick={() => {
                sound.playClick();
                setShowSpecsDrawer(true);
              }}
              className="min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-sky-500/40 text-xs font-mono flex items-center justify-center gap-1.5 transition-colors"
              title={isMn ? 'Хөлөг & Пуужингийн үзүүлэлт' : 'Vehicle Specifications'}
            >
              <Rocket className="w-4 h-4 text-amber-400" />
              <span className="hidden lg:inline text-[11px]">{isMn ? 'Хөлөг' : 'Specs'}</span>
            </button>

            {/* Settings Modal Toggle */}
            <button
              onClick={() => {
                sound.playClick();
                setShowSettingsModal(true);
              }}
              className="min-h-[44px] min-w-[44px] p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-sky-500/40 flex items-center justify-center transition-colors"
              title={isMn ? 'Тохиргоо (График, Дуу, Хэл)' : 'Settings'}
            >
              <Settings className="w-4 h-4 text-sky-400" />
            </button>

            {/* Sound Toggle Button */}
            <button
              onClick={handleToggleSound}
              className="min-h-[44px] min-w-[44px] p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 flex items-center justify-center transition-colors"
              title={muted ? t.common.soundOff : t.common.soundOn}
            >
              {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
          </div>
        </div>
      </header>

      {/* ================= 1. MISSION PROGRESS BREAKDOWN DRAWER ================= */}
      {showProgressDrawer && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-xl bg-slate-950 border border-sky-500/40 rounded-2xl shadow-2xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-sky-400" />
                <h3 className="text-base font-bold text-white font-mono">
                  {isMn ? 'ДААЛГАВРЫН АХИЦЫН ТАЙЛАН' : 'MISSION PROGRESS BREAKDOWN'}
                </h3>
              </div>
              <button
                onClick={() => setShowProgressDrawer(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {MILESTONES.map((m, idx) => {
                const isPassed = missionProgressPct >= m.cumulative;
                const isNow = m.isCurrent;
                return (
                  <div
                    key={m.id}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs font-mono transition-all ${
                      isPassed
                        ? 'bg-emerald-950/25 border-emerald-500/40 text-emerald-300'
                        : isNow
                        ? 'bg-sky-950/40 border-sky-400 text-white shadow-[0_0_12px_rgba(56,189,248,0.2)]'
                        : 'bg-slate-900/60 border-slate-800 text-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                        {isPassed ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : isNow ? (
                          <span className="w-4 h-4 rounded-full border-2 border-sky-400 animate-spin" />
                        ) : (
                          <Lock className="w-4 h-4 text-slate-600" />
                        )}
                      </div>
                      <div>
                        <span className="font-bold text-sm block">
                          {idx + 1}. {isMn ? m.nameMn : m.nameEn}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {isMn ? `Үе шат: +${m.pct}%` : `Stage value: +${m.pct}%`}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-sm">
                        {m.cumulative}%
                      </span>
                      {isPassed && (
                        <span className="text-[10px] text-emerald-400 block font-semibold">
                          {isMn ? 'АМЖИЛТТАЙ' : 'COMPLETED'}
                        </span>
                      )}
                      {isNow && !isPassed && (
                        <span className="text-[10px] text-sky-400 block font-semibold">
                          {isMn ? 'ЯВЦДАА БАЙНА' : 'IN PROGRESS'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex justify-between items-center text-xs font-mono text-slate-400 border-t border-slate-800">
              <span>{isMn ? 'Нийт дүн:' : 'Total Status:'} <strong>{missionProgressPct}% / 100%</strong></span>
              <button
                onClick={() => setShowProgressDrawer(false)}
                className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs"
              >
                {isMn ? 'Хаах' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 2. SETTINGS MODAL (GRAPHICS, SOUND, LANGUAGE) ================= */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-950 border border-sky-500/40 rounded-2xl shadow-2xl p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-sky-400" />
                <h3 className="text-base font-bold text-white font-mono">
                  {isMn ? 'ТОГЛООМЫН ТОХИРГОО' : 'GAME SETTINGS'}
                </h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Graphics Quality */}
            <div className="space-y-2">
              <label className="text-xs font-mono font-bold text-slate-300 block">
                {isMn ? '3D ГРАФИКИЙН ЧАНАР (FPS ОНОВЧЛОЛ):' : '3D GRAPHICS QUALITY:'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['low', 'medium', 'high'] as const).map(quality => (
                  <button
                    key={quality}
                    onClick={() => {
                      sound.playClick();
                      onSetGraphicsQuality(quality);
                    }}
                    className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-mono font-bold border transition-all ${
                      graphicsQuality === quality
                        ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.4)]'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {quality === 'high' ? (isMn ? 'Өндөр (High)' : 'High') :
                     quality === 'medium' ? (isMn ? 'Дунд (Med)' : 'Medium') :
                     (isMn ? 'Хөнгөн (Low)' : 'Low')}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                {isMn
                  ? 'Гар утсан дээр Low/Medium чанар сонгосноор цэнэг хэмнэж, жигд 60 FPS хангана.'
                  : 'Low/Medium quality reduces GPU load for smooth 60 FPS on mobile.'}
              </p>
            </div>

            {/* Language Selection */}
            <div className="space-y-2">
              <label className="text-xs font-mono font-bold text-slate-300 block">
                {isMn ? 'ТОГЛООМЫН ХЭЛ:' : 'LANGUAGE:'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    sound.playClick();
                    onSetLanguage('mn');
                  }}
                  className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-mono font-bold border flex items-center justify-center gap-2 ${
                    language === 'mn'
                      ? 'bg-sky-500 text-slate-950 border-sky-400'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  <span>🇲🇳 Монгол Хэл</span>
                </button>
                <button
                  onClick={() => {
                    sound.playClick();
                    onSetLanguage('en');
                  }}
                  className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-mono font-bold border flex items-center justify-center gap-2 ${
                    language === 'en'
                      ? 'bg-sky-500 text-slate-950 border-sky-400'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  <span>🇬🇧 English</span>
                </button>
              </div>
            </div>

            {/* Sound Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-200">
                {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                <span>{isMn ? 'Дууны эффект & хөдөлгүүрийн чимээ' : 'Sound Effects & Engine SFX'}</span>
              </div>
              <button
                onClick={handleToggleSound}
                className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-mono font-bold ${
                  muted ? 'bg-slate-800 text-slate-400' : 'bg-emerald-500 text-slate-950'
                }`}
              >
                {muted ? (isMn ? 'Хаасан' : 'Muted') : (isMn ? 'Асаалттай' : 'Active')}
              </button>
            </div>

            {/* Space Academy & Reset */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  onOpenAcademy();
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-sky-400 border border-sky-500/30 text-xs font-mono font-bold flex items-center gap-1.5"
              >
                <HelpCircle className="w-4 h-4" />
                <span>{isMn ? 'Сансрын Академи' : 'Space Academy'}</span>
              </button>

              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  onResetMission();
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-800 text-xs font-mono font-bold flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{isMn ? 'Даалгаврыг шинэчлэх' : 'Reset'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 3. MISSION BRIEFING DRAWER ================= */}
      {showMissionDrawer && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-slate-950 border border-sky-500/40 rounded-2xl shadow-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-sky-400" />
                <h3 className="text-base font-bold text-white font-mono">
                  {isMn ? 'ДААЛГАВРЫН ДЭЛГЭРЭНГҮЙ МЭДЭЭЛЭЛ' : 'MISSION BRIEFING'}
                </h3>
              </div>
              <button
                onClick={() => setShowMissionDrawer(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-sky-400 font-bold">{missionState.selectedMission.code}</span>
                <span className="text-emerald-400 font-bold">${missionState.selectedMission.rewardBudgetM}M Урамшуулал</span>
              </div>
              <h4 className="text-sm font-bold text-white">
                {isMn ? missionState.selectedMission.nameMn : missionState.selectedMission.name}
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isMn ? missionState.selectedMission.storyMn : missionState.selectedMission.storyEn}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">{isMn ? 'ТОЙРОГ ЗАМЫН ӨНДӨР' : 'ALTITUDE'}</span>
                <strong className="text-white text-sm">{missionState.selectedMission.altitudeKm} km</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">{isMn ? 'ХОГИЙН МАСС' : 'OBJECT MASS'}</span>
                <strong className="text-white text-sm">{missionState.selectedMission.massKg.toLocaleString()} kg</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">{isMn ? 'ЭРГЭЛТИЙН ХУРД' : 'TUMBLE RATE'}</span>
                <strong className="text-amber-400 text-sm">{missionState.selectedMission.tumbleRateDegS}°/s</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">{isMn ? 'АЮУЛЫН ЗЭРЭГ' : 'HAZARD SCORE'}</span>
                <strong className="text-rose-400 text-sm">{missionState.selectedMission.hazardScore} / 100</strong>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-sky-950/20 border border-sky-500/30 text-xs font-mono text-sky-200">
              <strong>{isMn ? 'Үндсэн Зорилт: ' : 'Objective: '}</strong>
              {isMn ? missionState.selectedMission.objectiveMn : missionState.selectedMission.objectiveEn}
            </div>

            <div className="text-right pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowMissionDrawer(false)}
                className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs"
              >
                {isMn ? 'Ойлголоо' : 'Understood'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 4. SPACECRAFT & ROCKET SPECS DRAWER ================= */}
      {showSpecsDrawer && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-slate-950 border border-sky-500/40 rounded-2xl shadow-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white font-mono">
                  {isMn ? 'ХӨЛӨГ БОЛОН ПУУЖИНГИЙН ҮЗҮҮЛЭЛТ' : 'VEHICLE SPECIFICATIONS'}
                </h3>
              </div>
              <button
                onClick={() => setShowSpecsDrawer(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Rocket Specs */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <h4 className="text-xs font-bold text-sky-400 font-mono flex items-center gap-1.5">
                <Rocket className="w-4 h-4" />
                {isMn ? 'УГСАРСАН ПУУЖИН:' : 'ROCKET CONFIGURATION:'} {missionState.rocketConfig.name}
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div>{isMn ? 'Хөдөлгүүр:' : 'Engine:'} <strong className="text-white">{isMn ? missionState.rocketConfig.engine.nameMn : missionState.rocketConfig.engine.name}</strong></div>
                <div>TWR: <strong className="text-emerald-400">{missionState.rocketSpecs.twrSeaLevel}</strong></div>
                <div>{isMn ? 'Нийт масс:' : 'Wet Mass:'} <strong className="text-white">{missionState.rocketSpecs.totalWetMassKg.toLocaleString()} kg</strong></div>
                <div>Δv: <strong className="text-sky-300">{missionState.rocketSpecs.deltaVMs.toLocaleString()} m/s</strong></div>
                <div>{isMn ? 'Түлхэгч:' : 'Boosters:'} <strong className="text-white">{missionState.rocketConfig.boosterCount}x</strong></div>
                <div>{isMn ? 'Нөхцөл:' : 'Status:'} <strong className="text-emerald-400">{isMn ? 'Хөөрөхөд бэлэн' : 'Ready'}</strong></div>
              </div>
            </div>

            {/* Spacecraft Specs */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <h4 className="text-xs font-bold text-amber-400 font-mono flex items-center gap-1.5">
                <Wrench className="w-4 h-4" />
                {isMn ? 'ЦУГЛУУЛАГЧ ХӨЛӨГ:' : 'SPACECRAFT DESIGN:'} {missionState.design.name}
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div>{isMn ? 'Их бие:' : 'Bus:'} <strong className="text-white">{isMn ? missionState.design.bus.nameMn : missionState.design.bus.name}</strong></div>
                <div>{isMn ? 'Баригч:' : 'Capture:'} <strong className="text-sky-300">{isMn ? missionState.design.captureMechanism.nameMn : missionState.design.captureMechanism.name}</strong></div>
                <div>{isMn ? 'Түлш:' : 'Fuel:'} <strong className="text-amber-300">{missionState.fuelRemainingKg} / {missionState.design.fuelMassKg} kg</strong></div>
                <div>{isMn ? 'Цахилгаан:' : 'Power:'} <strong className="text-white">{missionState.specs.powerGenerationW} W</strong></div>
                <div>{isMn ? 'Найдваржилт:' : 'Reliability:'} <strong className="text-emerald-400">{missionState.specs.overallReliability}%</strong></div>
                <div>{isMn ? 'Тооцоот зардал:' : 'Est. Cost:'} <strong className="text-white">${missionState.specs.estimatedTotalCostM}M</strong></div>
              </div>
            </div>

            <div className="text-right pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowSpecsDrawer(false)}
                className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs"
              >
                {isMn ? 'Хаах' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
