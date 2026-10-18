-- Migration 20261017000006: Struktur Organisasi Pengurus dan Divisi (akun dummy)
-- Sandi akun uji didefinisikan di variabel v_pwd_hash di bawah.

DO $$
DECLARE
    v_pwd_hash TEXT := crypt('UjiOrensMVP2026!', gen_salt('bf', 10));
    v_role_ketua UUID := '00000000-0000-0000-0000-000000000002';
    v_role_wakil UUID := '00000000-0000-0000-0000-000000000003';
    v_role_sekre UUID := '00000000-0000-0000-0000-000000000004';
    v_role_kadiv UUID := '00000000-0000-0000-0000-000000000005';
    v_role_mentor UUID := '00000000-0000-0000-0000-000000000006';

    v_div_uiux UUID := 'a0000000-0000-0000-0000-000000000001';
    v_div_webdev UUID := 'a0000000-0000-0000-0000-000000000002';
    v_div_gamedev UUID := 'a0000000-0000-0000-0000-000000000003';
    v_div_cybersec UUID := 'a0000000-0000-0000-0000-000000000005';
BEGIN
    -- 1. Ketua Umum
    UPDATE auth.users 
    SET email = 'ketua@example.com',
        encrypted_password = v_pwd_hash,
        raw_user_meta_data = jsonb_build_object('full_name', 'Ketua Umum', 'role', 'Ketua')
    WHERE id = '22222222-2222-2222-2222-222222222222';

    UPDATE public.users 
    SET email = 'ketua@example.com',
        full_name = 'Ketua Umum'
    WHERE id = '22222222-2222-2222-2222-222222222222';

    UPDATE public.members 
    SET nim = '0001',
        full_name = 'Ketua Umum'
    WHERE id = '22222222-2222-2222-2222-222222222222';

    -- 2. Wakil Ketua
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'wakil@example.com', v_pwd_hash, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Wakil Ketua', 'role', 'Wakil Ketua'), NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    INSERT INTO public.users (id, email, full_name, role_id, is_active)
    VALUES ('33333333-3333-3333-3333-333333333333', 'wakil@example.com', 'Wakil Ketua', v_role_wakil, TRUE)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id;

    INSERT INTO public.members (id, nim, full_name, status, join_date)
    VALUES ('33333333-3333-3333-3333-333333333333', '0002', 'Wakil Ketua', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET nim = EXCLUDED.nim, full_name = EXCLUDED.full_name;

    -- 3. Sekretaris 1
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('44444444-0001-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sekre1@example.com', v_pwd_hash, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Sekretaris 1', 'role', 'Sekretaris'), NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    INSERT INTO public.users (id, email, full_name, role_id, is_active)
    VALUES ('44444444-0001-0000-0000-000000000001', 'sekre1@example.com', 'Sekretaris 1', v_role_sekre, TRUE)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id;

    INSERT INTO public.members (id, nim, full_name, status, join_date)
    VALUES ('44444444-0001-0000-0000-000000000001', '0003', 'Sekretaris 1', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET nim = EXCLUDED.nim, full_name = EXCLUDED.full_name;

    -- 4. Sekretaris 2
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('44444444-0002-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sekre2@example.com', v_pwd_hash, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Sekretaris 2', 'role', 'Sekretaris'), NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    INSERT INTO public.users (id, email, full_name, role_id, is_active)
    VALUES ('44444444-0002-0000-0000-000000000002', 'sekre2@example.com', 'Sekretaris 2', v_role_sekre, TRUE)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id;

    INSERT INTO public.members (id, nim, full_name, status, join_date)
    VALUES ('44444444-0002-0000-0000-000000000002', '0004', 'Sekretaris 2', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET nim = EXCLUDED.nim, full_name = EXCLUDED.full_name;

    -- CYBERSECURITY
    -- 5. Kadiv Cybersecurity
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('55555555-0005-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'kadiv.cybersec@example.com', v_pwd_hash, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Kadiv Cybersecurity', 'role', 'Ketua Divisi'), NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    INSERT INTO public.users (id, email, full_name, role_id, is_active)
    VALUES ('55555555-0005-0000-0000-000000000001', 'kadiv.cybersec@example.com', 'Kadiv Cybersecurity', v_role_kadiv, TRUE)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id;

    INSERT INTO public.members (id, nim, full_name, status, join_date)
    VALUES ('55555555-0005-0000-0000-000000000001', '0005', 'Kadiv Cybersecurity', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET nim = EXCLUDED.nim, full_name = EXCLUDED.full_name;

    UPDATE public.divisions SET lead_id = '55555555-0005-0000-0000-000000000001' WHERE id = v_div_cybersec;

    INSERT INTO public.member_divisions (member_id, division_id, classification, is_active)
    VALUES ('55555555-0005-0000-0000-000000000001', v_div_cybersec, 'Wajib', TRUE)
    ON CONFLICT DO NOTHING;

    -- 6. Mentor Cybersecurity 1
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('66666666-0005-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mentor1.cybersec@example.com', v_pwd_hash, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Mentor Cybersecurity 1', 'role', 'Mentor'), NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    INSERT INTO public.users (id, email, full_name, role_id, is_active)
    VALUES ('66666666-0005-0000-0000-000000000001', 'mentor1.cybersec@example.com', 'Mentor Cybersecurity 1', v_role_mentor, TRUE)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id;

    INSERT INTO public.members (id, nim, full_name, status, join_date)
    VALUES ('66666666-0005-0000-0000-000000000001', '0006', 'Mentor Cybersecurity 1', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET nim = EXCLUDED.nim, full_name = EXCLUDED.full_name;

    INSERT INTO public.member_divisions (member_id, division_id, classification, is_active)
    VALUES ('66666666-0005-0000-0000-000000000001', v_div_cybersec, 'Wajib', TRUE)
    ON CONFLICT DO NOTHING;

    -- 7. Mentor Cybersecurity 2
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('66666666-0005-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mentor2.cybersec@example.com', v_pwd_hash, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Mentor Cybersecurity 2', 'role', 'Mentor'), NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    INSERT INTO public.users (id, email, full_name, role_id, is_active)
    VALUES ('66666666-0005-0000-0000-000000000002', 'mentor2.cybersec@example.com', 'Mentor Cybersecurity 2', v_role_mentor, TRUE)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id;

    INSERT INTO public.members (id, nim, full_name, status, join_date)
    VALUES ('66666666-0005-0000-0000-000000000002', '0007', 'Mentor Cybersecurity 2', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET nim = EXCLUDED.nim, full_name = EXCLUDED.full_name;

    INSERT INTO public.member_divisions (member_id, division_id, classification, is_active)
    VALUES ('66666666-0005-0000-0000-000000000002', v_div_cybersec, 'Wajib', TRUE)
    ON CONFLICT DO NOTHING;

    -- GAME DEVELOPMENT
    -- 8. Kadiv Game Development
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('55555555-0003-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'kadiv.gamedev@example.com', v_pwd_hash, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Kadiv Game Development', 'role', 'Ketua Divisi'), NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    INSERT INTO public.users (id, email, full_name, role_id, is_active)
    VALUES ('55555555-0003-0000-0000-000000000001', 'kadiv.gamedev@example.com', 'Kadiv Game Development', v_role_kadiv, TRUE)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id;

    INSERT INTO public.members (id, nim, full_name, status, join_date)
    VALUES ('55555555-0003-0000-0000-000000000001', '0008', 'Kadiv Game Development', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET nim = EXCLUDED.nim, full_name = EXCLUDED.full_name;

    UPDATE public.divisions SET lead_id = '55555555-0003-0000-0000-000000000001' WHERE id = v_div_gamedev;

    INSERT INTO public.member_divisions (member_id, division_id, classification, is_active)
    VALUES ('55555555-0003-0000-0000-000000000001', v_div_gamedev, 'Wajib', TRUE)
    ON CONFLICT DO NOTHING;

    -- 9. Mentor Game Development 1
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('66666666-0003-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mentor1.gamedev@example.com', v_pwd_hash, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Mentor Game Development 1', 'role', 'Mentor'), NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    INSERT INTO public.users (id, email, full_name, role_id, is_active)
    VALUES ('66666666-0003-0000-0000-000000000001', 'mentor1.gamedev@example.com', 'Mentor Game Development 1', v_role_mentor, TRUE)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id;

    INSERT INTO public.members (id, nim, full_name, status, join_date)
    VALUES ('66666666-0003-0000-0000-000000000001', '0009', 'Mentor Game Development 1', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET nim = EXCLUDED.nim, full_name = EXCLUDED.full_name;

    INSERT INTO public.member_divisions (member_id, division_id, classification, is_active)
    VALUES ('66666666-0003-0000-0000-000000000001', v_div_gamedev, 'Wajib', TRUE)
    ON CONFLICT DO NOTHING;

    -- 10. Mentor Game Development 2
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('66666666-0003-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mentor2.gamedev@example.com', v_pwd_hash, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Mentor Game Development 2', 'role', 'Mentor'), NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    INSERT INTO public.users (id, email, full_name, role_id, is_active)
    VALUES ('66666666-0003-0000-0000-000000000002', 'mentor2.gamedev@example.com', 'Mentor Game Development 2', v_role_mentor, TRUE)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id;

    INSERT INTO public.members (id, nim, full_name, status, join_date)
    VALUES ('66666666-0003-0000-0000-000000000002', '0010', 'Mentor Game Development 2', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET nim = EXCLUDED.nim, full_name = EXCLUDED.full_name;

    INSERT INTO public.member_divisions (member_id, division_id, classification, is_active)
    VALUES ('66666666-0003-0000-0000-000000000002', v_div_gamedev, 'Wajib', TRUE)
    ON CONFLICT DO NOTHING;

    -- WEB DEVELOPMENT
    -- 11. Kadiv Web Development
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('55555555-0002-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'kadiv.webdev@example.com', v_pwd_hash, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Kadiv Web Development', 'role', 'Ketua Divisi'), NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    INSERT INTO public.users (id, email, full_name, role_id, is_active)
    VALUES ('55555555-0002-0000-0000-000000000001', 'kadiv.webdev@example.com', 'Kadiv Web Development', v_role_kadiv, TRUE)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id;

    INSERT INTO public.members (id, nim, full_name, status, join_date)
    VALUES ('55555555-0002-0000-0000-000000000001', '0011', 'Kadiv Web Development', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET nim = EXCLUDED.nim, full_name = EXCLUDED.full_name;

    UPDATE public.divisions SET lead_id = '55555555-0002-0000-0000-000000000001' WHERE id = v_div_webdev;

    INSERT INTO public.member_divisions (member_id, division_id, classification, is_active)
    VALUES ('55555555-0002-0000-0000-000000000001', v_div_webdev, 'Wajib', TRUE)
    ON CONFLICT DO NOTHING;

    -- 12. Mentor Web Development 1
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('66666666-0002-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mentor1.webdev@example.com', v_pwd_hash, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Mentor Web Development 1', 'role', 'Mentor'), NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    INSERT INTO public.users (id, email, full_name, role_id, is_active)
    VALUES ('66666666-0002-0000-0000-000000000001', 'mentor1.webdev@example.com', 'Mentor Web Development 1', v_role_mentor, TRUE)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id;

    INSERT INTO public.members (id, nim, full_name, status, join_date)
    VALUES ('66666666-0002-0000-0000-000000000001', '0012', 'Mentor Web Development 1', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET nim = EXCLUDED.nim, full_name = EXCLUDED.full_name;

    INSERT INTO public.member_divisions (member_id, division_id, classification, is_active)
    VALUES ('66666666-0002-0000-0000-000000000001', v_div_webdev, 'Wajib', TRUE)
    ON CONFLICT DO NOTHING;

    -- UI/UX
    -- 13. Kadiv UI/UX
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('55555555-0001-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'kadiv.uiux@example.com', v_pwd_hash, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Kadiv UI/UX', 'role', 'Ketua Divisi'), NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    INSERT INTO public.users (id, email, full_name, role_id, is_active)
    VALUES ('55555555-0001-0000-0000-000000000001', 'kadiv.uiux@example.com', 'Kadiv UI/UX', v_role_kadiv, TRUE)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id;

    INSERT INTO public.members (id, nim, full_name, status, join_date)
    VALUES ('55555555-0001-0000-0000-000000000001', '0013', 'Kadiv UI/UX', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET nim = EXCLUDED.nim, full_name = EXCLUDED.full_name;

    UPDATE public.divisions SET lead_id = '55555555-0001-0000-0000-000000000001' WHERE id = v_div_uiux;

    INSERT INTO public.member_divisions (member_id, division_id, classification, is_active)
    VALUES ('55555555-0001-0000-0000-000000000001', v_div_uiux, 'Wajib', TRUE)
    ON CONFLICT DO NOTHING;

    -- 14. Mentor UI/UX 1
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('66666666-0001-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mentor1.uiux@example.com', v_pwd_hash, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Mentor UI/UX 1', 'role', 'Mentor'), NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    INSERT INTO public.users (id, email, full_name, role_id, is_active)
    VALUES ('66666666-0001-0000-0000-000000000001', 'mentor1.uiux@example.com', 'Mentor UI/UX 1', v_role_mentor, TRUE)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id;

    INSERT INTO public.members (id, nim, full_name, status, join_date)
    VALUES ('66666666-0001-0000-0000-000000000001', '0014', 'Mentor UI/UX 1', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET nim = EXCLUDED.nim, full_name = EXCLUDED.full_name;

    INSERT INTO public.member_divisions (member_id, division_id, classification, is_active)
    VALUES ('66666666-0001-0000-0000-000000000001', v_div_uiux, 'Wajib', TRUE)
    ON CONFLICT DO NOTHING;

    -- 15. Mentor UI/UX 2
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('66666666-0001-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mentor2.uiux@example.com', v_pwd_hash, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Mentor UI/UX 2', 'role', 'Mentor'), NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    INSERT INTO public.users (id, email, full_name, role_id, is_active)
    VALUES ('66666666-0001-0000-0000-000000000002', 'mentor2.uiux@example.com', 'Mentor UI/UX 2', v_role_mentor, TRUE)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id;

    INSERT INTO public.members (id, nim, full_name, status, join_date)
    VALUES ('66666666-0001-0000-0000-000000000002', '0015', 'Mentor UI/UX 2', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET nim = EXCLUDED.nim, full_name = EXCLUDED.full_name;

    INSERT INTO public.member_divisions (member_id, division_id, classification, is_active)
    VALUES ('66666666-0001-0000-0000-000000000002', v_div_uiux, 'Wajib', TRUE)
    ON CONFLICT DO NOTHING;

END $$;

-- GoTrue fails sign-in ("Database error querying schema") when token columns
-- are NULL or the user has no identity row. Normalize both for seeded users.
UPDATE auth.users SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, '');

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = u.id);
