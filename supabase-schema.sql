-- ============================================
-- TABLES À INSÉRER DANS SUPABASE
-- Exécutez ces requêtes dans l'ordre dans
-- Supabase > SQL Editor > New Query
-- ============================================

-- ============================================
-- ÉTAPE 1: Créer la table PROFILES
-- ============================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credential_id UUID REFERENCES public.app_credentials(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    initials VARCHAR(2) NOT NULL,
    color VARCHAR(7) DEFAULT '#3B82F6',
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances des requêtes par credential_id
CREATE INDEX IF NOT EXISTS idx_profiles_credential_id ON public.profiles(credential_id);

-- Activer RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Supprimer les policies existantes (si elles existent)
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;

-- Policies (accès public)
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (true);
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE USING (true);

-- ============================================
-- ÉTAPE 2: Insérer les 4 profils utilisateurs
-- ============================================

INSERT INTO public.profiles (name, initials, color, avatar_url)
VALUES
    ('Eva', 'EV', '#EC4899', '/users/eva.jpg'),
    ('Niel', 'NI', '#3B82F6', '/users/niel.jpg'),
    ('Clémentine', 'CL', '#F59E0B', '/users/clementine.jpg'),
    ('Grégory', 'GR', '#22C55E', '/users/gregory.jpg');

-- ============================================
-- ÉTAPE 3: Modifier la table POINTS existante
-- (ajouter les colonnes manquantes)
-- ============================================

ALTER TABLE public.points
    ADD COLUMN IF NOT EXISTS credential_id UUID REFERENCES public.app_credentials(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_points_profile_id ON public.points(profile_id);
CREATE INDEX IF NOT EXISTS idx_points_credential_id ON public.points(credential_id);

-- ============================================
-- ÉTAPE 4: Activer le Realtime sur la table POINTS
-- ============================================

-- Activer la réplication pour le temps réel
ALTER PUBLICATION supabase_realtime ADD TABLE public.points;

-- ============================================
-- VÉRIFICATION: Afficher les profils créés
-- ============================================

SELECT * FROM public.profiles;

-- ============================================
-- ÉTAPE 5: Créer la table APP_CREDENTIALS
-- (pour l'authentification)
-- ============================================

CREATE TABLE IF NOT EXISTS public.app_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username_hash VARCHAR(64) NOT NULL,
    password_hash VARCHAR(64) NOT NULL,
    family_name VARCHAR(100) DEFAULT 'Famille',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activer RLS
ALTER TABLE public.app_credentials ENABLE ROW LEVEL SECURITY;

-- Policies (lecture et insertion pour l'authentification)
DROP POLICY IF EXISTS "credentials_select" ON public.app_credentials;
DROP POLICY IF EXISTS "credentials_insert" ON public.app_credentials;
CREATE POLICY "credentials_select" ON public.app_credentials FOR SELECT USING (true);
CREATE POLICY "credentials_insert" ON public.app_credentials FOR INSERT WITH CHECK (true);

-- Insérer les identifiants (hachés SHA-256)
-- Email: gregory.baudic@hotmail.fr (hashé)
-- Mot de passe: identique à celui que vous utilisez actuellement
INSERT INTO public.app_credentials (username_hash, password_hash, family_name)
VALUES (
    'ca73b9184d32b7fe2eab3a8b34e2bfeb7977aa827afc56d8be980cdde002b5a1',
    'c07abca79371b3a9105df817c4473d0c19b03ace5a6bbc4d34ebaebb6d575aba',
    'Baudic Semete'
);

-- ============================================
-- OPTIONNEL: Assigner les points existants à Clémentine
-- (décommentez si vous avez des points sans profile_id)
-- ============================================

-- UPDATE public.points
-- SET profile_id = (SELECT id FROM public.profiles WHERE name = 'Clémentine' LIMIT 1)
-- WHERE profile_id IS NULL;

-- ============================================
-- ÉTAPE 6: Migration - Ajouter avatar_url aux profils existants
-- (Exécuter si la table profiles existe déjà)
-- ============================================

-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- UPDATE public.profiles SET avatar_url = '/users/eva.jpg' WHERE name = 'Eva';
-- UPDATE public.profiles SET avatar_url = '/users/niel.jpg' WHERE name = 'Niel';
-- UPDATE public.profiles SET avatar_url = '/users/clementine.jpg' WHERE name = 'Clémentine';
-- UPDATE public.profiles SET avatar_url = '/users/gregory.jpg' WHERE name = 'Grégory';

-- ============================================
-- ÉTAPE 7: Créer le bucket Storage pour les avatars
-- (À exécuter dans Supabase SQL Editor)
-- ============================================

-- Créer le bucket 'avatars' pour stocker les images de profil
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Policies pour le bucket avatars (accès public en lecture, authentifié pour écriture)
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload an avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update their avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete their avatar" ON storage.objects;

CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Anyone can upload an avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Anyone can update their avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars');

CREATE POLICY "Anyone can delete their avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars');
