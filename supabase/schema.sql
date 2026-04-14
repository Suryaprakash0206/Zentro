-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- WARNING: Dropping existing tables to ensure a clean slate since previous incorrect tables were detected
drop table if exists public.attendance_records cascade;
drop table if exists public.worker_salary_configs cascade;
drop table if exists public.bookings cascade;
drop table if exists public.services cascade;
drop table if exists public.profiles cascade;

-- Profiles Table (Linked to auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null default 'Unknown',
  phone text,
  role text not null default 'user' check (role in ('user', 'worker', 'admin')),
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Force add columns just in case the table already existed from a previous template
alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists name text not null default 'Unknown';

-- Services Table
create table if not exists public.services (
  id text primary key, -- e.g., 'car_wash'
  label text not null,
  emoji text,
  price numeric not null default 0,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Bookings Table
create table if not exists public.bookings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete set null not null,
  worker_id uuid references public.profiles(id) on delete set null,
  service_type text references public.services(id) on delete restrict not null,
  service_label text not null,
  price numeric not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'in_progress', 'completed', 'cancelled')),
  location text not null,
  location_link text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  scheduled_date timestamp with time zone
);

-- Worker Salary Configs
create table if not exists public.worker_salary_configs (
  worker_id uuid references public.profiles(id) on delete cascade primary key,
  daily_rate numeric not null default 500,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Attendance Records
create table if not exists public.attendance_records (
  id uuid default gen_random_uuid() primary key,
  worker_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  status text not null check (status in ('present', 'absent', 'half_day', 'holiday')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(worker_id, date)
);

-- --------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) SETUP
-- --------------------------------------------------------

-- Profiles
alter table public.profiles enable row level security;
drop policy if exists "Public readable profiles" on public.profiles;
create policy "Public readable profiles" on public.profiles for select using (true);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Services
alter table public.services enable row level security;
drop policy if exists "Anyone can read services" on public.services;
create policy "Anyone can read services" on public.services for select using (true);

drop policy if exists "Only admins can modify services" on public.services;
create policy "Only admins can modify services" on public.services for all using (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
);

-- Bookings
alter table public.bookings enable row level security;
drop policy if exists "Admins can view all bookings" on public.bookings;
create policy "Admins can view all bookings" on public.bookings for select using (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
);

drop policy if exists "Users can view own bookings" on public.bookings;
create policy "Users can view own bookings" on public.bookings for select using (auth.uid() = user_id);

drop policy if exists "Workers can view accepted bookings" on public.bookings;
create policy "Workers can view accepted bookings" on public.bookings for select using (auth.uid() = worker_id or status = 'pending');

drop policy if exists "Users can create bookings" on public.bookings;
create policy "Users can create bookings" on public.bookings for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own bookings" on public.bookings;
create policy "Users can update own bookings" on public.bookings for update using (auth.uid() = user_id or auth.uid() = worker_id);

drop policy if exists "Admins can update all bookings" on public.bookings;
create policy "Admins can update all bookings" on public.bookings for update using (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
);

-- Salary Configs
alter table public.worker_salary_configs enable row level security;
drop policy if exists "Admins can manage salary configs" on public.worker_salary_configs;
create policy "Admins can manage salary configs" on public.worker_salary_configs for all using (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
);

drop policy if exists "Workers can read own salary config" on public.worker_salary_configs;
create policy "Workers can read own salary config" on public.worker_salary_configs for select using (auth.uid() = worker_id);

-- Attendance Records
alter table public.attendance_records enable row level security;
drop policy if exists "Admins can view/manage attendance" on public.attendance_records;
create policy "Admins can view/manage attendance" on public.attendance_records for all using (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
);

drop policy if exists "Workers can view own attendance" on public.attendance_records;
create policy "Workers can view own attendance" on public.attendance_records for select using (auth.uid() = worker_id);

-- --------------------------------------------------------
-- SEED DATA (Services)
-- --------------------------------------------------------
insert into public.services (id, label, emoji, price, description) values
  ('car_wash', 'Car Wash', '🚗', 499, 'Full exterior & interior cleaning'),
  ('bike_wash', 'Bike Wash', '🏍️', 249, 'Thorough bike cleaning & polishing'),
  ('water_tank', 'Water Tank Cleaning', '💧', 799, 'Deep tank cleaning & sanitization')
on conflict (id) do nothing;
