-- Migration 20261017000006: Real Organization Members & Structure SMK Prestasi Prima
-- Default password for all accounts: Orens2026!

DO $$
DECLARE
    v_pwd_hash TEXT := crypt('Orens2026!', gen_salt('bf', 10));
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
    -- 1. Ketua (Gregorius Wibisono)
    UPDATE auth.users 
    SET email = 'gregorius5069.pplg1@smkprestasiprima.sch.id',
        encrypted_password = v_pwd_hash,
        raw_user_meta_data = jsonb_build_object('full_name', 'Gregorius Wibisono', 'role', 'Ketua')
    WHERE id = '22222222-2222-2222-2222-222222222222';

    UPDATE public.users 
    SET email = 'gregorius5069.pplg1@smkprestasiprima.sch.id',
        full_name = 'Gregorius Wibisono'
    WHERE id = '22222222-2222-2222-2222-222222222222';

    UPDATE public.members 
    SET nim = '5069',
        full_name = 'Gregorius Wibisono'
    WHERE id = '22222222-2222-2222-2222-222222222222';

    -- 2. Wakil (Rizqy Dwi Budi Rabbani)
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rizqy5086.pplg1@smkprestasiprima.sch.id', v_pwd_hash, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Rizqy Dwi Budi Rabbani', 'role', 'Wakil Ketua'), NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    INSERT INTO public.users (id, email, full_name, role_id, is_active)
    VALUES ('33333333-3333-3333-3333-333333333333', 'rizqy5086.pplg1@smkprestasiprima.sch.id', 'Rizqy Dwi Budi Rabbani', v_role_wakil, TRUE)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id;

    INSERT INTO public.members (id, nim, full_name, status, join_date)
    VALUES ('33333333-3333-3333-3333-333333333333', '5086', 'Rizqy Dwi Budi Rabbani', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET nim = EXCLUDED.nim, full_name = EXCLUDED.full_name;

    -- 3. Sekretaris 1 (Daud Sanggalangi Patuli)
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('44444444-0001-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'daud5063.pplg1@smkprestasiprima.sch.id', v_pwd_hash, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Daud Sanggalangi Patuli', 'role', 'Sekretaris'), NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    INSERT INTO public.users (id, email, full_name, role_id, is_active)
    VALUES ('44444444-0001-0000-0000-000000000001', 'daud5063.pplg1@smkprestasiprima.sch.id', 'Daud Sanggalangi Patuli', v_role_sekre, TRUE)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id;

    INSERT INTO public.members (id, nim, full_name, status, join_date)
    VALUES ('44444444-0001-0000-0000-000000000001', '5063', 'Daud Sanggalangi Patuli', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET nim = EXCLUDED.nim, full_name = EXCLUDED.full_name;

    -- 4. Sekretaris 2 (Zefanya Anastasia Setiawan)
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('44444444-0002-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zefanya5092.pplg1@smkprestasiprima.sch.id', v_pwd_hash, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Zefanya Anastasia Setiawan', 'role', 'Sekretaris'), NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    INSERT INTO public.users (id, email, full_name, role_id, is_active)
    VALUES ('44444444-0002-0000-0000-000000000002', 'zefanya5092.pplg1@smkprestasiprima.sch.id', 'Zefanya Anastasia Setiawan', v_role_sekre, TRUE)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id;

    INSERT INTO public.members (id, nim, full_name, status, join_date)
    VALUES ('44444444-0002-0000-0000-000000000002', '5092', 'Zefanya Anastasia Setiawan', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET nim = EXCLUDED.nim, full_name = EXCLUDED.full_name;

    -- CYBERSECURITY
    -- 5. Kadiv Cybersec (Nathaniel Gilby Ginting)
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('55555555-0005-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nathaniel5082.pplg1@smkprestasiprima.sch.id', v_pwd_hash, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Nathaniel Gilby Ginting', 'role', 'Ketua Divisi'), NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    INSERT INTO public.users (id, email, full_name, role_id, is_active)
    VALUES ('55555555-0005-0000-0000-000000000001', 'nathaniel5082.pplg1@smkprestasiprima.sch.id', 'Nathaniel Gilby Ginting', v_role_kadiv, TRUE)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id;

    INSERT INTO public.members (id, nim, full_name, status, join_date)
    VALUES ('55555555-0005-0000-0000-000000000001', '5082', 'Nathaniel Gilby Ginting', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET nim = EXCLUDED.nim, full_name = EXCLUDED.full_name;

    UPDATE public.divisions SET lead_id = '55555555-0005-0000-0000-000000000001' WHERE id = v_div_cybersec;

    INSERT INTO public.member_divisions (member_id, division_id, classification, is_active)
    VALUES ('55555555-0005-0000-0000-000000000001', v_div_cybersec, 'Wajib', TRUE)
    ON CONFLICT DO NOTHING;

    -- 6. Mentor Cybersec 1 (Bayu Satya Firdaus)
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('66666666-0005-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bayu5061.pplg1@smkprestasiprima.sch.id', v_pwd_hash, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Bayu Satya Firdaus', 'role', 'Mentor'), NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    INSERT INTO public.users (id, email, full_name, role_id, is_active)
    VALUES ('66666666-0005-0000-0000-000000000001', 'bayu5061.pplg1@smkprestasiprima.sch.id', 'Bayu Satya Firdaus', v_role_mentor, TRUE)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id;

    INSERT INTO public.members (id, nim, full_name, status, join_date)
    VALUES ('66666666-0005-0000-0000-000000000001', '5061', 'Bayu Satya Firdaus', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET nim = EXCLUDED.nim, full_name = EXCLUDED.full_name;

    INSERT INTO public.member_divisions (member_id, division_id, classification, is_active)
    VALUES ('66666666-0005-0000-0000-000000000001', v_div_cybersec, 'Wajib', TRUE)
    ON CONFLICT DO NOTHING;

    -- 7. Mentor Cybersec 2 (Fahry Eka Budi Rabbani)
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('66666666-0005-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fahry5104.pplg2@smkprestasiprima.sch.id', v_pwd_hash, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Fahry Eka Budi Rabbani', 'role', 'Mentor'), NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    INSERT INTO public.users (id, email, full_name, role_id, is_active)
    VALUES ('66666666-0005-0000-0000-000000000002', 'fahry5104.pplg2@smkprestasiprima.sch.id', 'Fahry Eka Budi Rabbani', v_role_mentor, TRUE)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id;

    INSERT INTO public.members (id, nim, full_name, status, join_date)
    VALUES ('66666666-0005-0000-0000-000000000002', '5104', 'Fahry Eka Budi Rabbani', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET nim = EXCLUDED.nim, full_name = EXCLUDED.full_name;

    INSERT INTO public.member_divisions (member_id, division_id, classification, is_active)
    VALUES ('66666666-0005-0000-0000-000000000002', v_div_cybersec, 'Wajib', TRUE)
    ON CONFLICT DO NOTHING;

    -- GAME DEVELOPMENT
    -- 8. Kadiv Game Dev (Gagah Satria Handoko)
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('55555555-0003-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gagah5067.pplg1@smkprestasiprima.sch.id', v_pwd_hash, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Gagah Satria Handoko', 'role', 'Ketua Divisi'), NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    INSERT INTO public.users (id, email, full_name, role_id, is_active)
    VALUES ('55555555-0003-0000-0000-000000000001', 'gagah5067.pplg1@smkprestasiprima.sch.id', 'Gagah Satria Handoko', v_role_kadiv, TRUE)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id;

    INSERT INTO public.members (id, nim, full_name, status, join_date)
    VALUES ('55555555-0003-0000-0000-000000000001', '5067', 'Gagah Satria Handoko', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET nim = EXCLUDED.nim, full_name = EXCLUDED.full_name;

    UPDATE public.divisions SET lead_id = '55555555-0003-0000-0000-000000000001' WHERE id = v_div_gamedev;

    INSERT INTO public.member_divisions (member_id, division_id, classification, is_active)
    VALUES ('55555555-0003-0000-0000-000000000001', v_div_gamedev, 'Wajib', TRUE)
    ON CONFLICT DO NOTHING;

    -- 9. Mentor Game Dev 1 (Muhammad Sulaiman)
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('66666666-0003-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm.sulaiman5080.pplg1@smkprestasiprima.sch.id', v_pwd_hash, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Muhammad Sulaiman', 'role', 'Mentor'), NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    INSERT INTO public.users (id, email, full_name, role_id, is_active)
    VALUES ('66666666-0003-0000-0000-000000000001', 'm.sulaiman5080.pplg1@smkprestasiprima.sch.id', 'Muhammad Sulaiman', v_role_mentor, TRUE)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id;

    INSERT INTO public.members (id, nim, full_name, status, join_date)
    VALUES ('66666666-0003-0000-0000-000000000001', '5080', 'Muhammad Sulaiman', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET nim = EXCLUDED.nim, full_name = EXCLUDED.full_name;

    INSERT INTO public.member_divisions (member_id, division_id, classification, is_active)
    VALUES ('66666666-0003-0000-0000-000000000001', v_div_gamedev, 'Wajib', TRUE)
    ON CONFLICT DO NOTHING;

    -- 10. Mentor Game Dev 2 (Ghifari Prawira Ekapaksi)
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('66666666-0003-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ghifari5068.pplg1@smkprestasiprima.sch.id', v_pwd_hash, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Ghifari Prawira Ekapaksi', 'role', 'Mentor'), NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    INSERT INTO public.users (id, email, full_name, role_id, is_active)
    VALUES ('66666666-0003-0000-0000-000000000002', 'ghifari5068.pplg1@smkprestasiprima.sch.id', 'Ghifari Prawira Ekapaksi', v_role_mentor, TRUE)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id;

    INSERT INTO public.members (id, nim, full_name, status, join_date)
    VALUES ('66666666-0003-0000-0000-000000000002', '5068', 'Ghifari Prawira Ekapaksi', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET nim = EXCLUDED.nim, full_name = EXCLUDED.full_name;

    INSERT INTO public.member_divisions (member_id, division_id, classification, is_active)
    VALUES ('66666666-0003-0000-0000-000000000002', v_div_gamedev, 'Wajib', TRUE)
    ON CONFLICT DO NOTHING;

    -- WEB DEVELOPMENT
    -- 11. Kadiv Web Dev (Muhammad Sasongko Junior)
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('55555555-0002-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm.sasongko5112.pplg2@smkprestasiprima.sch.id', v_pwd_hash, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Muhammad Sasongko Junior', 'role', 'Ketua Divisi'), NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    INSERT INTO public.users (id, email, full_name, role_id, is_active)
    VALUES ('55555555-0002-0000-0000-000000000001', 'm.sasongko5112.pplg2@smkprestasiprima.sch.id', 'Muhammad Sasongko Junior', v_role_kadiv, TRUE)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id;

    INSERT INTO public.members (id, nim, full_name, status, join_date)
    VALUES ('55555555-0002-0000-0000-000000000001', '5112', 'Muhammad Sasongko Junior', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET nim = EXCLUDED.nim, full_name = EXCLUDED.full_name;

    UPDATE public.divisions SET lead_id = '55555555-0002-0000-0000-000000000001' WHERE id = v_div_webdev;

    INSERT INTO public.member_divisions (member_id, division_id, classification, is_active)
    VALUES ('55555555-0002-0000-0000-000000000001', v_div_webdev, 'Wajib', TRUE)
    ON CONFLICT DO NOTHING;

    -- 12. Mentor Web Dev 1 (Toberryazdin Hartono)
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('66666666-0002-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'toberyazdin5128.pplg2@smkprestasiprima.sch.id', v_pwd_hash, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Toberryazdin Hartono', 'role', 'Mentor'), NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    INSERT INTO public.users (id, email, full_name, role_id, is_active)
    VALUES ('66666666-0002-0000-0000-000000000001', 'toberyazdin5128.pplg2@smkprestasiprima.sch.id', 'Toberryazdin Hartono', v_role_mentor, TRUE)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id;

    INSERT INTO public.members (id, nim, full_name, status, join_date)
    VALUES ('66666666-0002-0000-0000-000000000001', '5128', 'Toberryazdin Hartono', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET nim = EXCLUDED.nim, full_name = EXCLUDED.full_name;

    INSERT INTO public.member_divisions (member_id, division_id, classification, is_active)
    VALUES ('66666666-0002-0000-0000-000000000001', v_div_webdev, 'Wajib', TRUE)
    ON CONFLICT DO NOTHING;

    -- UI/UX
    -- 13. Kadiv UI/UX (Kayla Audrey Illonie)
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('55555555-0001-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'kayla5110.pplg2@smkprestasiprima.sch.id', v_pwd_hash, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Kayla Audrey Illonie', 'role', 'Ketua Divisi'), NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    INSERT INTO public.users (id, email, full_name, role_id, is_active)
    VALUES ('55555555-0001-0000-0000-000000000001', 'kayla5110.pplg2@smkprestasiprima.sch.id', 'Kayla Audrey Illonie', v_role_kadiv, TRUE)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id;

    INSERT INTO public.members (id, nim, full_name, status, join_date)
    VALUES ('55555555-0001-0000-0000-000000000001', '5110', 'Kayla Audrey Illonie', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET nim = EXCLUDED.nim, full_name = EXCLUDED.full_name;

    UPDATE public.divisions SET lead_id = '55555555-0001-0000-0000-000000000001' WHERE id = v_div_uiux;

    INSERT INTO public.member_divisions (member_id, division_id, classification, is_active)
    VALUES ('55555555-0001-0000-0000-000000000001', v_div_uiux, 'Wajib', TRUE)
    ON CONFLICT DO NOTHING;

    -- 14. Mentor UI/UX 1 (Lovely Angel)
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('66666666-0001-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lovely5071.pplg1@smkprestasiprima.sch.id', v_pwd_hash, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Lovely Angel', 'role', 'Mentor'), NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    INSERT INTO public.users (id, email, full_name, role_id, is_active)
    VALUES ('66666666-0001-0000-0000-000000000001', 'lovely5071.pplg1@smkprestasiprima.sch.id', 'Lovely Angel', v_role_mentor, TRUE)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id;

    INSERT INTO public.members (id, nim, full_name, status, join_date)
    VALUES ('66666666-0001-0000-0000-000000000001', '5071', 'Lovely Angel', 'active', '2024-01-15')
    ON CONFLICT (id) DO UPDATE SET nim = EXCLUDED.nim, full_name = EXCLUDED.full_name;

    INSERT INTO public.member_divisions (member_id, division_id, classification, is_active)
    VALUES ('66666666-0001-0000-0000-000000000001', v_div_uiux, 'Wajib', TRUE)
    ON CONFLICT DO NOTHING;

    -- 15. Mentor UI/UX 2 (Yohanes Adriano Putra)
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('66666666-0001-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'yohanes5091.pplg1@smkprestasiprima.sch.id', v_pwd_hash, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Yohanes Adriano Putra', 'role', 'Mentor'), NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, encrypted_password = EXCLUDED.encrypted_password, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    INSERT INTO public.users (id, email, full_name, role_id, is_active)
    VALUES ('66666666-0001-0000-0000-000000000002', 'yohanes5091.pplg1@smkprestasiprima.sch.id', 'Yohanes Adriano Putra', v_role_mentor, TRUE)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id;

    INSERT INTO public.members (id, nim, full_name, status, join_date)
    VALUES ('66666666-0001-0000-0000-000000000002', '5091', 'Yohanes Adriano Putra', 'active', '2024-01-15')
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
