-- Pseudo : unicité insensible à la casse, caractères [a-zA-Z0-9._-] (3-30), aligné sur l’app
-- + trigger nouveau compte : pseudo provisoire unique (plus de « Invité » partagé)

-- 1) Données existantes : pseudo invalide ou trop court/long → identifiant dérivé du compte
UPDATE public.profiles
SET
  display_name = 'u_' || substr(replace(id::text, '-', ''), 1, 12)
WHERE
  trim(display_name) !~ '^[a-zA-Z0-9._-]+$'
  OR char_length(trim(display_name)) < 3
  OR char_length(trim(display_name)) > 30;

-- 2) Doublons (même pseudo après normalisation) : garder le plus ancien, renommer les autres
WITH
  ranked AS (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY
          lower(trim(display_name))
        ORDER BY
          created_at ASC,
          id ASC
      ) AS rn
    FROM
      public.profiles
  )
UPDATE public.profiles p
SET
  display_name = 'u_' || substr(replace(p.id::text, '-', ''), 1, 12)
FROM
  ranked r
WHERE
  p.id = r.id
  AND r.rn > 1;

-- 3) Contrainte longueur / motif
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_display_name_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_display_name_check CHECK (
  char_length(trim(display_name)) BETWEEN 3 AND 30
  AND trim(display_name) ~ '^[a-zA-Z0-9._-]+$'
);

-- 4) Unicité fonctionnelle (insensible à la casse)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_display_name_lower_uidx ON public.profiles (lower(trim(display_name)));

-- 5) Nouveaux comptes
CREATE OR REPLACE FUNCTION public.handle_new_user ()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cand text;
  final_name text;
  fallback text;
BEGIN
  fallback := 'u_' || substr(replace(NEW.id::text, '-', ''), 1, 12);
  final_name := fallback;

  cand := NULLIF(trim(split_part(COALESCE(NEW.email, ''), '@', 1)), '');
  IF
    cand IS NOT NULL
    AND char_length(cand) BETWEEN 3 AND 30
    AND cand ~ '^[a-zA-Z0-9._-]+$'
  THEN
    final_name := cand;
  ELSE
    cand := NULLIF(trim(NEW.raw_user_meta_data ->> 'display_name'), '');
    IF
      cand IS NOT NULL
      AND char_length(cand) BETWEEN 3 AND 30
      AND cand ~ '^[a-zA-Z0-9._-]+$'
    THEN
      final_name := cand;
    END IF;
  END IF;

  BEGIN
    INSERT INTO public.profiles (id, display_name)
    VALUES (NEW.id, final_name);
  EXCEPTION
    WHEN unique_violation THEN
      INSERT INTO public.profiles (id, display_name)
      VALUES (NEW.id, fallback);
  END;

  RETURN NEW;
END;
$$;
