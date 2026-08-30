-- Migration: Create user_exercise_stats table for per-game leaderboards & leveling
-- Each exercise tracks independent points, levels, and match statistics.

CREATE TABLE IF NOT EXISTS public.user_exercise_stats (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
    points INTEGER NOT NULL DEFAULT 0,
    matches_played INTEGER NOT NULL DEFAULT 0,
    matches_won INTEGER NOT NULL DEFAULT 0,
    matches_drawn INTEGER NOT NULL DEFAULT 0,
    matches_lost INTEGER NOT NULL DEFAULT 0,
    reps_completed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, exercise_id)
);

-- Fast composite index for exercise leaderboard rankings
CREATE INDEX IF NOT EXISTS idx_user_exercise_stats_leaderboard 
ON public.user_exercise_stats(exercise_id, points DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_exercise_stats ENABLE ROW LEVEL SECURITY;

-- Allow public read access to exercise stats for leaderboard views
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_exercise_stats' AND policyname = 'Exercise stats are viewable by everyone'
  ) THEN
    CREATE POLICY "Exercise stats are viewable by everyone"
      ON public.user_exercise_stats
      FOR SELECT
      TO authenticated, anon
      USING (true);
  END IF;
END $$;

-- Allow users to insert/update their own exercise stats
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_exercise_stats' AND policyname = 'Users can manage their own exercise stats'
  ) THEN
    CREATE POLICY "Users can manage their own exercise stats"
      ON public.user_exercise_stats
      FOR ALL
      TO authenticated
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END $$;

-- Stored procedure to atomically record match results for a specific exercise
CREATE OR REPLACE FUNCTION public.record_exercise_match_result(
    p_user_id UUID,
    p_exercise_id TEXT,
    p_result TEXT,
    p_reps INTEGER DEFAULT 0
)
RETURNS public.user_exercise_stats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stats public.user_exercise_stats;
    v_pts_delta INTEGER := 0;
    v_won_inc INTEGER := 0;
    v_drawn_inc INTEGER := 0;
    v_lost_inc INTEGER := 0;
BEGIN
    IF p_result = 'win' THEN
        v_pts_delta := 10;
        v_won_inc := 1;
    ELSIF p_result = 'draw' THEN
        v_pts_delta := 5;
        v_drawn_inc := 1;
    ELSIF p_result = 'defeat' OR p_result = 'loss' THEN
        v_pts_delta := -10;
        v_lost_inc := 1;
    END IF;

    -- Upsert per-exercise stats
    INSERT INTO public.user_exercise_stats (
        user_id,
        exercise_id,
        points,
        matches_played,
        matches_won,
        matches_drawn,
        matches_lost,
        reps_completed,
        updated_at
    )
    VALUES (
        p_user_id,
        p_exercise_id,
        GREATEST(0, v_pts_delta),
        1,
        v_won_inc,
        v_drawn_inc,
        v_lost_inc,
        GREATEST(0, p_reps),
        NOW()
    )
    ON CONFLICT (user_id, exercise_id) DO UPDATE SET
        points = GREATEST(0, public.user_exercise_stats.points + v_pts_delta),
        matches_played = public.user_exercise_stats.matches_played + 1,
        matches_won = public.user_exercise_stats.matches_won + v_won_inc,
        matches_drawn = public.user_exercise_stats.matches_drawn + v_drawn_inc,
        matches_lost = public.user_exercise_stats.matches_lost + v_lost_inc,
        reps_completed = public.user_exercise_stats.reps_completed + GREATEST(0, p_reps),
        updated_at = NOW()
    RETURNING * INTO v_stats;

    -- Also update total squats on profiles table if exercise is Squats ('1')
    IF p_exercise_id = '1' AND p_reps > 0 THEN
        UPDATE public.profiles
        SET total_squats = total_squats + p_reps, updated_at = NOW()
        WHERE id = p_user_id;
    END IF;

    RETURN v_stats;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.record_exercise_match_result(UUID, TEXT, TEXT, INTEGER) TO authenticated, anon;
