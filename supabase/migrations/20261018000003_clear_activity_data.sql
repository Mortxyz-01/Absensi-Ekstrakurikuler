-- Migration 20261018000003: Clear activity data
-- Empties all material, attendance, assignment, and grade records so the app
-- starts from a clean slate. Schema, RLS policies, triggers, roles, divisions,
-- and member accounts are intentionally left untouched.
-- Laporan (reports) and nilai akhir are derived at runtime, so they clear
-- automatically once these source tables are empty.

BEGIN;

-- Penilaian / tugas (children first to satisfy references)
DELETE FROM assignment_grades;
DELETE FROM assignment_submissions;
DELETE FROM assignments;

-- Absensi
DELETE FROM attendance_records;
DELETE FROM session_participants;
DELETE FROM attendance_qr_tokens;
DELETE FROM attendance_sessions;
DELETE FROM leave_requests;

-- Materi pembelajaran
DELETE FROM learning_materials;

COMMIT;
