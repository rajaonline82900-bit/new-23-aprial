import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import MatkaLogo from '../components/MatkaLogo';
import { 
  Wallet, 
  Shield,
  Menu,
  Play,
  X,
  HandCoins,
  BanknoteArrowUp,
  BarChart3,
  Flame,
  Crown,
  Lock,
  MessageCircle
} from 'lucide-react';

/* ---------- Premium Casino-Style Category Icons (rich, illustrated) ---------- */
// Gali Disawar — Realistic clay Matka pot (photo-like earthen pot)
const GaliDisawarIcon = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="matkaG1" cx="35%" cy="35%">
        <stop offset="0%" stopColor="#FED7AA" />
        <stop offset="25%" stopColor="#F59E0B" />
        <stop offset="55%" stopColor="#B45309" />
        <stop offset="85%" stopColor="#78350F" />
        <stop offset="100%" stopColor="#3F1E08" />
      </radialGradient>
      <radialGradient id="matkaMouth1" cx="50%" cy="30%">
        <stop offset="0%" stopColor="#1F1108" />
        <stop offset="70%" stopColor="#0A0704" />
        <stop offset="100%" stopColor="#000000" />
      </radialGradient>
      <linearGradient id="matkaRim1" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#B45309" />
        <stop offset="50%" stopColor="#78350F" />
        <stop offset="100%" stopColor="#3F1E08" />
      </linearGradient>
    </defs>
    {/* Ground shadow */}
    <ellipse cx="32" cy="60" rx="20" ry="2" fill="rgba(0,0,0,0.55)" />
    {/* Matka body (bulbous belly) */}
    <path
      d="M 14 30 Q 8 42 14 52 Q 20 60 32 60 Q 44 60 50 52 Q 56 42 50 30 Q 46 22 32 22 Q 18 22 14 30 Z"
      fill="url(#matkaG1)"
      stroke="#3F1E08"
      strokeWidth="1.4"
    />
    {/* Neck rim (darker band) */}
    <path d="M 20 22 L 20 18 Q 20 15 32 15 Q 44 15 44 18 L 44 22 Z" fill="url(#matkaRim1)" stroke="#3F1E08" strokeWidth="1" />
    {/* Rim thickness ellipse (top) */}
    <ellipse cx="32" cy="15" rx="12" ry="2.5" fill="#78350F" stroke="#3F1E08" strokeWidth="1" />
    {/* Dark opening (inside) */}
    <ellipse cx="32" cy="14.5" rx="9.5" ry="1.8" fill="url(#matkaMouth1)" />
    {/* Body horizontal line (throw line) */}
    <path d="M 12 36 Q 32 40 52 36" fill="none" stroke="#78350F" strokeWidth="0.8" opacity="0.5" />
    <path d="M 12 44 Q 32 48 52 44" fill="none" stroke="#78350F" strokeWidth="0.6" opacity="0.35" />
    {/* Left main highlight (shine) */}
    <ellipse cx="22" cy="34" rx="4" ry="10" fill="#FEF3C7" opacity="0.35" />
    <ellipse cx="21" cy="32" rx="1.5" ry="4" fill="#FEF3C7" opacity="0.55" />
    {/* Right subtle highlight */}
    <ellipse cx="44" cy="40" rx="2" ry="6" fill="#FEF3C7" opacity="0.18" />
    {/* Rim highlight */}
    <path d="M 22 16 Q 32 13 42 16" fill="none" stroke="#FEF3C7" strokeWidth="0.6" opacity="0.55" />
    {/* Tiny crack/texture (adds realism) */}
    <path d="M 30 30 Q 31 34 30 38" fill="none" stroke="#3F1E08" strokeWidth="0.4" opacity="0.4" />
    <path d="M 38 44 Q 39 46 38 48" fill="none" stroke="#3F1E08" strokeWidth="0.3" opacity="0.35" />
  </svg>
);

// Kalyan — Realistic red/terracotta Matka pot with golden band
const KalyanIcon = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="matkaG2" cx="35%" cy="35%">
        <stop offset="0%" stopColor="#FECACA" />
        <stop offset="20%" stopColor="#F87171" />
        <stop offset="50%" stopColor="#DC2626" />
        <stop offset="80%" stopColor="#7F1D1D" />
        <stop offset="100%" stopColor="#3B0808" />
      </radialGradient>
      <radialGradient id="matkaMouth2" cx="50%" cy="30%">
        <stop offset="0%" stopColor="#1F0404" />
        <stop offset="70%" stopColor="#0A0202" />
        <stop offset="100%" stopColor="#000000" />
      </radialGradient>
      <linearGradient id="matkaRim2" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#991B1B" />
        <stop offset="50%" stopColor="#7F1D1D" />
        <stop offset="100%" stopColor="#450A0A" />
      </linearGradient>
      <linearGradient id="goldBand" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FEF3C7" />
        <stop offset="50%" stopColor="#FBBF24" />
        <stop offset="100%" stopColor="#78350F" />
      </linearGradient>
    </defs>
    {/* Ground shadow */}
    <ellipse cx="32" cy="60" rx="20" ry="2" fill="rgba(0,0,0,0.55)" />
    {/* Matka body */}
    <path
      d="M 14 30 Q 8 42 14 52 Q 20 60 32 60 Q 44 60 50 52 Q 56 42 50 30 Q 46 22 32 22 Q 18 22 14 30 Z"
      fill="url(#matkaG2)"
      stroke="#3B0808"
      strokeWidth="1.4"
    />
    {/* Golden decorative band around widest part */}
    <path d="M 8 42 Q 32 46 56 42 L 56 45 Q 32 49 8 45 Z" fill="url(#goldBand)" stroke="#78350F" strokeWidth="0.6" opacity="0.95" />
    <path d="M 8 42 Q 32 46 56 42" fill="none" stroke="#FEF3C7" strokeWidth="0.4" opacity="0.6" />
    {/* Gold jewels on band */}
    <circle cx="18" cy="44" r="1.4" fill="#DC2626" stroke="#78350F" strokeWidth="0.4" />
    <circle cx="32" cy="46" r="1.8" fill="#DC2626" stroke="#78350F" strokeWidth="0.5" />
    <circle cx="46" cy="44" r="1.4" fill="#DC2626" stroke="#78350F" strokeWidth="0.4" />
    {/* Neck rim */}
    <path d="M 20 22 L 20 18 Q 20 15 32 15 Q 44 15 44 18 L 44 22 Z" fill="url(#matkaRim2)" stroke="#3B0808" strokeWidth="1" />
    {/* Rim thickness */}
    <ellipse cx="32" cy="15" rx="12" ry="2.5" fill="#7F1D1D" stroke="#3B0808" strokeWidth="1" />
    {/* Dark opening */}
    <ellipse cx="32" cy="14.5" rx="9.5" ry="1.8" fill="url(#matkaMouth2)" />
    {/* Body throw lines */}
    <path d="M 12 34 Q 32 38 52 34" fill="none" stroke="#450A0A" strokeWidth="0.8" opacity="0.5" />
    <path d="M 12 52 Q 32 55 52 52" fill="none" stroke="#450A0A" strokeWidth="0.6" opacity="0.35" />
    {/* Left highlight */}
    <ellipse cx="22" cy="34" rx="4" ry="10" fill="#FECACA" opacity="0.4" />
    <ellipse cx="21" cy="32" rx="1.5" ry="4" fill="#FEF3C7" opacity="0.65" />
    {/* Right subtle highlight */}
    <ellipse cx="44" cy="40" rx="2" ry="6" fill="#FECACA" opacity="0.22" />
    {/* Rim highlight */}
    <path d="M 22 16 Q 32 13 42 16" fill="none" stroke="#FECACA" strokeWidth="0.6" opacity="0.6" />
  </svg>
);

// Aviator — 3D plane climbing with rocket fire trail + multiplier "x" chart curve
const AviatorIcon = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="planeBody" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="55%" stopColor="#7DD3FC" />
        <stop offset="100%" stopColor="#0369A1" />
      </linearGradient>
      <linearGradient id="fireTrail" x1="0%" y1="50%" x2="100%" y2="50%">
        <stop offset="0%" stopColor="#DC2626" stopOpacity="0" />
        <stop offset="30%" stopColor="#F59E0B" stopOpacity="0.7" />
        <stop offset="70%" stopColor="#FDE047" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#FFFFFF" />
      </linearGradient>
      <linearGradient id="chartLine" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#22C55E" />
        <stop offset="100%" stopColor="#FDE047" />
      </linearGradient>
    </defs>
    {/* Rising curve chart */}
    <path
      d="M 6 56 Q 22 54 32 40 T 56 12"
      fill="none"
      stroke="url(#chartLine)"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeDasharray="0 0"
    />
    {/* Fire trail behind plane */}
    <path d="M 8 54 Q 18 48 30 34" fill="none" stroke="url(#fireTrail)" strokeWidth="6" strokeLinecap="round" opacity="0.85" />
    <path d="M 12 56 Q 22 50 32 38" fill="none" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
    {/* Plane body (angled up-right) */}
    <g transform="translate(34 30) rotate(-38)">
      {/* Fuselage */}
      <ellipse cx="0" cy="0" rx="16" ry="3.5" fill="url(#planeBody)" stroke="#0C4A6E" strokeWidth="1" />
      {/* Cockpit window */}
      <ellipse cx="10" cy="-0.5" rx="3.5" ry="1.8" fill="#0369A1" stroke="#0C4A6E" strokeWidth="0.5" />
      <ellipse cx="10" cy="-1" rx="3" ry="0.9" fill="#7DD3FC" opacity="0.8" />
      {/* Main wing (top) */}
      <path d="M -4 -2 L 4 -10 L 10 -10 L 4 -2 Z" fill="#0891B2" stroke="#0C4A6E" strokeWidth="0.8" />
      {/* Main wing (bottom) */}
      <path d="M -4 2 L 4 10 L 10 10 L 4 2 Z" fill="#0369A1" stroke="#0C4A6E" strokeWidth="0.8" />
      {/* Tail fin */}
      <path d="M -13 0 L -16 -6 L -13 -1 Z" fill="#0891B2" stroke="#0C4A6E" strokeWidth="0.8" />
      <path d="M -13 0 L -16 6 L -13 1 Z" fill="#0369A1" stroke="#0C4A6E" strokeWidth="0.8" />
      {/* Nose highlight */}
      <path d="M 14 -1 L 17 0 L 14 1 Z" fill="#FEF3C7" />
    </g>
    {/* Multiplier badge in top-right */}
    <g transform="translate(50 6)">
      <rect x="0" y="0" width="14" height="10" rx="3" fill="#FDE047" stroke="#78350F" strokeWidth="0.8" />
      <text x="7" y="7.5" textAnchor="middle" fontSize="7" fontWeight="900" fill="#78350F" fontFamily="Outfit, sans-serif">2x</text>
    </g>
    {/* Small sparkle particles */}
    <circle cx="52" cy="24" r="1.2" fill="#FEF3C7" />
    <circle cx="20" cy="14" r="1" fill="#7DD3FC" opacity="0.8" />
    <circle cx="42" cy="42" r="0.8" fill="#FDE047" opacity="0.9" />
  </svg>
);
// Legacy Ludo icon kept (may still be referenced elsewhere)
const LudoIcon = ({ size = 26, active = false }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="32" height="32" rx="5" fill={active ? '#FFFFFF' : '#1F2937'} stroke={active ? '#1F2937' : '#4B5563'} strokeWidth="1.5" />
    <rect x="6" y="6" width="12" height="12" rx="2" fill="#EF4444" />
    <rect x="22" y="6" width="12" height="12" rx="2" fill="#3B82F6" />
    <rect x="6" y="22" width="12" height="12" rx="2" fill="#10B981" />
    <rect x="22" y="22" width="12" height="12" rx="2" fill="#F59E0B" />
    <path d="M 20 15 L 22 19 L 26 19 L 23 22 L 24 26 L 20 24 L 16 26 L 17 22 L 14 19 L 18 19 Z"
          fill={active ? '#FFFFFF' : '#F9FAFB'} stroke={active ? '#7C3AED' : '#111827'} strokeWidth="0.8" />
  </svg>
);
// Coin Toss — realistic spinning gold coin with H/T sides visible + sparkle burst
const CoinIcon = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="coinFace" cx="35%" cy="30%">
        <stop offset="0%" stopColor="#FEF3C7" />
        <stop offset="35%" stopColor="#FBBF24" />
        <stop offset="75%" stopColor="#B45309" />
        <stop offset="100%" stopColor="#78350F" />
      </radialGradient>
      <linearGradient id="coinEdge" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FDE047" />
        <stop offset="50%" stopColor="#B45309" />
        <stop offset="100%" stopColor="#78350F" />
      </linearGradient>
    </defs>
    {/* Second coin (behind, side-view showing thickness) */}
    <g transform="translate(6 40) rotate(-15)">
      <ellipse cx="10" cy="6" rx="10" ry="5" fill="url(#coinEdge)" stroke="#78350F" strokeWidth="1" />
      <ellipse cx="10" cy="4" rx="10" ry="5" fill="url(#coinFace)" stroke="#78350F" strokeWidth="1" />
      <text x="10" y="7" textAnchor="middle" fontSize="6" fontWeight="900" fill="#78350F">T</text>
    </g>
    {/* Front main coin */}
    <g transform="translate(32 28)">
      {/* Coin edge shadow */}
      <circle cx="0" cy="2" r="22" fill="rgba(0,0,0,0.35)" />
      {/* Coin body */}
      <circle cx="0" cy="0" r="22" fill="url(#coinFace)" stroke="#78350F" strokeWidth="2" />
      {/* Inner ring */}
      <circle cx="0" cy="0" r="18" fill="none" stroke="#78350F" strokeWidth="1" opacity="0.6" />
      <circle cx="0" cy="0" r="14" fill="none" stroke="#FEF3C7" strokeWidth="0.8" opacity="0.6" strokeDasharray="1.5 1" />
      {/* Highlight shine */}
      <ellipse cx="-6" cy="-10" rx="6" ry="3" fill="#FFFFFF" opacity="0.5" />
      {/* ₹ symbol */}
      <text x="0" y="8" textAnchor="middle" fontSize="20" fontWeight="900" fill="#78350F" fontFamily="Outfit, sans-serif">₹</text>
    </g>
    {/* Sparkle burst around coin */}
    <path d="M 56 12 L 57 16 L 61 17 L 57 18 L 56 22 L 55 18 L 51 17 L 55 16 Z" fill="#FDE047" opacity="0.95" />
    <circle cx="8" cy="14" r="1.5" fill="#FEF3C7" />
    <circle cx="58" cy="46" r="1.2" fill="#FDE047" opacity="0.9" />
    <circle cx="14" cy="8" r="1" fill="#FEF3C7" opacity="0.85" />
  </svg>
);

const DragonTigerIcon = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="dtDragonG" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FCA5A5" />
        <stop offset="50%" stopColor="#DC2626" />
        <stop offset="100%" stopColor="#7F1D1D" />
      </linearGradient>
      <linearGradient id="dtTigerG" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FED7AA" />
        <stop offset="50%" stopColor="#F97316" />
        <stop offset="100%" stopColor="#7C2D12" />
      </linearGradient>
      <linearGradient id="dtCardG" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FEFCE8" />
        <stop offset="100%" stopColor="#FDE68A" />
      </linearGradient>
    </defs>
    {/* Dragon card (left, slight tilt) */}
    <g transform="translate(6 14) rotate(-12 15 20)">
      <rect x="0" y="0" width="26" height="40" rx="4" fill="url(#dtCardG)" stroke="#B45309" strokeWidth="1.5" />
      <text x="4" y="10" fontSize="9" fontWeight="900" fill="#DC2626" fontFamily="Outfit, sans-serif">A</text>
      <text x="4" y="18" fontSize="8" fill="#DC2626">♥</text>
      <text x="13" y="28" textAnchor="middle" fontSize="14" fill="url(#dtDragonG)" fontWeight="900">🐉</text>
    </g>
    {/* Tiger card (right, slight tilt) */}
    <g transform="translate(32 14) rotate(12 15 20)">
      <rect x="0" y="0" width="26" height="40" rx="4" fill="url(#dtCardG)" stroke="#B45309" strokeWidth="1.5" />
      <text x="4" y="10" fontSize="9" fontWeight="900" fill="#0F172A" fontFamily="Outfit, sans-serif">K</text>
      <text x="4" y="18" fontSize="8" fill="#0F172A">♠</text>
      <text x="13" y="28" textAnchor="middle" fontSize="14" fill="url(#dtTigerG)" fontWeight="900">🐯</text>
    </g>
    {/* VS badge */}
    <g transform="translate(32 34)">
      <circle cx="0" cy="0" r="8" fill="#FFD700" stroke="#78350F" strokeWidth="1.5" />
      <text x="0" y="3" textAnchor="middle" fontSize="8" fontWeight="900" fill="#7F1D1D" fontFamily="Outfit, sans-serif">VS</text>
    </g>
    {/* Sparkles */}
    <circle cx="10" cy="8" r="1.4" fill="#FDE047" />
    <circle cx="55" cy="10" r="1.2" fill="#FDE047" opacity="0.9" />
    <circle cx="56" cy="54" r="1.3" fill="#FCA5A5" opacity="0.85" />
    <path d="M 6 56 L 7 58 L 9 59 L 7 60 L 6 62 L 5 60 L 3 59 L 5 58 Z" fill="#FDE047" opacity="0.9" />
  </svg>
);

const ColorGameIcon = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="cgRed" cx="35%" cy="30%">
        <stop offset="0%" stopColor="#FEE2E2" />
        <stop offset="60%" stopColor="#DC2626" />
        <stop offset="100%" stopColor="#7F1D1D" />
      </radialGradient>
      <radialGradient id="cgGreen" cx="35%" cy="30%">
        <stop offset="0%" stopColor="#D1FAE5" />
        <stop offset="60%" stopColor="#16A34A" />
        <stop offset="100%" stopColor="#14532D" />
      </radialGradient>
      <radialGradient id="cgViolet" cx="35%" cy="30%">
        <stop offset="0%" stopColor="#EDE9FE" />
        <stop offset="60%" stopColor="#9333EA" />
        <stop offset="100%" stopColor="#4C1D95" />
      </radialGradient>
    </defs>
    {/* Table shadow */}
    <ellipse cx="32" cy="56" rx="24" ry="3" fill="rgba(0,0,0,0.35)" />
    {/* Three overlapping color balls */}
    <circle cx="20" cy="32" r="15" fill="url(#cgRed)" stroke="#FDE047" strokeWidth="1.5" />
    <circle cx="44" cy="32" r="15" fill="url(#cgGreen)" stroke="#FDE047" strokeWidth="1.5" />
    <circle cx="32" cy="22" r="13" fill="url(#cgViolet)" stroke="#FDE047" strokeWidth="1.5" />
    {/* Highlight shines */}
    <ellipse cx="14" cy="26" rx="4" ry="2" fill="#FFFFFF" opacity="0.5" />
    <ellipse cx="38" cy="26" rx="4" ry="2" fill="#FFFFFF" opacity="0.5" />
    <ellipse cx="28" cy="16" rx="3.5" ry="1.8" fill="#FFFFFF" opacity="0.55" />
    {/* Number on violet ball */}
    <text x="32" y="26" textAnchor="middle" fontSize="10" fontWeight="900" fill="#FEF3C7" fontFamily="Outfit, sans-serif">?</text>
    {/* Sparkles */}
    <path d="M 8 10 L 9 13 L 12 14 L 9 15 L 8 18 L 7 15 L 4 14 L 7 13 Z" fill="#FDE047" opacity="0.95" />
    <circle cx="56" cy="14" r="1.4" fill="#FDE047" />
    <circle cx="54" cy="46" r="1.2" fill="#FCA5A5" opacity="0.9" />
  </svg>
);

const ChickenRoadIcon = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="crRoad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#4B5563" />
        <stop offset="100%" stopColor="#1F2937" />
      </linearGradient>
      <radialGradient id="crChickenBody" cx="35%" cy="30%">
        <stop offset="0%" stopColor="#FFFBEB" />
        <stop offset="60%" stopColor="#FDE047" />
        <stop offset="100%" stopColor="#B45309" />
      </radialGradient>
    </defs>
    {/* Road */}
    <rect x="4" y="26" width="56" height="24" rx="2" fill="url(#crRoad)" stroke="#0F172A" strokeWidth="1" />
    {/* Road dashed center line */}
    <line x1="4" y1="38" x2="60" y2="38" stroke="#FDE047" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.85" />
    {/* Car (right side, coming) */}
    <g transform="translate(42 28)">
      <rect x="0" y="4" width="14" height="8" rx="2" fill="#DC2626" stroke="#0F172A" strokeWidth="1" />
      <rect x="2" y="1" width="10" height="5" rx="1.5" fill="#F87171" stroke="#0F172A" strokeWidth="0.8" />
      <circle cx="3" cy="12" r="1.8" fill="#0F172A" />
      <circle cx="11" cy="12" r="1.8" fill="#0F172A" />
      <rect x="12" y="6" width="2" height="1.5" fill="#FDE047" /> {/* headlight */}
    </g>
    {/* Chicken (left side) */}
    <g transform="translate(10 20)">
      {/* Body */}
      <ellipse cx="8" cy="14" rx="7" ry="6" fill="url(#crChickenBody)" stroke="#78350F" strokeWidth="1" />
      {/* Head */}
      <circle cx="8" cy="7" r="5" fill="url(#crChickenBody)" stroke="#78350F" strokeWidth="1" />
      {/* Comb (red crest) */}
      <path d="M5 4 Q6 1 7 4 Q8 1 9 4 Q10 1 11 4 Z" fill="#DC2626" stroke="#7F1D1D" strokeWidth="0.5" />
      {/* Beak */}
      <path d="M12 7 L15 8 L12 9 Z" fill="#F97316" stroke="#78350F" strokeWidth="0.5" />
      {/* Eye */}
      <circle cx="10" cy="6" r="1" fill="#0F172A" />
      <circle cx="10.4" cy="5.7" r="0.35" fill="#FFF" />
      {/* Feet */}
      <line x1="6" y1="20" x2="6" y2="23" stroke="#78350F" strokeWidth="1.2" />
      <line x1="10" y1="20" x2="10" y2="23" stroke="#78350F" strokeWidth="1.2" />
      <path d="M4 23 L8 23 M8 23 L12 23" stroke="#78350F" strokeWidth="1.2" fill="none" />
    </g>
    {/* Multiplier badge */}
    <g transform="translate(30 6)">
      <rect x="0" y="0" width="20" height="12" rx="3" fill="#FDE047" stroke="#78350F" strokeWidth="1" />
      <text x="10" y="9" textAnchor="middle" fontSize="8" fontWeight="900" fill="#7F1D1D" fontFamily="Outfit, sans-serif">2x</text>
    </g>
    {/* Sparkles */}
    <circle cx="6" cy="10" r="1.2" fill="#FDE047" />
    <circle cx="58" cy="16" r="1.4" fill="#FDE047" opacity="0.9" />
    <path d="M 54 54 L 55 56 L 57 57 L 55 58 L 54 60 L 53 58 L 51 57 L 53 56 Z" fill="#FDE047" opacity="0.9" />
  </svg>
);
import FooterNav from '../components/FooterNav';
import { speak } from '../utils/voice';
import SidebarMenu from '../components/SidebarMenu';
import GameHistoryModal from '../components/GameHistoryModal';
import JantriModal from '../components/JantriModal';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const DashboardPage = () => {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [telegramLink, setTelegramLink] = useState('');
  const [whatsappLink, setWhatsappLink] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  // Start at HOME (4-box gateway). User explicitly requested: app open par direct
  // game cards nahi dikhne chahiye — pehle 4 box tiles dikhein, tap par category open ho.
  const [gameCategory, setGameCategory] = useState(null);
  const [kalyanResults, setKalyanResults] = useState({});
  const [historyGame, setHistoryGame] = useState(null);
  const [jantriGame, setJantriGame] = useState(null);
  // Track today_result changes to briefly flash-highlight the Today badge when a result just appears
  const prevResultsRef = useRef({});
  const [flashGameIds, setFlashGameIds] = useState(new Set());
  const [topWinners, setTopWinners] = useState([]);
  const [todayDeposits, setTodayDeposits] = useState([]);
  const [todayWithdrawals, setTodayWithdrawals] = useState([]);
  const [tickerTab, setTickerTab] = useState('winners'); // 'winners' | 'deposits' | 'withdrawals'
  const [tickerVisible, setTickerVisible] = useState(true);
  const [gameToggles, setGameToggles] = useState({ gali_disawar: true, kalyan: true, aviator: true, ludo: true });
  const tickerRef = useRef(null);
  const gamesRef = useRef(null);

  // Pause marquee when scrolled off-screen → saves GPU on long lists below
  useEffect(() => {
    const el = tickerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setTickerVisible(entry.isIntersecting),
      { threshold: 0.01 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Fetch today's Kalyan results for the dashboard cards
  useEffect(() => {
    if (gameCategory !== 'kalyan') return;
    const fetchKalyan = async () => {
      try {
        const kalyanGames = games.filter(g => g.category === 'kalyan');
        const results = {};
        await Promise.all(kalyanGames.map(async (g) => {
          try {
            const { data } = await axios.get(`${API_URL}/api/kalyan/today/${g.id}`, { withCredentials: true });
            if (data.result) results[g.id] = data.result;
          } catch (e) { /* ignore */ }
        }));
        setKalyanResults(results);
      } catch (e) { console.error(e); }
    };
    fetchKalyan();
    const int = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      fetchKalyan();
    }, 60000);
    return () => clearInterval(int);
  }, [gameCategory, games]);


  useEffect(() => {
    fetchGames();
    fetchSettings();
    fetchTopWinner();
    fetchGameToggles();
    refreshUser();
    fetchUnreadChat();

    // Auto-refresh games every 60 seconds — but ONLY when tab is visible.
    // This eliminates background work when APK is backgrounded or screen off,
    // a major battery + perf win on low-end Android devices.
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      fetchGames(false);
      fetchGameToggles();
      fetchUnreadChat();
    }, 60000);

    // Refresh top winner less frequently (every 5 min) to save bandwidth
    const winnerInt = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      fetchTopWinner();
    }, 5 * 60 * 1000);

    // Also refresh when app comes back to foreground (PWA tab switch)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchGames(false);
        refreshUser();
        fetchUnreadChat();
        fetchTopWinner();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      clearInterval(winnerInt);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshUser]);

  const fetchSettings = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/settings`, { withCredentials: true });
      setTelegramLink(data.telegram_link || '');
      setWhatsappLink(data.whatsapp_link || '');
      setWhatsappNumber(data.whatsapp_number || '');
    } catch (error) { /* silent — settings load failed, keep defaults */ }
  };

  const fetchTopWinner = async () => {
    try {
      const [w, d, wd] = await Promise.all([
        axios.get(`${API_URL}/api/winners/top?limit=30`, { withCredentials: true }),
        axios.get(`${API_URL}/api/transactions/today-deposits?limit=30`, { withCredentials: true }),
        axios.get(`${API_URL}/api/transactions/today-withdrawals?limit=30`, { withCredentials: true }),
      ]);
      setTopWinners(Array.isArray(w.data?.winners) ? w.data.winners : []);
      setTodayDeposits(Array.isArray(d.data?.entries) ? d.data.entries : []);
      setTodayWithdrawals(Array.isArray(wd.data?.entries) ? wd.data.entries : []);
    } catch (e) {
      // Silent — keep existing data on failure
    }
  };

  const fetchGames = async (showError = true) => {
    try {
      const { data } = await axios.get(`${API_URL}/api/games`, { withCredentials: true });
      if (data && Array.isArray(data.games)) {
        setGames(data.games);
      }
    } catch (error) {
      // Silent failure - don't show annoying toast. Auto-retry in 30s.
      console.warn('Games fetch failed, will retry:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchGameToggles = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/settings/game-toggles`);
      if (data && data.toggles) setGameToggles(data.toggles);
    } catch { /* silent */ }
  };

  const fetchUnreadChat = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/chat/unread-count`, { withCredentials: true });
      setUnreadChat(data.unread || 0);
    } catch (e) { /* silent — unread count fetch failed */ }
  };


  // Subscribe to push notifications silently if permission already granted (no popup)
  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    if (Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then((reg) => {
        if (window.subscribePush) window.subscribePush(reg);
      });
    }
  }, []);

  // Detect newly-declared today_result values and flash-highlight those Today badges
  useEffect(() => {
    if (!games || games.length === 0) return;
    const prev = prevResultsRef.current;
    const newlyDeclared = [];
    const next = {};
    for (const g of games) {
      const cur = g.today_result?.jodi || '';
      next[g.id] = cur;
      const wasEmpty = !prev[g.id] || prev[g.id] === '--' || prev[g.id] === '';
      const isNow = cur && cur !== '--';
      // Only flash on transition from "no result" → "result declared"
      if (wasEmpty && isNow && prev[g.id] !== undefined) {
        newlyDeclared.push(g.id);
      }
    }
    prevResultsRef.current = next;
    if (newlyDeclared.length > 0) {
      setFlashGameIds((s) => new Set([...s, ...newlyDeclared]));
      // Auto-clear after animation finishes (2.4s x 2 iterations = 4.8s)
      setTimeout(() => {
        setFlashGameIds((s) => {
          const nxt = new Set(s);
          newlyDeclared.forEach((id) => nxt.delete(id));
          return nxt;
        });
      }, 5000);
    }
  }, [games]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getGameStatus = (game) => {
    // Get current IST time
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + (istOffset + now.getTimezoneOffset() * 60 * 1000));
    const currentMinutes = istNow.getHours() * 60 + istNow.getMinutes();

    const [startH, startM] = (game.start_time || '00:00').split(':').map(Number);
    const [endH, endM] = (game.end_time || game.time || '23:59').split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    // Cross-midnight wrap-around (e.g., Disawar 07:00 -> 04:00 next day)
    const isOpen = endMinutes < startMinutes
      ? (currentMinutes >= startMinutes || currentMinutes <= endMinutes)
      : (currentMinutes >= startMinutes && currentMinutes <= endMinutes);

    if (isOpen) {
      return { status: 'open', label: 'Play', labelHi: 'खेलें' };
    }
    
    return { status: 'closed', label: 'Time Out', labelHi: 'टाइम आउट' };
  };

  return (
    <div
      className="min-h-screen app-shell relative overflow-hidden"
      style={{
        background: '#0F0420',
      }}
    >
      {/* Background animation handled by parent div backgroundImage — no separate layers needed.
          This eliminates compositor overhead from 5 absolute-positioned animated DIVs. */}

      {/* Header - Royal black with gold gradient bottom edge */}
      <header
        className="fixed top-0 left-0 right-0 z-50"
        style={{
          maxWidth: '480px',
          margin: '0 auto',
          background: '#0A0A14',
          borderBottom: '2px solid #D4AF37',
        }}
      >
        <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.25)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                data-testid="sidebar-toggle"
                className="p-2 rounded-lg text-[#FFD700] hover:bg-[#D4AF37]/10 active:scale-95 transition-all"
              >
                <Menu className="w-5 h-5" />
              </button>
              <MatkaLogo size="sm" />
            </div>

            <div className="flex items-center gap-2">
              {/* Premium Gold Wallet Balance Pill - STATIC (no glow keyframe, no textShadow → 0 repaint) */}
              <Link
                to="/wallet"
                data-testid="header-balance"
                className="flex items-center gap-2 px-3 py-1.5 rounded-full active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.14) 0%, rgba(212, 175, 55, 0.22) 100%)',
                  border: '1px solid rgba(212, 175, 55, 0.6)',
                }}
              >
                <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 50%, #B8860B 100%)' }}>
                  <Wallet className="w-3.5 h-3.5 text-[#1A1A2E]" strokeWidth={2.5} />
                </div>
                <span className="text-sm font-black tabular-nums text-[#FFD700] leading-none" data-testid="header-balance-value">
                  ₹{user?.balance?.toFixed(2) || '0.00'}
                </span>
              </Link>

              {user?.role === 'admin' && (
                <a
                  href={`/admin?_t=${Date.now()}`}
                  data-testid="admin-panel-link"
                  onClick={(e) => {
                    // Use a full-page navigation so the WebView/browser always
                    // re-evaluates the SPA bundle (fixes "purana admin first
                    // load, refresh par naya" cache bug).
                    e.preventDefault();
                    window.location.href = `/admin?_t=${Date.now()}`;
                  }}
                >
                  <button className="p-2 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#FFD700] hover:bg-[#D4AF37]/25 active:scale-95 transition-all" data-testid="admin-panel-btn">
                    <Shield className="w-4 h-4" />
                  </button>
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - everything scrolls together */}
      <div className="px-3 pt-[64px] pb-24" style={{maxWidth: '480px', margin: '0 auto'}}>
        <div className="pt-2">
          {/* WINNERS / DEPOSITS / WITHDRAWALS TICKER — 3-tab card.
              Single transform3d keyframe on the active list = GPU only, no
              scroll-time repaint. Pauses when off-screen or tab hidden. */}
          {(() => {
            const TABS = [
              { id: 'winners',     label: 'आज का विजेता',  data: topWinners,      countLabel: 'विजेता' },
              { id: 'deposits',    label: 'Today Deposit',  data: todayDeposits,   countLabel: 'जमा' },
              { id: 'withdrawals', label: 'Today Withdraw', data: todayWithdrawals, countLabel: 'निकासी' },
            ];
            const active = TABS.find(t => t.id === tickerTab) || TABS[0];
            const list = active.data;
            const hasAny = TABS.some(t => t.data.length > 0);
            if (!hasAny) return null;

            const loop = list.length > 0 ? [...list, ...list] : [];
            const duration = Math.max(18, list.length * 3.2);

            return (
              <div
                ref={tickerRef}
                className="rounded-2xl mb-4 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #1A1505 0%, #16162A 70%)',
                  border: '2px solid #D4AF37',
                  contain: 'content',
                }}
                data-testid="winners-ticker"
              >
                {/* Tab bar - 3 buttons in one row */}
                <div className="flex items-stretch gap-1 p-2">
                  {TABS.map((t) => {
                    const isActive = t.id === tickerTab;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTickerTab(t.id)}
                        data-testid={`ticker-tab-${t.id}`}
                        className="flex-1 rounded-lg py-1.5 px-1.5 flex flex-col items-center justify-center leading-tight active:scale-95"
                        style={
                          isActive
                            ? {
                                background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 60%, #B8860B 100%)',
                                border: '1px solid #FFD700',
                                color: '#1A0F00',
                              }
                            : {
                                background: 'rgba(212, 175, 55, 0.08)',
                                border: '1px solid rgba(212, 175, 55, 0.25)',
                                color: '#FFD700',
                              }
                        }
                      >
                        <span className="text-[10px] font-black tracking-wide whitespace-nowrap">
                          {t.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Ticker track or empty-state hint */}
                {list.length === 0 ? (
                  <div className="px-3 pb-3 text-center text-[11px] text-gray-400 font-bold" data-testid="ticker-empty">
                    अभी तक कोई {active.countLabel} नहीं
                  </div>
                ) : (
                  <div className="overflow-hidden pb-2.5">
                    <div
                      key={tickerTab /* restart marquee on tab switch */}
                      className="winners-ticker-track px-3"
                      style={{
                        animationDuration: `${duration}s`,
                        animationPlayState: tickerVisible && document.visibilityState === 'visible' ? 'running' : 'paused',
                      }}
                    >
                      {loop.map((w, idx) => (
                        <div
                          key={`${tickerTab}-${idx}`}
                          className="flex items-center gap-2 rounded-xl px-3 py-1.5 flex-shrink-0"
                          style={{
                            background: 'rgba(212, 175, 55, 0.10)',
                            border: '1px solid rgba(212, 175, 55, 0.35)',
                          }}
                          data-testid={idx < list.length ? `ticker-chip-${tickerTab}-${idx}` : undefined}
                        >
                          {tickerTab === 'winners' && <Crown className="w-3.5 h-3.5 text-[#FFD700]" strokeWidth={2.5} fill="#FFD700" />}
                          {tickerTab === 'deposits' && <HandCoins className="w-3.5 h-3.5 text-[#34D399]" strokeWidth={2.5} />}
                          {tickerTab === 'withdrawals' && <BanknoteArrowUp className="w-3.5 h-3.5 text-[#FB923C]" strokeWidth={2.5} />}
                          <div className="flex flex-col leading-tight">
                            <span className="text-[#FFD700] text-[12px] font-black whitespace-nowrap" style={{ fontFamily: 'Outfit, Noto Sans Devanagari, sans-serif' }}>
                              {w.name}
                            </span>
                            {tickerTab === 'winners' && (
                              <span className="text-[9px] text-[#86EFAC] font-bold whitespace-nowrap">
                                {w.game_name_hi}
                              </span>
                            )}
                          </div>
                          <span
                            className="text-white text-[13px] font-black tabular-nums whitespace-nowrap pl-1"
                            style={{
                              fontFamily: 'Outfit, monospace',
                              color: tickerTab === 'withdrawals' ? '#FB923C' : (tickerTab === 'deposits' ? '#34D399' : '#FFFFFF'),
                            }}
                          >
                            ₹{(w.won_amount ?? w.amount ?? 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Quick Actions - Deposit / Withdrawal / Telegram / WhatsApp */}
          <div className="grid grid-cols-4 gap-2.5 mb-5">
            {/* DEPOSIT */}
            <Link to="/wallet?action=deposit" data-testid="deposit-quick-link">
              <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl p-3 active:scale-95"
                style={{ background: '#16162A', border: '1px solid rgba(212, 175, 55, 0.3)' }}>
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #34D399 0%, #10B981 50%, #047857 100%)' }}>
                  <HandCoins className="w-6 h-6 text-white" strokeWidth={2.2} />
                </div>
                <span className="text-[#FFD700] font-bold text-[10px] tracking-wide">Deposit</span>
              </div>
            </Link>

            {/* WITHDRAWAL */}
            <Link to="/wallet?action=withdraw" data-testid="withdraw-quick-link">
              <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl p-3 active:scale-95"
                style={{ background: '#16162A', border: '1px solid rgba(212, 175, 55, 0.3)' }}>
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FB923C 0%, #F97316 50%, #C2410C 100%)' }}>
                  <BanknoteArrowUp className="w-6 h-6 text-white" strokeWidth={2.2} />
                </div>
                <span className="text-[#FFD700] font-bold text-[10px] tracking-wide">Withdraw</span>
              </div>
            </Link>

            {/* TELEGRAM */}
            <a href={telegramLink || '#'} target="_blank" rel="noopener noreferrer" data-testid="telegram-quick-link" onClick={(e) => { if (!telegramLink) e.preventDefault(); }}>
              <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl p-3 active:scale-95"
                style={{ background: '#16162A', border: '1px solid rgba(212, 175, 55, 0.3)' }}>
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #2AABEE 0%, #229ED9 100%)' }}>
                  <svg viewBox="0 0 240 240" className="w-6 h-6" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M186.054 71.196 158.5 200.952c-2.08 9.184-7.512 11.464-15.232 7.144l-42.064-31-20.296 19.528c-2.248 2.248-4.128 4.128-8.456 4.128l3.024-42.864 78.04-70.504c3.392-3.024-.736-4.704-5.272-1.68L52.74 138.504l-41.512-12.984c-9.024-2.816-9.184-9.024 1.88-13.36L174.5 60.876c7.512-2.816 14.08 1.68 11.554 10.32Z" fill="#FFFFFF" />
                  </svg>
                </div>
                <span className="text-[#FFD700] font-bold text-[10px] tracking-wide">Telegram</span>
              </div>
            </a>

            {/* WHATSAPP → Internal Live Chat (all messages visible in admin panel) */}
            <Link
              to="/chat"
              data-testid="whatsapp-quick-link"
            >
              <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl p-3 active:scale-95 relative"
                style={{ background: '#16162A', border: '1px solid rgba(212, 175, 55, 0.3)' }}>
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center relative" style={{ background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)' }}>
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#FFFFFF" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.297-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                  {unreadChat > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center border border-[#1A1A2E]" data-testid="chat-unread-badge">{unreadChat > 9 ? '9+' : unreadChat}</span>
                  )}
                </div>
                <span className="text-[#FFD700] font-bold text-[10px] tracking-wide">Live Chat</span>
              </div>
            </Link>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              HOME GATEWAY — 2x2 premium box tiles for the 4 game categories.
              User request: App open par direct game cards nahi, pehle 4 boxes
              dikhein — tap par category open ho. Aviator/Ludo directly navigate.
              ═══════════════════════════════════════════════════════════════ */}
          {gameCategory === null && (
            <>
              {/* Gateway header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-6 rounded-full" style={{ background: 'linear-gradient(180deg, #FFD700 0%, #D4AF37 50%, #B8860B 100%)' }}></span>
                  <h3 className="text-xl font-black tracking-tight" style={{ color: '#FFFFFF' }}>Choose Game</h3>
                </div>
                <span className="text-[10px] px-2.5 py-1 rounded-full font-black tracking-widest uppercase" style={{ background: 'rgba(212, 175, 55, 0.15)', border: '1px solid rgba(212, 175, 55, 0.5)', color: '#FFD700' }}>
                  खेल चुनें
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 mb-5" data-testid="home-gateway-grid">
                {[
                  {
                    id: 'gali_disawar',
                    label: 'Gali Disawar',
                    hi: 'गली दिसावर',
                    Icon: GaliDisawarIcon,
                    bg: 'linear-gradient(155deg, #3A2708 0%, #1F1608 55%, #0A0704 100%)',
                    border: '#FFD700',
                    accent: '#FFD700',
                    badgeBg: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 55%, #B8860B 100%)',
                    badgeColor: '#1A0F00',
                    stripe: 'linear-gradient(90deg, #7B4D0A 0%, #FFD700 50%, #7B4D0A 100%)',
                    count: games.filter(g => (g.category || 'gali_disawar') === 'gali_disawar').length,
                    countSuffix: 'Games',
                    isLink: false,
                  },
                  {
                    id: 'kalyan',
                    label: 'Kalyan Matka',
                    hi: 'कल्याण मटका',
                    Icon: KalyanIcon,
                    bg: 'linear-gradient(155deg, #3A0A0A 0%, #1A0A14 55%, #0A0408 100%)',
                    border: '#DC2626',
                    accent: '#FCA5A5',
                    badgeBg: 'linear-gradient(135deg, #F87171 0%, #DC2626 55%, #7F1D1D 100%)',
                    badgeColor: '#FFFFFF',
                    stripe: 'linear-gradient(90deg, #450A0A 0%, #DC2626 50%, #450A0A 100%)',
                    count: games.filter(g => g.category === 'kalyan').length,
                    countSuffix: 'Games',
                    isLink: false,
                  },
                  {
                    id: 'aviator',
                    label: 'Aviator',
                    hi: 'एविएटर',
                    Icon: AviatorIcon,
                    bg: 'linear-gradient(155deg, #082F49 0%, #0A1428 55%, #050810 100%)',
                    border: '#22D3EE',
                    accent: '#67E8F9',
                    badgeBg: 'linear-gradient(135deg, #22D3EE 0%, #0891B2 55%, #164E63 100%)',
                    badgeColor: '#FFFFFF',
                    stripe: 'linear-gradient(90deg, #0C4A6E 0%, #22D3EE 50%, #0C4A6E 100%)',
                    liveLabel: 'LIVE',
                    countSuffix: 'Crash Game',
                    isLink: true,
                    linkTo: '/aviator',
                  },
                  {
                    id: 'chicken_road',
                    label: 'Chicken Road',
                    hi: 'चिकन रोड',
                    Icon: ChickenRoadIcon,
                    bg: 'linear-gradient(155deg, #3A2708 0%, #1A0F04 55%, #0A0602 100%)',
                    border: '#F97316',
                    accent: '#FED7AA',
                    badgeBg: 'linear-gradient(135deg, #F97316 0%, #7C2D12 100%)',
                    badgeColor: '#FEF3C7',
                    stripe: 'linear-gradient(90deg, #7C2D12 0%, #F97316 50%, #FBBF24 100%)',
                    liveLabel: 'ARCADE',
                    countSuffix: 'Cross the Road',
                    isLink: true,
                    linkTo: '/chicken-road',
                  },
                  {
                    id: 'coin',
                    label: 'Coin Toss',
                    hi: 'सिक्का',
                    Icon: CoinIcon,
                    bg: 'linear-gradient(155deg, #3A2708 0%, #1F1608 55%, #0A0704 100%)',
                    border: '#FBBF24',
                    accent: '#FCD34D',
                    badgeBg: 'linear-gradient(135deg, #FCD34D 0%, #FBBF24 55%, #B45309 100%)',
                    badgeColor: '#1A0F00',
                    stripe: 'linear-gradient(90deg, #78350F 0%, #FBBF24 50%, #78350F 100%)',
                    liveLabel: '1 MIN',
                    countSuffix: 'Head or Tail',
                    isLink: true,
                    linkTo: '/coin',
                  },
                  {
                    id: 'dragon_tiger',
                    label: 'Dragon Tiger',
                    hi: 'ड्रैगन टाइगर',
                    Icon: DragonTigerIcon,
                    bg: 'linear-gradient(155deg, #3B0808 0%, #1A0404 55%, #0A0202 100%)',
                    border: '#DC2626',
                    accent: '#FCA5A5',
                    badgeBg: 'linear-gradient(135deg, #DC2626 0%, #7F1D1D 100%)',
                    badgeColor: '#FEF3C7',
                    stripe: 'linear-gradient(90deg, #7F1D1D 0%, #DC2626 50%, #7F1D1D 100%)',
                    liveLabel: '30 SEC',
                    countSuffix: '2x / 50x Payout',
                    isLink: true,
                    linkTo: '/dragon-tiger',
                  },
                  {
                    id: 'color_game',
                    label: 'Color Game',
                    hi: 'कलर गेम',
                    Icon: ColorGameIcon,
                    bg: 'linear-gradient(155deg, #2A0B3D 0%, #1A0625 55%, #0A0410 100%)',
                    border: '#9333EA',
                    accent: '#DDD6FE',
                    badgeBg: 'linear-gradient(135deg, #9333EA 0%, #4C1D95 100%)',
                    badgeColor: '#FEF3C7',
                    stripe: 'linear-gradient(90deg, #DC2626 0%, #FDE047 50%, #16A34A 100%)',
                    liveLabel: '30 SEC',
                    countSuffix: '2x / 4.5x Payout',
                    isLink: true,
                    linkTo: '/color-game',
                  },
                ].map((cat) => {
                  const isDisabled = gameToggles[cat.id] === false;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => {
                        if (isDisabled) {
                          toast.error(`${cat.label} abhi band hai`);
                          return;
                        }
                        try { navigator.vibrate?.(15); } catch (_) { /* haptic api unavailable */ }
                        if (cat.isLink) {
                          navigate(cat.linkTo);
                          return;
                        }
                        setGameCategory(cat.id);
                      }}
                      data-testid={`gateway-box-${cat.id}`}
                      className="w-full rounded-2xl relative overflow-hidden text-left active:scale-[0.98]"
                      style={{
                        background: cat.bg,
                        border: `1.5px solid ${cat.border}`,
                        boxShadow: `0 6px 20px rgba(0,0,0,0.55), inset 0 1px 0 ${cat.border}30`,
                        transition: 'transform 180ms ease',
                        opacity: isDisabled ? 0.55 : 1,
                        filter: isDisabled ? 'grayscale(70%)' : 'none',
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        contain: 'content',
                      }}
                    >
                      {/* Left accent bar */}
                      <div className="absolute top-0 bottom-0 left-0 w-1"
                           style={{ background: cat.stripe, opacity: 0.9 }} />

                      {/* Ambient side glow */}
                      <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full pointer-events-none"
                           style={{ background: `radial-gradient(circle, ${cat.border}45 0%, transparent 65%)`, filter: 'blur(2px)' }} />

                      {/* BAND / LIVE badge */}
                      {isDisabled ? (
                        <span
                          className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest z-10"
                          style={{ background: '#DC2626', color: '#FFF', border: '1px solid #FCA5A5' }}
                          data-testid={`gateway-${cat.id}-disabled-badge`}
                        >
                          BAND
                        </span>
                      ) : cat.liveLabel ? (
                        <span
                          className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[8px] font-black tracking-widest z-10 flex items-center gap-1"
                          style={{ background: 'rgba(0, 0, 0, 0.55)', color: cat.accent, border: `1px solid ${cat.border}80` }}
                          data-testid={`gateway-${cat.id}-live-badge`}
                        >
                          <span className="w-1 h-1 rounded-full" style={{ background: cat.accent, boxShadow: `0 0 4px ${cat.accent}` }} />
                          {cat.liveLabel}
                        </span>
                      ) : null}

                      {/* Horizontal layout: [icon] [text] [PLAY] */}
                      <div className="flex items-center gap-3 pl-4 pr-3 py-3 relative z-[1]">
                        {/* Icon (left) — no round border, direct realistic illustration */}
                        <div className="shrink-0 flex items-center justify-center"
                             style={{ width: 72, height: 72, filter: `drop-shadow(0 4px 8px ${cat.border}88) drop-shadow(0 0 12px ${cat.border}44)` }}>
                          <cat.Icon size={72} />
                        </div>

                        {/* Text (center) */}
                        <div className="flex-1 min-w-0">
                          <div
                            className="text-[15px] font-black tracking-tight leading-tight truncate"
                            style={{ color: '#FFFFFF', fontFamily: 'Outfit, sans-serif' }}
                          >
                            {cat.label}
                          </div>
                          <div
                            className="text-[11px] font-bold tracking-tight leading-tight mt-0.5 truncate"
                            style={{ color: cat.accent, fontFamily: 'Noto Sans Devanagari, Outfit, sans-serif' }}
                          >
                            {cat.hi}
                          </div>
                          <div className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded-full"
                               style={{
                                 background: cat.badgeBg || cat.stripe,
                                 border: `1px solid ${cat.border}80`,
                                 boxShadow: `0 2px 6px ${cat.border}55`,
                               }}>
                            <span className="text-[9px] font-black tracking-widest leading-none" style={{ color: cat.badgeColor || '#0A0A14' }}>
                              {cat.count != null ? `${cat.count} ${cat.countSuffix}` : cat.countSuffix}
                            </span>
                          </div>
                        </div>

                        {/* PLAY button (right) */}
                        {!isDisabled && (
                          <div
                            className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-full"
                            style={{
                              background: 'linear-gradient(135deg, #16A34A 0%, #22C55E 50%, #16A34A 100%)',
                              border: '1.5px solid #FDE047',
                              boxShadow: '0 4px 12px rgba(34, 197, 94, 0.55), inset 0 1px 2px rgba(255,255,255,0.35)',
                            }}
                            data-testid={`gateway-${cat.id}-play-pill`}
                          >
                            <Play className="w-3 h-3" fill="#FFF" stroke="#FFF" strokeWidth={2} />
                            <span className="text-[11px] font-black text-white tracking-widest">PLAY</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              CATEGORY VIEW — Back button + section header + games list
              ═══════════════════════════════════════════════════════════════ */}
          {gameCategory !== null && (
          <>
          {/* Back button + Section Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { try { navigator.vibrate?.(10); } catch (_) { /* haptic api unavailable */ } setGameCategory(null); }}
                data-testid="gateway-back-btn"
                aria-label="Back to home"
                className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(212, 175, 55, 0.22) 100%)',
                  border: '1px solid rgba(212, 175, 55, 0.6)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFD700" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <h3 className="text-lg font-black tracking-tight" style={{ color: '#FFFFFF' }}>
                {gameCategory === 'gali_disawar' ? 'Gali Disawar' : gameCategory === 'kalyan' ? 'Kalyan Matka' : 'Market'}
              </h3>
            </div>
            <span className="text-[#1A1A2E] text-[11px] px-3 py-1 rounded-full font-black tracking-wide" style={{ background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)' }} data-testid="games-count">
              {games.filter(g => (g.category || 'gali_disawar') === gameCategory).length} Available
            </span>
          </div>

          {/* Legacy 4-pill switcher retained (hidden) — logic kept for potential re-use */}
          {false && (
          <div
            className="grid grid-cols-4 gap-1 p-1 rounded-2xl mb-3"
            style={{
              background: 'linear-gradient(135deg, #0F0F1F 0%, #1A1A2E 100%)',
              border: '1px solid rgba(212, 175, 55, 0.25)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.4)',
            }}
            data-testid="category-switcher"
          >
            {[
              { id: 'gali_disawar', label: 'Gali Disawar', hi: 'गली दिसावर', Icon: GaliDisawarIcon },
              { id: 'kalyan', label: 'Kalyan', hi: 'कल्याण', Icon: KalyanIcon },
              { id: 'aviator', label: 'Aviator', hi: 'एविएटर', Icon: AviatorIcon, isLink: true },
              { id: 'ludo', label: 'Ludo', hi: 'लूडो', Icon: LudoIcon, isLink: true, linkTo: '/ludo' },
            ].map((cat) => {
              // Aviator and Ludo always render in their "active" themed state (always available)
              const isDisabled = gameToggles[cat.id] === false;
              const isActive = cat.isLink ? true : gameCategory === cat.id;
              const count = cat.isLink ? 0 : games.filter(g => (g.category || 'gali_disawar') === cat.id).length;
              const isAviator = cat.id === 'aviator';
              const isLudo = cat.id === 'ludo';
              return (
                <button
                  key={cat.id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    if (isDisabled) {
                      toast.error(`${cat.label} abhi band hai`);
                      return;
                    }
                    if (cat.isLink) {
                      navigate(cat.linkTo || '/aviator');
                      return;
                    }
                    setGameCategory(cat.id);
                    localStorage.setItem('game_category', cat.id);
                  }}
                  data-testid={`category-btn-${cat.id}`}
                  className="rounded-xl py-2 px-1 flex flex-col items-center justify-center leading-tight relative overflow-hidden"
                  style={{
                    background: isActive
                      ? 'linear-gradient(160deg, #1F1B2E 0%, #14111E 100%)'
                      : 'linear-gradient(160deg, #131319 0%, #0E0E13 100%)',
                    border: `1px solid ${isActive ? 'rgba(255, 215, 0, 0.55)' : 'rgba(255, 255, 255, 0.06)'}`,
                    boxShadow: isActive
                      ? '0 4px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,215,0,0.20)'
                      : 'none',
                    transition: 'transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease',
                    transform: isActive ? 'scale(1.0)' : 'scale(0.96)',
                    opacity: isDisabled ? 0.4 : 1,
                    filter: isDisabled ? 'grayscale(85%)' : 'none',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  {/* Disabled overlay */}
                  {isDisabled && (
                    <span
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                      style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(1px)', zIndex: 6 }}
                    >
                      <span
                        className="px-1.5 py-0.5 rounded text-[9px] font-black tracking-widest"
                        style={{ background: '#DC2626', color: '#FFF', border: '1px solid #FCA5A5' }}
                        data-testid={`category-${cat.id}-disabled-badge`}
                      >
                        BAND
                      </span>
                    </span>
                  )}
                  {/* LIVE badge (Aviator + Ludo) */}
                  {(isAviator || isLudo) && (
                    <span
                      className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full text-[7px] font-black tracking-wider flex items-center gap-1"
                      style={{
                        background: 'rgba(0, 0, 0, 0.55)',
                        color: '#86EFAC',
                        border: '1px solid rgba(34, 197, 94, 0.5)',
                      }}
                      data-testid={`${cat.id}-live-badge`}
                    >
                      <span className="w-1 h-1 rounded-full" style={{ background: '#22C55E', boxShadow: '0 0 4px #22C55E' }} />
                      LIVE
                    </span>
                  )}
                  {/* Icon in a soft circle — golden ring when active */}
                  <div
                    className={`relative flex items-center justify-center rounded-full transition-all ${isActive ? 'active-cat-ring' : ''}`}
                    style={{
                      width: 40,
                      height: 40,
                      background: isActive
                        ? 'radial-gradient(circle at 30% 30%, rgba(255,215,0,0.20) 0%, rgba(212,175,55,0.10) 60%, rgba(0,0,0,0) 100%)'
                        : 'rgba(255, 255, 255, 0.04)',
                      border: `1.5px solid ${isActive ? 'rgba(255, 215, 0, 0.75)' : 'rgba(255,255,255,0.10)'}`,
                    }}
                  >
                    <cat.Icon size={20} active={isActive} />
                  </div>
                  <span
                    className="text-[11px] font-black tracking-wide whitespace-nowrap mt-1.5"
                    style={{ color: isActive ? '#FFD700' : '#9CA3AF' }}
                  >
                    {cat.label}
                  </span>
                  <span
                    className="text-[8px] font-bold mt-0.5 tabular-nums"
                    style={{ color: isActive ? 'rgba(255,215,0,0.60)' : '#6B7280' }}
                  >
                    {cat.isLink ? (isLudo ? 'Play & Win' : 'Real Available') : `${cat.hi} · ${count}`}
                  </span>
                </button>
              );
            })}
          </div>
          )}

          {/* Games list */}
          {loading ? (
            <div className="grid gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-white/70 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3">
              {games.filter(g => (g.category || 'gali_disawar') === gameCategory).map((game, index) => {
                const gameStatus = getGameStatus(game);
                const isDisabled = game.is_holiday || gameStatus.status !== 'open';
                const CardWrapper = isDisabled ? 'div' : Link;
                const cardProps = isDisabled 
                  ? { 'data-testid': `game-card-${game.id}` }
                  : { to: (game.category === 'kalyan' ? `/kalyan/${game.id}` : `/game/${game.id}`), 'data-testid': `game-card-${game.id}` };

                // Kalyan — premium Matka-style card (distinct from gold Gali Disawar cards)
                if (game.category === 'kalyan') {
                  const kr = kalyanResults[game.id] || {};
                  const formatTime = (t) => {
                    const [h, m] = (t || '00:00').split(':').map(Number);
                    const ampm = h >= 12 ? 'PM' : 'AM';
                    const h12 = h % 12 || 12;
                    return `${h12}:${(m || 0).toString().padStart(2, '0')} ${ampm}`;
                  };
                  // Build the iconic Matka result line  XXX-XX-XXX
                  // Jodi partial display: only-Open → "6_", only-Close → "_0", both → "60"
                  const openP = kr.open_panna || '***';
                  const jodi = kr.jodi ||
                    (kr.open_ank && kr.close_ank ? `${kr.open_ank}${kr.close_ank}` :
                     kr.open_ank ? `${kr.open_ank}_` :
                     kr.close_ank ? `_${kr.close_ank}` :
                     '**');
                  const closeP = kr.close_panna || '***';
                  const isOpen = gameStatus.status === 'open';

                  return (
                    <CardWrapper key={game.id} {...cardProps}>
                      <div
                        className={`rounded-2xl overflow-hidden relative ${isDisabled ? 'opacity-70' : 'active:scale-[0.99]'}`}
                        style={{
                          background: 'linear-gradient(135deg, #2A0A0A 0%, #14142B 60%, #1A1A2E 100%)',
                          border: '2px solid #DC2626',
                          contain: 'content',
                        }}
                      >
                        {/* Red corner accent stripe (top-right) — Matka brand signal */}
                        <div
                          className="absolute top-0 right-0 w-20 h-20"
                          style={{
                            background: 'linear-gradient(135deg, transparent 50%, #DC2626 50%)',
                            pointerEvents: 'none',
                          }}
                        />

                        {/* Top row: Chart button + game name + status pill */}
                        <div className="flex items-center justify-between px-3 pt-3 relative">
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setHistoryGame(game); }}
                            data-testid={`chart-btn-${game.id}`}
                            aria-label={`${game.name} result chart`}
                            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 active:scale-90"
                            style={{ background: 'rgba(220, 38, 38, 0.18)', border: '1.5px solid #DC2626' }}
                          >
                            <BarChart3 className="w-4 h-4 text-[#FCA5A5]" strokeWidth={2.8} />
                          </button>

                          <h3
                            className="font-black text-base uppercase tracking-wider flex-1 text-center px-2 truncate"
                            style={{ color: '#FCA5A5', fontFamily: 'Outfit, sans-serif', letterSpacing: '0.05em' }}
                            data-testid={`kalyan-name-${game.id}`}
                          >
                            {game.name}
                          </h3>

                          {/* Status pill (top right corner) */}
                          <span
                            className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded leading-none z-10 relative"
                            style={{
                              background: isOpen ? '#16A34A' : '#7F1D1D',
                              color: '#FFFFFF',
                            }}
                          >
                            {isOpen ? 'Live' : 'Off'}
                          </span>
                        </div>

                        {/* Big Matka result line — iconic XXX-XX-XXX */}
                        <div className="px-3 py-3 flex items-center justify-center gap-1.5">
                          <span
                            className="font-black tabular-nums tracking-wider"
                            style={{
                              fontFamily: 'Outfit, monospace',
                              fontSize: '1.6rem',
                              color: '#34D399',
                              lineHeight: 1,
                            }}
                            data-testid={`kalyan-open-${game.id}`}
                          >
                            {openP}
                          </span>
                          <span className="text-[#FCA5A5] font-black text-2xl leading-none">-</span>
                          <span
                            className="font-black tabular-nums"
                            style={{
                              fontFamily: 'Outfit, monospace',
                              fontSize: '1.7rem',
                              color: '#FFD700',
                              lineHeight: 1,
                            }}
                            data-testid={`kalyan-jodi-${game.id}`}
                          >
                            {jodi}
                          </span>
                          <span className="text-[#FCA5A5] font-black text-2xl leading-none">-</span>
                          <span
                            className="font-black tabular-nums tracking-wider"
                            style={{
                              fontFamily: 'Outfit, monospace',
                              fontSize: '1.6rem',
                              color: '#F87171',
                              lineHeight: 1,
                            }}
                            data-testid={`kalyan-close-${game.id}`}
                          >
                            {closeP}
                          </span>
                        </div>

                        {/* Bottom row: time chips + Play button */}
                        <div
                          className="flex items-center justify-between px-3 py-2.5"
                          style={{
                            background: 'rgba(220, 38, 38, 0.08)',
                            borderTop: '1px solid rgba(220, 38, 38, 0.3)',
                          }}
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] uppercase tracking-widest font-bold leading-none" style={{ color: '#86EFAC' }}>
                              Open • {formatTime(game.open_time || game.start_time)}
                            </span>
                            <span className="text-[9px] uppercase tracking-widest font-bold leading-none" style={{ color: '#FCA5A5' }}>
                              Close • {formatTime(game.close_time || game.end_time)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className="text-[10px] font-black uppercase tracking-widest leading-none"
                              style={{ color: isOpen ? '#86EFAC' : '#FCA5A5' }}
                            >
                              {isOpen ? 'Bidding On' : 'Bidding Off'}
                            </span>
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center"
                              style={
                                isOpen
                                  ? { background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)', border: '2px solid #FCA5A5' }
                                  : { background: '#1F2937', border: '2px solid #4B5563' }
                              }
                              data-testid={`kalyan-play-${game.id}`}
                            >
                              {isOpen ? (
                                <Play className="w-4 h-4 text-white ml-0.5" fill="#FFFFFF" />
                              ) : (
                                <X className="w-5 h-5 text-gray-400" strokeWidth={3} />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardWrapper>
                  );
                }

                // Premium "Golden Ticket" card — completely redesigned for Gali/Disawar
                const statusLabel = game.is_holiday ? 'Holiday' : (gameStatus.status === 'open' ? 'Running' : 'Closed');
                const isRunning = !game.is_holiday && gameStatus.status === 'open';
                const fmt = (timeStr) => {
                  const [h, m] = (timeStr || '00:00').split(':').map(Number);
                  const ampm = h >= 12 ? 'PM' : 'AM';
                  const h12 = h % 12 || 12;
                  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
                };
                const openTimeStr = fmt(game.start_time);
                const closeTimeStr = fmt(game.end_time);
                // Compute today & yesterday dates in dd/mm/yyyy for LED panels
                const _todayDt = new Date();
                const _ydayDt = new Date(_todayDt); _ydayDt.setDate(_todayDt.getDate() - 1);
                const _fmtDate = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                const todayDateStr = _fmtDate(_todayDt);
                const yesterdayDateStr = _fmtDate(_ydayDt);
                return (
                  <CardWrapper key={game.id} {...cardProps}>
                    <div
                      className={`rounded-2xl relative overflow-hidden ${
                        isDisabled ? 'opacity-95 cursor-not-allowed' : 'active:scale-[0.98] cursor-pointer'
                      }`}
                      style={{
                        background: 'linear-gradient(135deg, #0B0F1F 0%, #0A0A14 50%, #0F0B1E 100%)',
                        border: '1px solid rgba(20, 169, 76, 0.4)',
                        boxShadow: isRunning
                          ? '0 6px 22px rgba(20, 169, 76, 0.22), inset 0 1px 0 rgba(20, 169, 76, 0.18), 0 0 0 1px rgba(255, 215, 0, 0.12)'
                          : '0 2px 8px rgba(0, 0, 0, 0.5)',
                        contain: 'content',
                      }}
                    >
                      {/* Neon vertical accent bar (left edge) — replaces old gold band */}
                      <div
                        className="absolute top-0 bottom-0 left-0 w-1"
                        style={{
                          background: isRunning
                            ? 'linear-gradient(180deg, #FFD700 0%, #14A94C 50%, #FFD700 100%)'
                            : 'linear-gradient(180deg, #4B5563 0%, #1F2937 100%)',
                          boxShadow: isRunning ? '0 0 12px rgba(20, 169, 76, 0.6)' : 'none',
                        }}
                      />
                      {/* Ambient glow orb (top-right) */}
                      <div
                        className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none"
                        style={{
                          background: isRunning
                            ? 'radial-gradient(circle, rgba(20, 169, 76, 0.28) 0%, transparent 65%)'
                            : 'radial-gradient(circle, rgba(107, 114, 128, 0.12) 0%, transparent 65%)',
                          filter: 'blur(4px)',
                        }}
                      />

                      {/* ── HEADER — Chart btn + Game name + Jantri chip ── */}
                      <div className="relative flex items-center gap-2 px-3 pt-3 pb-2">
                        {/* Chart btn */}
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setHistoryGame(game); }}
                          data-testid={`chart-btn-${game.id}`}
                          aria-label={`${game.name_hi} result chart`}
                          className="relative w-8 h-8 rounded-full flex items-center justify-center shrink-0 active:scale-90"
                          style={{
                            background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.2) 0%, transparent 45%), conic-gradient(from 180deg, #14A94C, #22C55E, #14A94C, #22C55E, #14A94C)',
                            border: '1.5px solid #22C55E',
                            boxShadow: '0 0 0 2px rgba(0,0,0,0.6), 0 3px 8px rgba(20, 169, 76, 0.5)',
                          }}
                        >
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center"
                            style={{ background: 'radial-gradient(circle at 30% 30%, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.9) 100%)' }}
                          >
                            <BarChart3 className="w-3.5 h-3.5 text-[#4ADE80]" strokeWidth={2.8} />
                          </div>
                        </button>

                        <h4
                          className="relative flex-1 text-[15px] font-black tracking-tight truncate"
                          style={{
                            color: '#FFFFFF',
                            fontFamily: 'Outfit, Noto Sans Devanagari, sans-serif',
                            textShadow: isRunning ? '0 0 8px rgba(20, 169, 76, 0.5)' : 'none',
                          }}
                          data-testid={`game-name-${game.id}`}
                        >
                          {game.name_hi}
                        </h4>

                        {/* JANTRI chip */}
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setJantriGame(game); }}
                          data-testid={`jantri-btn-${game.id}`}
                          aria-label={`${game.name_hi} jantri report`}
                          className="relative shrink-0 flex items-center gap-1 px-2 py-1 rounded-md active:scale-95 border"
                          style={{
                            background: 'linear-gradient(180deg, rgba(255, 215, 0, 0.12) 0%, rgba(0, 0, 0, 0.5) 100%)',
                            borderColor: 'rgba(255, 215, 0, 0.6)',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,215,0,0.15)',
                          }}
                        >
                          <Flame className="w-3 h-3 text-orange-400" strokeWidth={3} />
                          <span className="text-[9px] font-black text-[#FFD700] uppercase tracking-widest leading-none">
                            Jantri
                          </span>
                        </button>
                      </div>

                      {/* ── BODY — LED-style Yesterday + Today (dates) with Play/Timeout on RIGHT side ── */}
                      <div className="relative px-3 pt-1 pb-2 flex items-stretch gap-2">
                        {/* Yesterday panel (with date dd/mm/yyyy) */}
                        <div
                          className="flex-1 rounded-lg px-2 py-2 flex flex-col items-center justify-center relative overflow-hidden"
                          style={{
                            background:
                              'linear-gradient(180deg, rgba(0, 0, 0, 0.7) 0%, rgba(6, 20, 12, 0.6) 100%)',
                            border: '1px solid rgba(20, 169, 76, 0.45)',
                            boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.7), inset 0 -1px 0 rgba(20, 169, 76, 0.2)',
                          }}
                          data-testid={`yesterday-result-${game.id}`}
                        >
                          <span className="text-[8px] tracking-wider text-emerald-400/85 leading-none font-black tabular-nums">
                            {yesterdayDateStr}
                          </span>
                          <span
                            className="font-black leading-none tabular-nums mt-1.5"
                            style={{
                              fontFamily: '"Digital-7", "Outfit", monospace',
                              fontSize: '1.55rem',
                              letterSpacing: '0.08em',
                              color: '#4ADE80',
                              textShadow: '0 0 10px rgba(74, 222, 128, 0.8), 0 0 20px rgba(20, 169, 76, 0.4)',
                            }}
                          >
                            {game.yesterday_result?.jodi || '--'}
                          </span>
                        </div>

                        {/* Today panel (with date dd/mm/yyyy) */}
                        <div
                          className={`flex-1 rounded-lg px-2 py-2 flex flex-col items-center justify-center relative overflow-hidden ${flashGameIds.has(game.id) ? 'today-result-flash' : ''}`}
                          style={{
                            background:
                              'linear-gradient(180deg, rgba(0, 0, 0, 0.7) 0%, rgba(20, 14, 6, 0.6) 100%)',
                            border: `1px solid ${isRunning ? 'rgba(255, 215, 0, 0.65)' : 'rgba(255, 215, 0, 0.28)'}`,
                            boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.7), inset 0 -1px 0 rgba(255, 215, 0, 0.2)',
                          }}
                          data-testid={`today-result-${game.id}`}
                        >
                          {isRunning && (
                            <span className="absolute -top-1.5 -right-1 flex items-center gap-1 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider leading-none shadow-lg">
                              <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                              Live
                            </span>
                          )}
                          <span className="text-[8px] tracking-wider text-yellow-300/90 leading-none font-black tabular-nums">
                            {todayDateStr}
                          </span>
                          <span
                            className="font-black leading-none tabular-nums mt-1.5"
                            style={{
                              fontFamily: '"Digital-7", "Outfit", monospace',
                              fontSize: '1.55rem',
                              letterSpacing: '0.08em',
                              color: '#FFD700',
                              textShadow: '0 0 10px rgba(255, 215, 0, 0.8), 0 0 20px rgba(212, 175, 55, 0.4)',
                            }}
                          >
                            {game.today_result?.jodi || '--'}
                          </span>
                        </div>

                        {/* Play / Timeout / Holiday — moved to RIGHT side */}
                        <div className="flex flex-col items-center justify-center w-14 shrink-0" data-testid={`play-status-${game.id}`}>
                          {game.is_holiday ? (
                            <div
                              className="w-12 h-12 rounded-full flex items-center justify-center"
                              style={{ background: 'linear-gradient(135deg, #FBBF24 0%, #D97706 100%)', boxShadow: '0 4px 14px rgba(217,119,6,0.45)' }}
                              data-testid={`holiday-btn-${game.id}`}
                            >
                              <span className="text-white font-black text-lg">H</span>
                            </div>
                          ) : isRunning ? (
                            <div
                              className="play-btn-premium w-12 h-12 rounded-full flex items-center justify-center relative"
                              onClick={() => { try { navigator.vibrate?.([25, 10, 25]); } catch (_) { /* haptic api unavailable */ } speak('प्ले'); }}
                              data-testid={`play-btn-${game.id}`}
                              style={{ filter: 'drop-shadow(0 6px 14px rgba(20, 169, 76, 0.7))' }}
                            >
                              <div className="chip-stripes absolute inset-0 rounded-full" style={{ background: 'conic-gradient(from 45deg, #FFD700 0deg 45deg, #14A94C 45deg 90deg, #FFD700 90deg 135deg, #14A94C 135deg 180deg, #FFD700 180deg 225deg, #14A94C 225deg 270deg, #FFD700 270deg 315deg, #14A94C 315deg 360deg)' }} />
                              <div className="absolute rounded-full" style={{ inset: '3px', background: '#FFFFFF' }} />
                              <div
                                className="absolute rounded-full flex items-center justify-center"
                                style={{
                                  inset: '5px',
                                  background:
                                    'radial-gradient(circle at 35% 30%, #86EFAC 0%, #22C55E 30%, #14A94C 70%, #052E16 100%)',
                                  boxShadow:
                                    'inset 0 2px 3px rgba(255,255,255,0.4), inset 0 -3px 5px rgba(0,0,0,0.4)',
                                }}
                              >
                                <Play
                                  className="w-5 h-5 ml-0.5 relative"
                                  fill="#FFD700"
                                  stroke="#FFF"
                                  strokeWidth={1.5}
                                  style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.7))' }}
                                />
                              </div>
                            </div>
                          ) : (
                            // Casino-style TIME UP hourglass badge
                            <div
                              className="w-12 h-12 rounded-full flex items-center justify-center relative overflow-hidden"
                              style={{
                                background: 'radial-gradient(circle at 32% 28%, #4B5563 0%, #1F2937 40%, #0F172A 100%)',
                                border: '2px solid rgba(148, 163, 184, 0.5)',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5), inset 0 2px 3px rgba(255, 255, 255, 0.1), inset 0 -3px 4px rgba(0, 0, 0, 0.5)',
                              }}
                              data-testid={`timeout-btn-${game.id}`}
                              onClick={() => { try { navigator.vibrate?.(15); } catch (_) { /* haptic api unavailable */ } }}
                            >
                              {/* Diagonal red stripes overlay */}
                              <div className="absolute inset-0 opacity-20 pointer-events-none"
                                   style={{ background: 'repeating-linear-gradient(45deg, transparent 0 3px, #DC2626 3px 4px)' }} />
                              <svg viewBox="0 0 24 24" className="w-6 h-6 relative" fill="none" stroke="#FCA5A5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M17 2v4.172a2 2 0 0 1-.586 1.414L12 12 7.586 7.586A2 2 0 0 1 7 6.172V2" />
                              </svg>
                            </div>
                          )}
                          <span
                            className={`text-[8px] font-black tracking-widest uppercase leading-none mt-1 ${
                              game.is_holiday ? 'text-[#FBBF24]' : isRunning ? 'text-[#4ADE80]' : 'text-[#F87171]'
                            }`}
                          >
                            {game.is_holiday ? statusLabel : isRunning ? statusLabel : 'Time Up'}
                          </span>
                        </div>
                      </div>

                      {/* ── FOOTER — Open / Close timeline ── */}
                      <div
                        className="flex items-center px-3 py-1.5 gap-3"
                        style={{
                          background: 'rgba(0, 0, 0, 0.55)',
                          borderTop: '1px dashed rgba(20, 169, 76, 0.3)',
                        }}
                      >
                        <div className="flex items-center gap-1 flex-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 5px #4ADE80' }} />
                          <span className="text-[8px] uppercase tracking-wider text-emerald-300 font-black leading-none">Open</span>
                          <span className="text-[10px] font-bold text-white tabular-nums leading-none">{openTimeStr}</span>
                        </div>
                        <div className="w-px h-3 bg-white/15" />
                        <div className="flex items-center gap-1 flex-1 justify-end">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400" style={{ boxShadow: '0 0 5px #F87171' }} />
                          <span className="text-[8px] uppercase tracking-wider text-red-300 font-black leading-none">Close</span>
                          <span className="text-[10px] font-bold text-white tabular-nums leading-none">{closeTimeStr}</span>
                        </div>
                      </div>
                    </div>
                  </CardWrapper>
                );
              })}
            </div>
          )}
          </>
          )}
        </div>
      </div>
      <SidebarMenu open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <FooterNav />
      {historyGame && (
        <GameHistoryModal game={historyGame} onClose={() => setHistoryGame(null)} />
      )}
      {jantriGame && (
        <JantriModal game={jantriGame} onClose={() => setJantriGame(null)} />
      )}
    </div>
  );
};

export default DashboardPage;
