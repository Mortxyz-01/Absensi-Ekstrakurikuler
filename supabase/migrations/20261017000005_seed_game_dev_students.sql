-- Migration 20261017000005: Seed Game Development Students (akun siswa dummy)
-- Password for all accounts: UjiOrensMVP2026!
-- Hash: $2a$06$eRcIqbY7dY6u5N/2OGC3leARWyBuq/UYirL.2m75weTzkRWb5Iebi

CREATE OR REPLACE FUNCTION create_gd_student(
    p_id UUID,
    p_email TEXT,
    p_name TEXT,
    p_nim TEXT,
    p_role_id UUID,
    p_div_id UUID,
    p_pwd_hash TEXT
) RETURNS VOID AS $$
BEGIN
    -- Auth User
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', LOWER(p_email), p_pwd_hash, NOW(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        jsonb_build_object('full_name', p_name, 'role', 'Member'),
        NOW(), NOW()
    ) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

    -- Public User
    INSERT INTO public.users (id, email, full_name, role_id, is_active)
    VALUES (p_id, LOWER(p_email), p_name, p_role_id, TRUE)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name;

    -- Public Member
    INSERT INTO public.members (id, nim, full_name, join_date, status)
    VALUES (p_id, p_nim, p_name, '2026-07-15', 'active')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

    -- Member Division (Game Development as Wajib)
    INSERT INTO public.member_divisions (member_id, division_id, classification, is_active)
    VALUES (p_id, p_div_id, 'Wajib', TRUE)
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    v_member_role_id UUID := '00000000-0000-0000-0000-000000000007';
    v_gamedev_id UUID := 'a0000000-0000-0000-0000-000000000003';
    v_pwd_hash TEXT := crypt('UjiOrensMVP2026!', gen_salt('bf', 10));
BEGIN
    -- 2. Seed 10 Students into auth.users, users, members, member_divisions
    -- 1: Siswa Game Development 01 (0 Hadir)
    PERFORM create_gd_student('c1000000-0000-0000-0000-000000000001'::UUID, 'siswa01.gamedev@example.com', 'Siswa Game Development 01', 'SMKPP-GD-001', v_member_role_id, v_gamedev_id, v_pwd_hash);

    -- 2: Siswa Game Development 02 (2 Hadir)
    PERFORM create_gd_student('c1000000-0000-0000-0000-000000000002'::UUID, 'siswa02.gamedev@example.com', 'Siswa Game Development 02', 'SMKPP-GD-002', v_member_role_id, v_gamedev_id, v_pwd_hash);

    -- 3: Siswa Game Development 03 (0 Hadir)
    PERFORM create_gd_student('c1000000-0000-0000-0000-000000000003'::UUID, 'siswa03.gamedev@example.com', 'Siswa Game Development 03', 'SMKPP-GD-003', v_member_role_id, v_gamedev_id, v_pwd_hash);

    -- 4: Siswa Game Development 04 (2 Hadir)
    PERFORM create_gd_student('c1000000-0000-0000-0000-000000000004'::UUID, 'siswa04.gamedev@example.com', 'Siswa Game Development 04', 'SMKPP-GD-004', v_member_role_id, v_gamedev_id, v_pwd_hash);

    -- 5: Siswa Game Development 05 (0 Hadir)
    PERFORM create_gd_student('c1000000-0000-0000-0000-000000000005'::UUID, 'siswa05.gamedev@example.com', 'Siswa Game Development 05', 'SMKPP-GD-005', v_member_role_id, v_gamedev_id, v_pwd_hash);

    -- 6: Siswa Game Development 06 (2 Hadir)
    PERFORM create_gd_student('c1000000-0000-0000-0000-000000000006'::UUID, 'siswa06.gamedev@example.com', 'Siswa Game Development 06', 'SMKPP-GD-006', v_member_role_id, v_gamedev_id, v_pwd_hash);

    -- 7: Siswa Game Development 07 (0 Hadir)
    PERFORM create_gd_student('c1000000-0000-0000-0000-000000000007'::UUID, 'siswa07.gamedev@example.com', 'Siswa Game Development 07', 'SMKPP-GD-007', v_member_role_id, v_gamedev_id, v_pwd_hash);

    -- 8: Siswa Game Development 08 (2 Hadir)
    PERFORM create_gd_student('c1000000-0000-0000-0000-000000000008'::UUID, 'siswa08.gamedev@example.com', 'Siswa Game Development 08', 'SMKPP-GD-008', v_member_role_id, v_gamedev_id, v_pwd_hash);

    -- 9: Siswa Game Development 09 (0 Hadir)
    PERFORM create_gd_student('c1000000-0000-0000-0000-000000000009'::UUID, 'siswa09.gamedev@example.com', 'Siswa Game Development 09', 'SMKPP-GD-009', v_member_role_id, v_gamedev_id, v_pwd_hash);

    -- 10: Siswa Game Development 10 (2 Hadir)
    PERFORM create_gd_student('c1000000-0000-0000-0000-000000000010'::UUID, 'siswa10.gamedev@example.com', 'Siswa Game Development 10', 'SMKPP-GD-010', v_member_role_id, v_gamedev_id, v_pwd_hash);

END $$;
