-- Migration: Add points, draw, and loss tracking to profiles table
-- Rules: Win = +10 pts, Draw = +5 pts, Defeat = -10 pts (min 0)

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS matches_drawn INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS matches_lost INTEGER DEFAULT 0 NOT NULL;

-- Fast index for leaderboard rankings
CREATE INDEX IF NOT EXISTS idx_profiles_points ON public.profiles(points DESC);

-- Stored function for secure and atomic match result recording
CREATE OR REPLACE FUNCTION public.record_match_result(
    p_user_id UUID,
    p_result TEXT
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile public.profiles;
    v_pts_delta INTEGER := 0;
BEGIN
    IF p_result = 'win' THEN
        v_pts_delta := 10;
        UPDATE public.profiles
        SET 
            points = points + v_pts_delta,
            matches_played = matches_played + 1,
            matches_won = matches_won + 1,
            updated_at = NOW()
        WHERE id = p_user_id
        RETURNING * INTO v_profile;
    ELSIF p_result = 'draw' THEN
        v_pts_delta := 5;
        UPDATE public.profiles
        SET 
            points = points + v_pts_delta,
            matches_played = matches_played + 1,
            matches_drawn = matches_drawn + 1,
            updated_at = NOW()
        WHERE id = p_user_id
        RETURNING * INTO v_profile;
    ELSIF p_result = 'defeat' OR p_result = 'loss' THEN
        v_pts_delta := -10;
        UPDATE public.profiles
        SET 
            points = GREATEST(0, points + v_pts_delta),
            matches_played = matches_played + 1,
            matches_lost = matches_lost + 1,
            updated_at = NOW()
        WHERE id = p_user_id
        RETURNING * INTO v_profile;
    ELSE
        SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
    END IF;

    RETURN v_profile;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.record_match_result(UUID, TEXT) TO authenticated, anon;
