import { useState, useRef, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { supabase } from '../services/supabaseClient';

// Couleurs prédéfinies pour les profils
const PRESET_COLORS = [
  // Rouges / Roses
  '#EF4444', '#F87171', '#EC4899', '#F472B6',
  // Oranges / Jaunes
  '#F97316', '#FB923C', '#F59E0B', '#FBBF24',
  // Verts
  '#22C55E', '#4ADE80', '#10B981', '#34D399',
  // Bleus / Cyans
  '#3B82F6', '#60A5FA', '#06B6D4', '#22D3EE',
  // Violets
  '#8B5CF6', '#A78BFA', '#A855F7', '#C084FC',
  // Neutres
  '#6B7280', '#9CA3AF', '#78716C', '#A8A29E',
];

// Convertir HEX en HSL
function hexToHsl(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 100, l: 50 };

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
      default: h = 0;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// Convertir HSL en HEX
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

// Composant Color Picker
function ColorPicker({ color, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hsl, setHsl] = useState(() => hexToHsl(color));
  const pickerRef = useRef(null);

  useEffect(() => {
    setHsl(hexToHsl(color));
  }, [color]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleHslChange = (key, value) => {
    const newHsl = { ...hsl, [key]: value };
    setHsl(newHsl);
    onChange(hslToHex(newHsl.h, newHsl.s, newHsl.l));
  };

  return (
    <div className="relative" ref={pickerRef}>
      <label className="block text-sm font-medium text-grey-700 mb-2">
        Couleur
      </label>

      {/* Bouton d'ouverture */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-3 py-2 border border-grey-300 rounded-lg hover:border-grey-400 transition-colors"
      >
        <div
          className="w-8 h-8 rounded-full border-2 border-white shadow-md"
          style={{ backgroundColor: color }}
        />
        <span className="text-sm text-grey-600 font-mono">{color}</span>
        <svg className={`w-4 h-4 text-grey-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Panel du color picker */}
      {isOpen && (
        <div className="absolute z-10 mt-2 p-4 bg-white rounded-xl shadow-xl border border-grey-200 w-72">
          {/* Couleurs prédéfinies */}
          <div className="mb-4">
            <p className="text-xs text-grey-500 mb-2">Couleurs suggérées</p>
            <div className="grid grid-cols-8 gap-1.5">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  type="button"
                  onClick={() => {
                    onChange(presetColor);
                    setHsl(hexToHsl(presetColor));
                  }}
                  className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${
                    color.toUpperCase() === presetColor ? 'border-grey-800 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: presetColor }}
                />
              ))}
            </div>
          </div>

          {/* Séparateur */}
          <div className="border-t border-grey-200 my-3" />

          {/* Sliders HSL */}
          <div className="space-y-3">
            {/* Teinte */}
            <div>
              <div className="flex justify-between text-xs text-grey-500 mb-1">
                <span>Teinte</span>
                <span>{hsl.h}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                value={hsl.h}
                onChange={(e) => handleHslChange('h', parseInt(e.target.value))}
                className="w-full h-3 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right,
                    hsl(0, ${hsl.s}%, ${hsl.l}%),
                    hsl(60, ${hsl.s}%, ${hsl.l}%),
                    hsl(120, ${hsl.s}%, ${hsl.l}%),
                    hsl(180, ${hsl.s}%, ${hsl.l}%),
                    hsl(240, ${hsl.s}%, ${hsl.l}%),
                    hsl(300, ${hsl.s}%, ${hsl.l}%),
                    hsl(360, ${hsl.s}%, ${hsl.l}%))`
                }}
              />
            </div>

            {/* Saturation */}
            <div>
              <div className="flex justify-between text-xs text-grey-500 mb-1">
                <span>Saturation</span>
                <span>{hsl.s}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={hsl.s}
                onChange={(e) => handleHslChange('s', parseInt(e.target.value))}
                className="w-full h-3 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right,
                    hsl(${hsl.h}, 0%, ${hsl.l}%),
                    hsl(${hsl.h}, 100%, ${hsl.l}%))`
                }}
              />
            </div>

            {/* Luminosité */}
            <div>
              <div className="flex justify-between text-xs text-grey-500 mb-1">
                <span>Luminosité</span>
                <span>{hsl.l}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="90"
                value={hsl.l}
                onChange={(e) => handleHslChange('l', parseInt(e.target.value))}
                className="w-full h-3 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right,
                    hsl(${hsl.h}, ${hsl.s}%, 10%),
                    hsl(${hsl.h}, ${hsl.s}%, 50%),
                    hsl(${hsl.h}, ${hsl.s}%, 90%))`
                }}
              />
            </div>
          </div>

          {/* Input HEX manuel */}
          <div className="mt-3 pt-3 border-t border-grey-200">
            <div className="flex items-center gap-2">
              <span className="text-xs text-grey-500">HEX:</span>
              <input
                type="text"
                value={color}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                    onChange(val.toUpperCase());
                    setHsl(hexToHsl(val));
                  }
                }}
                className="flex-1 px-2 py-1 text-sm font-mono border border-grey-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                placeholder="#000000"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Upload une image vers Supabase Storage
async function uploadAvatar(file, profileId) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${profileId}-${Date.now()}.${fileExt}`;
  const filePath = `${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    console.error('Erreur upload:', uploadError);
    return null;
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
  return data.publicUrl;
}

function ProfileCard({ profile, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [color, setColor] = useState(profile.color || '#3B82F6');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const fileInputRef = useRef(null);

  // Synchroniser les états locaux quand le profil change (après mise à jour)
  useEffect(() => {
    setColor(profile.color || '#3B82F6');
    setAvatarUrl(profile.avatar_url || '');
    setImageError(false); // Reset l'erreur quand l'URL change
  }, [profile.color, profile.avatar_url]);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Vérifier le type de fichier
    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner une image');
      return;
    }

    // Vérifier la taille (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('L\'image ne doit pas dépasser 2 Mo');
      return;
    }

    setUploading(true);
    const url = await uploadAvatar(file, profile.id);
    setUploading(false);

    if (url) {
      setAvatarUrl(url);
    } else {
      alert('Erreur lors de l\'upload de l\'image');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(profile.id, { color, avatar_url: avatarUrl || null });
    setSaving(false);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setColor(profile.color || '#3B82F6');
    setAvatarUrl(profile.avatar_url || '');
    setIsEditing(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-grey-200 p-4 sm:p-6">
      {/* Header avec avatar et nom - toujours horizontal */}
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {avatarUrl && !imageError ? (
            <img
              src={avatarUrl}
              alt={profile.name}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-4"
              style={{ borderColor: color }}
              onError={() => setImageError(true)}
            />
          ) : (
            <div
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-white text-lg sm:text-xl font-bold"
              style={{ backgroundColor: color }}
            >
              {profile.initials}
            </div>
          )}
        </div>

        {/* Nom et initiales */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-grey-800 truncate">{profile.name}</h3>
          <p className="text-sm text-grey-500">Initiales: {profile.initials}</p>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="mt-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Modifier
            </button>
          )}
        </div>
      </div>

      {/* Formulaire d'édition - pleine largeur sous le header */}
      {isEditing && (
        <div className="mt-4 pt-4 border-t border-grey-100 space-y-4">
          {/* Sélection de couleur avec Color Picker */}
          <ColorPicker color={color} onChange={setColor} />

          {/* Upload d'image */}
          <div>
            <label className="block text-sm font-medium text-grey-700 mb-2">
              Photo de profil
            </label>

            {/* Input file caché */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Aperçu et boutons */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Aperçu */}
              <div className="flex items-center gap-3">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Aperçu"
                    className="w-12 h-12 rounded-full object-cover border-2 flex-shrink-0"
                    style={{ borderColor: color }}
                  />
                ) : (
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {profile.initials}
                  </div>
                )}

                {/* Boutons d'upload - sur la même ligne que l'aperçu */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="px-3 py-1.5 text-sm border border-grey-300 rounded-lg hover:bg-grey-50 disabled:opacity-50 whitespace-nowrap"
                  >
                    {uploading ? 'Upload...' : 'Choisir'}
                  </button>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 whitespace-nowrap"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs text-grey-400">
              JPG, PNG ou GIF. Max 2 Mo.
            </p>
          </div>

          {/* Boutons d'action */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 sm:flex-none px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 sm:flex-none px-4 py-2 bg-grey-100 text-grey-700 text-sm font-medium rounded-lg hover:bg-grey-200"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfileSettings({ onClose }) {
  const { profiles, updateProfile } = useUser();

  // Bloquer le scroll du body quand la modal est ouverte (fix mobile)
  useEffect(() => {
    // Sauvegarder la position de scroll actuelle
    const scrollY = window.scrollY;

    // Bloquer le body
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.overflow = 'hidden';

    return () => {
      // Restaurer le body
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
      // Restaurer la position de scroll
      window.scrollTo(0, scrollY);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" onClick={onClose}>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50" />

      {/* Modal */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div
          className="relative bg-paris-background shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white border-b border-grey-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-grey-800">Gestion des profils</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-grey-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-grey-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {profiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                onUpdate={updateProfile}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
