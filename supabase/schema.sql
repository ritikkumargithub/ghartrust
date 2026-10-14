-- GharTrust MVP schema. Run in Supabase: SQL Editor -> New query -> paste -> Run.

create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tenant_name text not null,
  tenant_phone text not null,
  tenant_email text,
  property_label text,
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  status text not null default 'invited'
    check (status in ('invited','in_progress','submitted','reviewed','withdrawn')),
  created_at timestamptz not null default now()
);
create index on public.verification_requests (landlord_id);

create table public.consents (
  request_id uuid primary key references public.verification_requests(id) on delete cascade,
  signed_name text not null,
  consent_version text not null default 'v1',
  signed_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.verification_requests(id) on delete cascade,
  doc_type text not null check (doc_type in ('pan','id_proof','selfie','employment_doc','bank_statement')),
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);
create index on public.documents (request_id);

create table public.checks (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.verification_requests(id) on delete cascade,
  check_type text not null check (check_type in ('pan','identity','face_match','employment','income')),
  status text not null default 'pending' check (status in ('pending','passed','failed','needs_review')),
  detail text,
  updated_at timestamptz not null default now(),
  unique (request_id, check_type)
);

-- Row Level Security: landlords see only their own data. Tenants use the functions below (no direct table access).
alter table public.verification_requests enable row level security;
alter table public.consents enable row level security;
alter table public.documents enable row level security;
alter table public.checks enable row level security;

create policy "landlord manages own requests" on public.verification_requests
  for all to authenticated
  using (landlord_id = (select auth.uid()))
  with check (landlord_id = (select auth.uid()));

create policy "landlord reads own consents" on public.consents for select to authenticated
  using (exists (select 1 from public.verification_requests r where r.id = request_id and r.landlord_id = (select auth.uid())));
create policy "landlord reads own documents" on public.documents for select to authenticated
  using (exists (select 1 from public.verification_requests r where r.id = request_id and r.landlord_id = (select auth.uid())));
create policy "landlord reads own checks" on public.checks for select to authenticated
  using (exists (select 1 from public.verification_requests r where r.id = request_id and r.landlord_id = (select auth.uid())));

-- Tenant-side functions (tenant has no login; the secret link token is the key)
create or replace function public.get_tenant_request(p_token text)
returns table (tenant_name text, property_label text, status text, has_consent boolean)
language sql stable security definer set search_path = '' as $$
  select r.tenant_name, r.property_label, r.status,
         exists (select 1 from public.consents c where c.request_id = r.id)
  from public.verification_requests r
  where r.token = p_token and r.status <> 'withdrawn';
$$;

create or replace function public.submit_consent(p_token text, p_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if length(trim(coalesce(p_name,''))) < 3 then raise exception 'Please type your full name'; end if;
  select id into v_id from public.verification_requests
    where token = p_token and status in ('invited','in_progress');
  if v_id is null then raise exception 'This link is not active'; end if;
  insert into public.consents (request_id, signed_name) values (v_id, trim(p_name))
    on conflict (request_id) do nothing;
  update public.verification_requests set status = 'in_progress' where id = v_id;
end $$;

create or replace function public.register_document(p_token text, p_type text, p_path text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  select r.id into v_id from public.verification_requests r
    where r.token = p_token and r.status = 'in_progress'
      and exists (select 1 from public.consents c where c.request_id = r.id);
  if v_id is null then raise exception 'Consent required before uploading'; end if;
  if left(p_path, length(p_token) + 1) <> p_token || '/' then raise exception 'Invalid file path'; end if;
  insert into public.documents (request_id, doc_type, storage_path) values (v_id, p_type, p_path);
end $$;

create or replace function public.submit_tenant(p_token text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  select r.id into v_id from public.verification_requests r
    where r.token = p_token and r.status = 'in_progress';
  if v_id is null then raise exception 'This link is not active'; end if;
  update public.verification_requests set status = 'submitted' where id = v_id;
  insert into public.checks (request_id, check_type)
    select v_id, t from unnest(array['pan','identity','face_match','employment','income']) as t
    on conflict do nothing;
end $$;

create or replace function public.withdraw_consent(p_token text)
returns void language sql security definer set search_path = '' as $$
  update public.verification_requests set status = 'withdrawn' where token = p_token;
$$;

-- Helpers used by storage policies
create or replace function public.token_is_open(p_token text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.verification_requests r
    where r.token = p_token and r.status = 'in_progress'
      and exists (select 1 from public.consents c where c.request_id = r.id));
$$;
create or replace function public.owns_token(p_token text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.verification_requests r
    where r.token = p_token and r.landlord_id = (select auth.uid()));
$$;

revoke execute on all functions in schema public from public;
grant execute on function public.get_tenant_request(text), public.submit_consent(text,text),
  public.register_document(text,text,text), public.submit_tenant(text),
  public.withdraw_consent(text), public.token_is_open(text) to anon, authenticated;
grant execute on function public.owns_token(text) to authenticated;

-- Private storage bucket for tenant documents (5 MB, images/PDF only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tenant-docs', 'tenant-docs', false, 5242880, array['image/jpeg','image/png','application/pdf'])
on conflict (id) do nothing;

create policy "tenant uploads to own token folder" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'tenant-docs' and public.token_is_open((storage.foldername(name))[1]));

create policy "landlord reads own tenant files" on storage.objects
  for select to authenticated
  using (bucket_id = 'tenant-docs' and public.owns_token((storage.foldername(name))[1]));
