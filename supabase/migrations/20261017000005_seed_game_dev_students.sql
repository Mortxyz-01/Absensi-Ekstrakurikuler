-- Migration 20261017000005: Seed Game Development Students from SMK Prestasi Prima
-- Password for all accounts: Orens2026!
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
    v_pwd_hash TEXT := crypt('Orens2026!', gen_salt('bf', 10));
BEGIN
    -- 2. Seed 10 Students into auth.users, users, members, member_divisions
    -- 1: Brandon Nathanael Goenarto (0 Hadir)
    PERFORM create_gd_student('c1000000-0000-0000-0000-000000000001'::UUID, 'brandonabuwana@smkprestasiprima.sch.id', 'Brandon Nathanael Goenarto', 'SMKPP-GD-001', v_member_role_id, v_gamedev_id, v_pwd_hash);

    -- 2: Constantius Ernest Kurniawan (2 Hadir)
    PERFORM create_gd_student('c1000000-0000-0000-0000-000000000002'::UUID, 'c.ernest.kurniawan@smkprestasiprima.sch.id', 'Constantius Ernest Kurniawan', 'SMKPP-GD-002', v_member_role_id, v_gamedev_id, v_pwd_hash);

    -- 3: Devanda Amru Nabil Aziz (0 Hadir)
    PERFORM create_gd_student('c1000000-0000-0000-0000-000000000003'::UUID, 'devandatab@smkprestasiprima.sch.id', 'Devanda Amru Nabil Aziz', 'SMKPP-GD-003', v_member_role_id, v_gamedev_id, v_pwd_hash);

    -- 4: Fadel Muhammad Rifqi (2 Hadir)
    PERFORM create_gd_student('c1000000-0000-0000-0000-000000000004'::UUID, 'fadelrifqi10@smkprestasiprima.sch.id', 'Fadel Muhammad Rifqi', 'SMKPP-GD-004', v_member_role_id, v_gamedev_id, v_pwd_hash);

    -- 5: Fattan Rizieq Pasya (0 Hadir)
    PERFORM create_gd_student('c1000000-0000-0000-0000-000000000005'::UUID, 'berotaksenku334@smkprestasiprima.sch.id', 'Fattan Rizieq Pasya', 'SMKPP-GD-005', v_member_role_id, v_gamedev_id, v_pwd_hash);

    -- 6: Gilbertus Hizkia Rowan Sasongko (2 Hadir)
    PERFORM create_gd_student('c1000000-0000-0000-0000-000000000006'::UUID, 'hizkiarowan16@smkprestasiprima.sch.id', 'Gilbertus Hizkia Rowan Sasongko', 'SMKPP-GD-006', v_member_role_id, v_gamedev_id, v_pwd_hash);

    -- 7: Irvan Faeyza Rochani (0 Hadir)
    PERFORM create_gd_student('c1000000-0000-0000-0000-000000000007'::UUID, 'irvaneja0@smkprestasiprima.sch.id', 'Irvan Faeyza Rochani', 'SMKPP-GD-007', v_member_role_id, v_gamedev_id, v_pwd_hash);

    -- 8: Izzan Qushoyyi Fathurrahman (2 Hadir)
    PERFORM create_gd_student('c1000000-0000-0000-0000-000000000008'::UUID, 'Izzn@smkprestasiprima.sch.id', 'Izzan Qushoyyi Fathurrahman', 'SMKPP-GD-008', v_member_role_id, v_gamedev_id, v_pwd_hash);

    -- 9: Jenaro Putra Mozza Wibowo (0 Hadir)
    PERFORM create_gd_student('c1000000-0000-0000-0000-000000000009'::UUID, 'enakmozzarella37@smkprestasiprima.sch.id', 'Jenaro Putra Mozza Wibowo', 'SMKPP-GD-009', v_member_role_id, v_gamedev_id, v_pwd_hash);

    -- 10: Joshua Yehuda (2 Hadir)
    PERFORM create_gd_student('c1000000-0000-0000-0000-000000000010'::UUID, 'joshuayehudaa@smkprestasiprima.sch.id', 'Joshua Yehuda', 'SMKPP-GD-010', v_member_role_id, v_gamedev_id, v_pwd_hash);

END $$;
