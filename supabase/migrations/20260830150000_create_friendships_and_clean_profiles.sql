-- =============================================================================
-- Migration: Clean profiles table and create friendships system
-- =============================================================================

-- 1. Remove game stats columns from profiles (stats are now in user_exercise_stats)
ALTER TABLE public.profiles
DROP COLUMN IF EXISTS points,
DROP COLUMN IF EXISTS matches_played,
DROP COLUMN IF EXISTS matches_won,
DROP COLUMN IF EXISTS matches_drawn,
DROP COLUMN IF EXISTS matches_lost,
DROP COLUMN IF EXISTS total_squats;

-- 2. Create friendships table
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')) DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_friendship_pair UNIQUE (sender_id, receiver_id),
    CONSTRAINT no_self_friending CHECK (sender_id <> receiver_id)
);

-- 3. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_friendships_sender ON public.friendships(sender_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_receiver ON public.friendships(receiver_id, status);

-- 4. Enable Row Level Security
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "Users can view their friendships" ON public.friendships;
CREATE POLICY "Users can view their friendships"
ON public.friendships FOR SELECT TO authenticated
USING ((select auth.uid()) = sender_id OR (select auth.uid()) = receiver_id);

DROP POLICY IF EXISTS "Users can send friend requests" ON public.friendships;
CREATE POLICY "Users can send friend requests"
ON public.friendships FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) = sender_id);

DROP POLICY IF EXISTS "Users can update their friendships" ON public.friendships;
CREATE POLICY "Users can update their friendships"
ON public.friendships FOR UPDATE TO authenticated
USING ((select auth.uid()) = sender_id OR (select auth.uid()) = receiver_id)
WITH CHECK ((select auth.uid()) = sender_id OR (select auth.uid()) = receiver_id);

DROP POLICY IF EXISTS "Users can delete their friendships" ON public.friendships;
CREATE POLICY "Users can delete their friendships"
ON public.friendships FOR DELETE TO authenticated
USING ((select auth.uid()) = sender_id OR (select auth.uid()) = receiver_id);

-- 6. RPC: Send friend request by username
CREATE OR REPLACE FUNCTION public.send_friend_request_by_username(
    p_sender_id UUID,
    p_receiver_username TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_receiver_id UUID;
    v_existing_status TEXT;
    v_new_id UUID;
BEGIN
    -- Look up receiver by username (case-insensitive)
    SELECT id INTO v_receiver_id
    FROM public.profiles
    WHERE LOWER(TRIM(username)) = LOWER(TRIM(p_receiver_username));

    IF v_receiver_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Athlete with username "' || p_receiver_username || '" not found.');
    END IF;

    IF v_receiver_id = p_sender_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'You cannot send a friend request to yourself.');
    END IF;

    -- Check if friendship already exists
    SELECT status INTO v_existing_status
    FROM public.friendships
    WHERE (sender_id = p_sender_id AND receiver_id = v_receiver_id)
       OR (sender_id = v_receiver_id AND receiver_id = p_sender_id);

    IF v_existing_status = 'accepted' THEN
        RETURN jsonb_build_object('success', false, 'error', 'You are already friends with this athlete.');
    ELSIF v_existing_status = 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error', 'A friend request is already pending between you two.');
    ELSIF v_existing_status = 'blocked' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unable to send friend request.');
    END IF;

    -- Insert or re-open request
    INSERT INTO public.friendships (sender_id, receiver_id, status, updated_at)
    VALUES (p_sender_id, v_receiver_id, 'pending', NOW())
    ON CONFLICT (sender_id, receiver_id) DO UPDATE SET status = 'pending', updated_at = NOW()
    RETURNING id INTO v_new_id;

    RETURN jsonb_build_object('success', true, 'message', 'Friend request sent successfully!', 'friendship_id', v_new_id);
END;
$$;

-- 7. Grant execution
GRANT EXECUTE ON FUNCTION public.send_friend_request_by_username(UUID, TEXT) TO authenticated, anon;
