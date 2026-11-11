/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MissionState, MissionTarget, Language } from '../types';
import { MISSIONS } from '../simulation/data';
import { buildDebrisModel } from '../three/debrisBuilder';
import { createNasaSpaceEnvironment, createNasaEarthMesh } from '../three/proceduralEarth';
import { sound } from '../utils/audio';
import { TRANSLATIONS } from '../utils/translations';
import { 
  Radar, 
  Eye, 
  Compass, 
  Flame, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  RotateCw,
  Scan,
  Crosshair,
  Layers,
  ChevronDown,
  ChevronUp,
  Radio,
  Target
} from 'lucide-react';

interface StageDetectionProps {
  language?: Language;
  missionState: MissionState;
  onProceedToApproach: () => void;
  onSelectTarget?: (target: MissionTarget) => void;
  onUpdateState?: (partial: Partial<MissionState>) => void;
}

type DebrisCategoryKey = 'all' | 'defunct_sat' | 'rocket_body' | 'fragment' | 'solar_array';

interface DetectedRadarItem {
  id: string;
  name: string;
  nameMn: string;
  category: 'defunct_sat' | 'rocket_body' | 'fragment' | 'solar_array';
  categoryMn: string;
  categoryEn: string;
  altitudeKm: number;
  relativeDistKm: number;
  velocityKms: number;
  massKg: number;
  tumbleRateDegS: number;
  hazardScore: number;
  color: string;
  colorHex: number;
  azimuthDeg: number;
  missionRef?: MissionTarget;
}

export const StageDetection: React.FC<StageDetectionProps> = ({
  language = 'mn',
  missionState,
  onProceedToApproach,
  onSelectTarget,
  onUpdateState,
}) => {
  const isMn = language === 'mn';
  const t = TRANSLATIONS[language];
  const canvasMountRef = useRef<HTMLDivElement>(null);

  const [activeCategory, setActiveCategory] = useState<DebrisCategoryKey>('all');
  const [selectedItem, setSelectedItem] = useState<DetectedRadarItem | null>(null);
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [sweepAngle, setSweepAngle] = useState(0);

  // Generate detected radar targets based on the 4 user-specified categories
  const [radarItems] = useState<DetectedRadarItem[]>(() => {
    return [
      {
        id: 'sat_kestrel_derelict',
        name: 'KESTREL-4 Scientific Satellite',
        nameMn: 'Кестрел-4 Шинжлэх Ухааны Дагуул',
        category: 'defunct_sat',
        categoryMn: 'Ашиглалтаас гарсан хиймэл дагуул',
        categoryEn: 'Defunct Satellite',
        altitudeKm: 520,
        relativeDistKm: 18.5,
        velocityKms: 7.61,
        massKg: 1250,
        tumbleRateDegS: 12.5,
        hazardScore: 78,
        color: '#f59e0b',
        colorHex: 0xf59e0b,
        azimuthDeg: 42,
        missionRef: MISSIONS[0],
      },
      {
        id: 'stage_zenit_upper',
        name: 'SL-16 Zenit Spent Upper Stage',
        nameMn: 'Зенит Пуужингийн Дээд Шат',
        category: 'rocket_body',
        categoryMn: 'Пуужингийн хуучин шат',
        categoryEn: 'Spent Rocket Stage',
        altitudeKm: 840,
        relativeDistKm: 34.2,
        velocityKms: 7.42,
        massKg: 8900,
        tumbleRateDegS: 5.2,
        hazardScore: 92,
        color: '#a855f7',
        colorHex: 0xa855f7,
        azimuthDeg: 128,
        missionRef: MISSIONS[2] || MISSIONS[0],
      },
      {
        id: 'frag_solar_wing_iridium',
        name: 'Iridium-33 Solar Panel Shard',
        nameMn: 'Иридиум-33 Нарны Хавтангийн Хэлтэрхий',
        category: 'solar_array',
        categoryMn: 'Нарны хавтангийн хэсэг',
        categoryEn: 'Solar Array Fragment',
        altitudeKm: 785,
        relativeDistKm: 12.1,
        velocityKms: 7.48,
        massKg: 42,
        tumbleRateDegS: 28.0,
        hazardScore: 84,
        color: '#06b6d4',
        colorHex: 0x06b6d4,
        azimuthDeg: 215,
        missionRef: MISSIONS[3] || MISSIONS[0],
      },
      {
        id: 'frag_cosmos_titanium',
        name: 'Cosmos-1408 Kinetic Fragment #48812',
        nameMn: 'Космос-1408 Титан Хэлтэрхий #48812',
        category: 'fragment',
        categoryMn: 'Металл хэлтэрхий',
        categoryEn: 'Metal Debris',
        altitudeKm: 480,
        relativeDistKm: 8.7,
        velocityKms: 7.64,
        massKg: 18,
        tumbleRateDegS: 45.0,
        hazardScore: 95,
        color: '#ef4444',
        colorHex: 0xef4444,
        azimuthDeg: 310,
        missionRef: MISSIONS[1] || MISSIONS[0],
      },
    ];
  });

  // Default selection to first item or current mission
  useEffect(() => {
    if (!selectedItem && radarItems.length > 0) {
      setSelectedItem(radarItems[0]);
    }
  }, [radarItems, selectedItem]);

  const debrisBundleRef = useRef<ReturnType<typeof buildDebrisModel> | null>(null);
  const sceneCameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Initialize Three.js Scene
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

    // Warm Sun Directional Light
    const sunLight = new THREE.DirectionalLight(0xffedd5, 3.0);
    sunLight.position.set(12, 16, 14);
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    fillLight.position.set(-10, -8, -10);
    scene.add(fillLight);

    // 1. High-Fidelity NASA Blue Marble Earth beneath
    const earthRadius = 60;
    const earthBundle = createNasaEarthMesh(earthRadius, isSoftwareGl);
    earthBundle.setSunDirection(sunLight.position.clone().normalize());
    earthBundle.group.position.set(0, -earthRadius - 6, -10);
    scene.add(earthBundle.group);

    // 2. NASA Deep Space Skybox & Stars
    const spaceEnv = createNasaSpaceEnvironment(isSoftwareGl);
    scene.add(spaceEnv.group);

    // 3. Debris 3D Model in focus
    const currentTarget = selectedItem?.missionRef || missionState.selectedMission;
    const bundle = buildDebrisModel(currentTarget);
    bundle.group.position.set(0, 0, 0);
    scene.add(bundle.group);
    debrisBundleRef.current = bundle;

    // 4. Radar Target Tracking Ring
    const reticleGeo = new THREE.RingGeometry(2.4, 2.5, 32);
    const reticleMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const reticle = new THREE.Mesh(reticleGeo, reticleMat);
    reticle.lookAt(0, 0, 1);
    scene.add(reticle);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 500);
    camera.position.set(0, 1.2, 5.8);
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
    controls.minDistance = 3;
    controls.maxDistance = 14;

    let frameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      bundle.update(delta * ((selectedItem?.tumbleRateDegS || 10) / 10));
      earthBundle.update(delta);
      spaceEnv.update(delta);

      reticle.rotation.z += delta * 0.4;
      setSweepAngle(prev => (prev + delta * 90) % 360);

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
      bundle.dispose();
      earthBundle.dispose();
      spaceEnv.dispose();
      reticleGeo.dispose();
      reticleMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [selectedItem]);

  const filteredItems = activeCategory === 'all' 
    ? radarItems 
    : radarItems.filter(i => i.category === activeCategory);

  const handleSelectItem = (item: DetectedRadarItem) => {
    sound.playClick(1100);
    setSelectedItem(item);
    if (item.missionRef && onSelectTarget) {
      onSelectTarget(item.missionRef);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-48px)] mt-12 bg-slate-950 overflow-hidden select-none">
      {/* 3D WebGL Canvas */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Left: Orbital Radar Scope Overlay */}
      <div className="absolute top-3 left-3 z-20 pointer-events-auto">
        <div className="aerospace-panel p-3 rounded-2xl border-sky-500/40 bg-slate-950/90 shadow-2xl backdrop-blur-md w-56 sm:w-64">
          <div className="flex items-center justify-between border-b border-sky-500/20 pb-1.5 mb-2">
            <div className="flex items-center gap-1.5">
              <Radar className="w-4 h-4 text-emerald-400 animate-spin" />
              <span className="text-xs font-mono font-bold text-white tracking-wider">
                {isMn ? 'ХӨЛГИЙН РАДАР' : 'PULSE RADAR'}
              </span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">RANGE: 50 KM</span>
          </div>

          {/* Circular Radar Scope Display */}
          <div className="relative w-48 h-48 sm:w-56 sm:h-56 mx-auto rounded-full border-2 border-emerald-500/40 bg-slate-950/80 overflow-hidden flex items-center justify-center shadow-[inset_0_0_20px_rgba(16,185,129,0.2)]">
            {/* Concentric distance rings */}
            <div className="absolute w-36 h-36 rounded-full border border-emerald-500/20 pointer-events-none" />
            <div className="absolute w-24 h-24 rounded-full border border-emerald-500/25 pointer-events-none" />
            <div className="absolute w-12 h-12 rounded-full border border-emerald-500/30 pointer-events-none" />

            {/* Crosshairs */}
            <div className="absolute inset-x-0 top-1/2 h-[1px] bg-emerald-500/25 pointer-events-none" />
            <div className="absolute inset-y-0 left-1/2 w-[1px] bg-emerald-500/25 pointer-events-none" />

            {/* Rotating Radar Sweep Beam */}
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                transform: `rotate(${sweepAngle}deg)`,
                background: 'conic-gradient(from 0deg, rgba(16,185,129,0.35) 0deg, rgba(16,185,129,0.0) 45deg, transparent 45deg)',
              }}
            />

            {/* Radar Blips for the 4 Categories */}
            {radarItems.map(item => {
              const isSelected = selectedItem?.id === item.id;
              const rad = (item.azimuthDeg * Math.PI) / 180;
              const distFactor = (item.relativeDistKm / 45) * 85;
              const x = Math.cos(rad) * distFactor;
              const y = Math.sin(rad) * distFactor;

              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectItem(item)}
                  style={{
                    transform: `translate(${x}px, ${y}px)`,
                    backgroundColor: item.color,
                  }}
                  className={`absolute w-3.5 h-3.5 rounded-full cursor-pointer transition-transform hover:scale-150 ${
                    isSelected ? 'ring-2 ring-white scale-125 shadow-[0_0_10px_#fff]' : 'opacity-85'
                  }`}
                  title={`${item.name} (${item.relativeDistKm} km)`}
                />
              );
            })}

            {/* Center Spacecraft Marker */}
            <div className="w-2.5 h-2.5 rounded-full bg-sky-400 border border-white z-10 shadow-[0_0_8px_#38bdf8]" />
          </div>

          <div className="mt-2 text-center text-[10px] font-mono text-slate-400">
            {isMn ? 'Цэгүүд дээр дарж зорилтыг сонгоно' : 'Tap blip to target object'}
          </div>
        </div>
      </div>

      {/* Top Right: Category Filters (User Req: 4 clear categories) */}
      <div className="absolute top-3 right-3 z-20 pointer-events-auto max-w-[95vw] overflow-x-auto scrollbar-none">
        <div className="aerospace-panel p-1.5 rounded-xl border-sky-500/30 flex items-center gap-1.5 bg-slate-950/95 shadow-xl text-xs font-mono">
          {[
            { id: 'all', labelMn: 'Бүгд', labelEn: 'All' },
            { id: 'defunct_sat', labelMn: 'Хиймэл дагуул', labelEn: 'Defunct Sat', color: 'text-amber-400' },
            { id: 'rocket_body', labelMn: 'Пуужингийн шат', labelEn: 'Rocket Body', color: 'text-purple-400' },
            { id: 'solar_array', labelMn: 'Нарны хавтан', labelEn: 'Solar Wing', color: 'text-cyan-400' },
            { id: 'fragment', labelMn: 'Хэлтэрхий', labelEn: 'Metal Shard', color: 'text-rose-400' },
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => {
                sound.playClick();
                setActiveCategory(cat.id as DebrisCategoryKey);
              }}
              className={`min-h-[36px] px-3 py-1 rounded-lg transition-all whitespace-nowrap font-bold text-xs ${
                activeCategory === cat.id
                  ? 'bg-sky-500 text-slate-950 shadow-[0_0_10px_rgba(56,189,248,0.4)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span className={cat.color}>{isMn ? cat.labelMn : cat.labelEn}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Center 3D Crosshair Reticle Overlay */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-56 h-56 sm:w-64 sm:h-64 border border-sky-400/30 rounded-full flex items-center justify-center">
          <div className="w-44 h-44 border border-sky-400/20 rounded-full" />
          <div className="w-2.5 h-2.5 rounded-full bg-sky-400/50" />
        </div>
      </div>

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
              <Crosshair className="w-4 h-4 text-sky-400" />
              <span className="font-bold text-white tracking-wide">
                {isMn ? 'ИЛЭРСЭН САНСРЫН ХОГУУД' : 'DETECTED ORBITAL TARGETS'}
              </span>
              <span className="text-[11px] text-slate-400">({filteredItems.length} объект)</span>
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

          {/* Horizontal List of Targets */}
          <div className="p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 bg-slate-950/90 max-h-48 overflow-y-auto">
            {filteredItems.map(item => {
              const isSelected = selectedItem?.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelectItem(item)}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between min-h-[85px] ${
                    isSelected
                      ? 'bg-sky-500/20 border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.3)]'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${item.color}25`, color: item.color }}>
                        {isMn ? item.categoryMn : item.categoryEn}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 font-bold">
                        {item.relativeDistKm} km
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-white line-clamp-1 mb-1">
                      {isMn ? item.nameMn : item.name}
                    </h4>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-slate-800/80 pt-1 mt-1">
                    <span>{item.altitudeKm} km</span>
                    <span className="text-amber-400">{item.tumbleRateDegS}°/s</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Bar */}
          {selectedItem && (
            <div className="px-4 py-3 bg-slate-900/95 border-t border-sky-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs font-mono text-slate-300 text-center sm:text-left">
                <span className="text-slate-400">{isMn ? 'Сонгосон зорилт:' : 'Target:'} </span>
                <strong className="text-white text-sm">{isMn ? selectedItem.nameMn : selectedItem.name}</strong>
                <span className="mx-2">•</span>
                <span className="text-sky-300 font-bold">{selectedItem.relativeDistKm} km</span>
                <span className="mx-2">•</span>
                <span className="text-amber-300 font-bold">{selectedItem.tumbleRateDegS}°/s spin</span>
              </div>

              <button
                onClick={() => {
                  sound.playLockChime();
                  onUpdateState?.({
                    radarDetectedCount: radarItems.length,
                  });
                  onProceedToApproach();
                }}
                className="w-full sm:w-auto min-h-[48px] px-7 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs sm:text-sm font-mono flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(56,189,248,0.4)] active:scale-95"
              >
                <Target className="w-4 h-4" />
                <span>{isMn ? 'ЗОРИЛТОТ ХОГ РУУ ОЙРТОХ' : 'LOCK TARGET & INITIATE APPROACH'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
