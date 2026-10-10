-- ============================================================
-- مناحل انيس بن دحمان — مخطط قاعدة البيانات (PostgreSQL / Supabase)
-- شغّل هذا الملف في Supabase: SQL Editor، ثم 002_seed.sql
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- أدوات عامة ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), 'customer')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- products ----------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_description text,
  description text,
  queen_type text not null check (queen_type in ('virgin', 'mated')),
  is_offer boolean not null default false,
  breed text,                       -- السلالة / الأصل الوراثي (يدخلها المسؤول فقط)
  price numeric(12, 2) not null check (price >= 0),
  sale_price numeric(12, 2) check (sale_price is null or sale_price >= 0),
  max_per_order integer check (max_per_order is null or max_per_order > 0) default 10,
  delivery_notes text,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  is_best_seller boolean not null default false,
  sort_order integer not null default 0,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_products_updated on public.products;
create trigger trg_products_updated before update on public.products
  for each row execute function public.set_updated_at();

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  storage_path text,
  alt_text text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_product_images_product on public.product_images(product_id);

-- ---------- product_batches (المخزون والدفعات والحجز المسبق) ----------
create table if not exists public.product_batches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  label text not null default 'الدفعة الحالية',
  batch_code text,
  hatch_date date,
  mating_date date,
  production_date date,
  total_qty integer not null default 0 check (total_qty >= 0),
  reserved_qty integer not null default 0 check (reserved_qty >= 0),       -- محجوز لطلبات لم تُشحن بعد (تلقائي)
  sold_qty integer not null default 0 check (sold_qty >= 0),               -- طلبات تم شحنها/تسليمها (تلقائي)
  manual_reserved_qty integer not null default 0 check (manual_reserved_qty >= 0), -- حجز يدوي من المسؤول
  available_qty integer generated always as (total_qty - reserved_qty - sold_qty - manual_reserved_qty) stored,
  is_preorder boolean not null default false,
  preorder_start timestamptz,
  preorder_end timestamptz,
  expected_delivery_date date,
  deposit_amount numeric(12, 2) not null default 0 check (deposit_amount >= 0), -- عربون لكل ملكة
  cancellation_terms text,
  is_open boolean not null default true,     -- فتح/إغلاق الطلبات على هذه الدفعة
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_no_oversell check (reserved_qty + sold_qty + manual_reserved_qty <= total_qty)
);
create index if not exists idx_batches_product on public.product_batches(product_id);
drop trigger if exists trg_batches_updated on public.product_batches;
create trigger trg_batches_updated before update on public.product_batches
  for each row execute function public.set_updated_at();

-- ---------- الولايات والبلديات والتوصيل ----------
create table if not exists public.wilayas (
  id smallint primary key,                    -- رمز الولاية
  name_ar text not null,
  name_fr text,
  is_active boolean not null default false,   -- التوصيل مفعّل؟
  orders_paused boolean not null default false, -- إغلاق مؤقت للطلبات
  delivery_time text,                         -- مثال: 2 إلى 4 أيام
  min_order numeric(12, 2) not null default 0,
  carriers text,                              -- شركات التوصيل المدعومة
  notes text,
  sort_order integer not null default 0
);

create table if not exists public.communes (
  id bigint generated always as identity primary key,
  wilaya_id smallint not null references public.wilayas(id) on delete cascade,
  name_ar text not null,
  is_active boolean not null default true,
  unique (wilaya_id, name_ar)
);
create index if not exists idx_communes_wilaya on public.communes(wilaya_id);

create table if not exists public.shipping_rates (
  id bigint generated always as identity primary key,
  wilaya_id smallint not null references public.wilayas(id) on delete cascade,
  method text not null check (method in ('home', 'office', 'pickup')),
  price numeric(12, 2) not null default 0 check (price >= 0),
  is_enabled boolean not null default false,
  unique (wilaya_id, method)
);

-- ---------- coupons ----------
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('fixed', 'percent')),
  value numeric(12, 2) not null check (value > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  min_order numeric(12, 2) not null default 0,
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint chk_percent check (discount_type <> 'percent' or value <= 100)
);

-- ---------- orders ----------
create sequence if not exists public.order_seq start 1001;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  status text not null default 'new' check (status in (
    'new', 'pending_customer', 'confirmed', 'preparing',
    'shipped', 'delivered', 'cancelled', 'undeliverable')),
  customer_name text not null,
  phone text not null,
  whatsapp text,
  wilaya_id smallint not null references public.wilayas(id),
  wilaya_name text not null,
  commune_name text not null,
  address text not null,
  delivery_method text not null check (delivery_method in ('home', 'office', 'pickup')),
  payment_method text not null,
  notes text,
  subtotal numeric(12, 2) not null,
  shipping_cost numeric(12, 2) not null default 0,
  discount_total numeric(12, 2) not null default 0,
  total numeric(12, 2) not null,
  deposit_total numeric(12, 2) not null default 0,
  coupon_code text,
  tracking_number text,
  carrier text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_created on public.orders(created_at desc);
create index if not exists idx_orders_phone on public.orders(phone);
drop trigger if exists trg_orders_updated on public.orders;
create trigger trg_orders_updated before update on public.orders
  for each row execute function public.set_updated_at();

-- يمنع تغيير حالة الطلب إلا عبر الدالة التي تدير المخزون
create or replace function public.guard_order_status()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('app.status_via_fn', true), '') <> '1' then
    raise exception 'لا يمكن تغيير حالة الطلب إلا عبر admin_set_order_status';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_orders_guard_status on public.orders;
create trigger trg_orders_guard_status before update on public.orders
  for each row execute function public.guard_order_status();

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  batch_id uuid references public.product_batches(id) on delete set null,
  product_name text not null,
  batch_label text,
  queen_type text,
  is_preorder boolean not null default false,
  unit_price numeric(12, 2) not null,
  qty integer not null check (qty > 0),
  line_total numeric(12, 2) not null
);
create index if not exists idx_order_items_order on public.order_items(order_id);

create table if not exists public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  batch_id uuid not null references public.product_batches(id) on delete restrict,
  qty integer not null check (qty > 0),
  status text not null default 'active' check (status in ('active', 'consumed', 'released')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_reservations_order on public.inventory_reservations(order_id);
create index if not exists idx_reservations_batch on public.inventory_reservations(batch_id);

create table if not exists public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_history_order on public.order_status_history(order_id);

-- ---------- المحتوى والإعدادات ----------
create table if not exists public.store_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_settings_updated on public.store_settings;
create trigger trg_settings_updated before update on public.store_settings
  for each row execute function public.set_updated_at();

create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text,
  body text,
  cover_url text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_articles_updated on public.articles;
create trigger trg_articles_updated before update on public.articles
  for each row execute function public.set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_batches enable row level security;
alter table public.wilayas enable row level security;
alter table public.communes enable row level security;
alter table public.shipping_rates enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.inventory_reservations enable row level security;
alter table public.order_status_history enable row level security;
alter table public.store_settings enable row level security;
alter table public.faqs enable row level security;
alter table public.articles enable row level security;

-- profiles: كل مستخدم يرى ملفه، والمسؤول يرى ويعدّل الجميع (لا أحد يرفع صلاحيته بنفسه)
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy profiles_admin_update on public.profiles for update
  using (public.is_admin()) with check (public.is_admin());

-- products
create policy products_public_read on public.products for select
  using (is_active or public.is_admin());
create policy products_admin_all on public.products for all
  using (public.is_admin()) with check (public.is_admin());

create policy images_public_read on public.product_images for select
  using (exists (select 1 from public.products p where p.id = product_id and (p.is_active or public.is_admin())));
create policy images_admin_all on public.product_images for all
  using (public.is_admin()) with check (public.is_admin());

-- الدفعات: للمسؤول فقط مباشرة. الزوار يقرؤون من العرض public_batches
create policy batches_admin_all on public.product_batches for all
  using (public.is_admin()) with check (public.is_admin());

-- الولايات والتوصيل: قراءة عامة، تعديل للمسؤول
create policy wilayas_read on public.wilayas for select using (true);
create policy wilayas_admin_all on public.wilayas for all
  using (public.is_admin()) with check (public.is_admin());
create policy communes_read on public.communes for select using (is_active or public.is_admin());
create policy communes_admin_all on public.communes for all
  using (public.is_admin()) with check (public.is_admin());
create policy rates_read on public.shipping_rates for select using (is_enabled or public.is_admin());
create policy rates_admin_all on public.shipping_rates for all
  using (public.is_admin()) with check (public.is_admin());

-- الطلبات وبيانات العملاء والمخزون الداخلي: للمسؤول فقط
create policy coupons_admin_all on public.coupons for all
  using (public.is_admin()) with check (public.is_admin());
create policy orders_admin_all on public.orders for all
  using (public.is_admin()) with check (public.is_admin());
create policy order_items_admin_all on public.order_items for all
  using (public.is_admin()) with check (public.is_admin());
create policy reservations_admin_all on public.inventory_reservations for all
  using (public.is_admin()) with check (public.is_admin());
create policy history_admin_all on public.order_status_history for all
  using (public.is_admin()) with check (public.is_admin());

-- المحتوى
create policy settings_read on public.store_settings for select using (true);
create policy settings_admin_all on public.store_settings for all
  using (public.is_admin()) with check (public.is_admin());
create policy faqs_read on public.faqs for select using (is_active or public.is_admin());
create policy faqs_admin_all on public.faqs for all
  using (public.is_admin()) with check (public.is_admin());
create policy articles_read on public.articles for select using (is_published or public.is_admin());
create policy articles_admin_all on public.articles for all
  using (public.is_admin()) with check (public.is_admin());

-- عرض عام للدفعات: يكشف الكمية المتبقية فقط، لا الكميات المحجوزة أو المباعة
drop view if exists public.public_batches;
create view public.public_batches as
  select b.id, b.product_id, b.label, b.batch_code, b.hatch_date, b.mating_date,
         b.production_date, greatest(b.available_qty, 0) as available_qty,
         b.is_preorder, b.preorder_start, b.preorder_end, b.expected_delivery_date,
         b.deposit_amount, b.cancellation_terms, b.is_open
  from public.product_batches b
  join public.products p on p.id = b.product_id
  where b.is_active and p.is_active;
grant select on public.public_batches to anon, authenticated;

-- ============================================================
-- منطق الطلب والمخزون (يعمل على الخادم فقط)
-- ============================================================

-- تطبيع رقم الهاتف الجزائري: 0555123456
create or replace function public._norm_phone(p text)
returns text language plpgsql immutable as $$
declare s text;
begin
  if p is null then return null; end if;
  s := regexp_replace(p, '[^0-9+]', '', 'g');
  if s like '+213%' then s := '0' || substr(s, 5);
  elsif s like '00213%' then s := '0' || substr(s, 6);
  end if;
  return s;
end;
$$;

-- حساب السعر والتحقق من المخزون والتوصيل والقسيمة. المصدر الوحيد للأسعار.
create or replace function public._calc_order(
  p_items jsonb, p_wilaya int, p_method text, p_coupon text, p_lock boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  rec record;
  b public.product_batches;
  pr public.products;
  w public.wilayas;
  sr public.shipping_rates;
  c public.coupons;
  v_lines jsonb := '[]'::jsonb;
  v_subtotal numeric := 0;
  v_deposit numeric := 0;
  v_ship numeric := 0;
  v_disc numeric := 0;
  v_unit numeric;
  v_code text := null;
  v_count int;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'السلة فارغة';
  end if;
  if jsonb_array_length(p_items) > 30 then
    raise exception 'عدد عناصر الطلب كبير جدًا';
  end if;

  -- تجميع نفس الدفعة، وترتيب ثابت لتفادي التعارض بين الطلبات المتزامنة
  for rec in
    select (x->>'batch_id')::uuid as batch_id, sum((x->>'qty')::int) as qty
    from jsonb_array_elements(p_items) x
    group by 1
    order by 1
  loop
    if rec.qty is null or rec.qty <= 0 then
      raise exception 'كمية غير صالحة';
    end if;

    if p_lock then
      select * into b from public.product_batches where id = rec.batch_id for update;
    else
      select * into b from public.product_batches where id = rec.batch_id;
    end if;
    if not found then raise exception 'منتج غير موجود'; end if;

    select * into pr from public.products where id = b.product_id;
    if not found or not pr.is_active or not b.is_active then
      raise exception 'المنتج "%" غير متاح حاليًا', coalesce(pr.name, '');
    end if;
    if not b.is_open then
      raise exception 'الطلبات مغلقة حاليًا على "%"', pr.name;
    end if;
    if b.is_preorder then
      if b.preorder_start is not null and now() < b.preorder_start then
        raise exception 'الحجز المسبق لـ "%" لم يبدأ بعد', pr.name;
      end if;
      if b.preorder_end is not null and now() > b.preorder_end then
        raise exception 'انتهى الحجز المسبق لـ "%"', pr.name;
      end if;
    end if;
    if b.available_qty <= 0 then
      raise exception 'نفد مخزون "%"', pr.name;
    end if;
    if rec.qty > b.available_qty then
      raise exception 'الكمية المتاحة من "%" هي % فقط', pr.name, b.available_qty;
    end if;

    v_unit := coalesce(pr.sale_price, pr.price);
    v_subtotal := v_subtotal + v_unit * rec.qty;
    if b.is_preorder then
      v_deposit := v_deposit + b.deposit_amount * rec.qty;
    end if;

    v_lines := v_lines || jsonb_build_object(
      'product_id', pr.id, 'batch_id', b.id, 'product_name', pr.name,
      'batch_label', b.label, 'queen_type', pr.queen_type, 'is_preorder', b.is_preorder,
      'unit_price', v_unit, 'qty', rec.qty, 'line_total', v_unit * rec.qty,
      'expected_delivery_date', b.expected_delivery_date);
  end loop;

  -- الحد الأقصى للكمية في الطلب لكل منتج (مجموع الدفعات)
  select count(*) into v_count from (
    select l->>'product_id' as pid, sum((l->>'qty')::int) as q
    from jsonb_array_elements(v_lines) l group by 1
  ) t
  join public.products p on p.id = t.pid::uuid
  where p.max_per_order is not null and t.q > p.max_per_order;
  if v_count > 0 then
    raise exception 'تجاوزت الحد الأقصى المسموح به للكمية في الطلب الواحد';
  end if;

  -- الولاية والتوصيل
  select * into w from public.wilayas where id = p_wilaya;
  if not found or not w.is_active then
    raise exception 'التوصيل إلى هذه الولاية غير متاح حاليًا';
  end if;
  if w.orders_paused then
    raise exception 'الطلبات إلى ولاية % متوقفة مؤقتًا', w.name_ar;
  end if;
  select * into sr from public.shipping_rates
    where wilaya_id = p_wilaya and method = p_method and is_enabled;
  if not found then
    raise exception 'طريقة التوصيل المختارة غير متاحة لهذه الولاية';
  end if;
  if w.min_order > v_subtotal then
    raise exception 'الحد الأدنى للطلب إلى ولاية % هو % دج', w.name_ar, w.min_order::bigint;
  end if;
  v_ship := sr.price;

  -- القسيمة
  if p_coupon is not null and btrim(p_coupon) <> '' then
    if p_lock then
      select * into c from public.coupons where code = upper(btrim(p_coupon)) for update;
    else
      select * into c from public.coupons where code = upper(btrim(p_coupon));
    end if;
    if not found or not c.is_active then raise exception 'رمز الخصم غير صالح'; end if;
    if c.starts_at is not null and now() < c.starts_at then raise exception 'رمز الخصم لم يبدأ بعد'; end if;
    if c.ends_at is not null and now() > c.ends_at then raise exception 'انتهت صلاحية رمز الخصم'; end if;
    if c.max_uses is not null and c.used_count >= c.max_uses then raise exception 'تم استنفاد رمز الخصم'; end if;
    if c.min_order > v_subtotal then
      raise exception 'رمز الخصم يتطلب طلبًا لا يقل عن % دج', c.min_order::bigint;
    end if;
    if c.discount_type = 'percent' then
      v_disc := round(v_subtotal * c.value / 100);
    else
      v_disc := c.value;
    end if;
    v_disc := least(v_disc, v_subtotal);
    v_code := c.code;
  end if;

  return jsonb_build_object(
    'lines', v_lines, 'subtotal', v_subtotal, 'shipping', v_ship,
    'discount', v_disc, 'total', v_subtotal + v_ship - v_disc,
    'deposit', v_deposit, 'coupon_code', v_code,
    'wilaya_name', w.name_ar, 'delivery_time', w.delivery_time);
end;
$$;

-- عرض أسعار للسلة (بدون حجز)
create or replace function public.quote_order(
  p_items jsonb, p_wilaya int, p_method text, p_coupon text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return public._calc_order(p_items, p_wilaya, p_method, p_coupon, false);
end;
$$;

-- إنشاء الطلب وحجز المخزون ذريًا
create or replace function public.place_order(p_order jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_calc jsonb;
  v_name text := btrim(coalesce(p_order->>'customer_name', ''));
  v_phone text := public._norm_phone(p_order->>'phone');
  v_wa text := nullif(public._norm_phone(p_order->>'whatsapp'), '');
  v_wilaya int := (p_order->>'wilaya_id')::int;
  v_commune text := btrim(coalesce(p_order->>'commune', ''));
  v_address text := btrim(coalesce(p_order->>'address', ''));
  v_method text := p_order->>'delivery_method';
  v_pay text := p_order->>'payment_method';
  v_notes text := nullif(btrim(coalesce(p_order->>'notes', '')), '');
  v_pay_ok boolean;
  v_order_id uuid;
  v_number text;
  v_line jsonb;
  v_item_id uuid;
  v_recent int;
begin
  if char_length(v_name) < 3 or char_length(v_name) > 80 then raise exception 'يرجى إدخال الاسم واللقب'; end if;
  if coalesce(v_phone, '') !~ '^0[567][0-9]{8}$' then raise exception 'رقم الهاتف غير صالح (مثال: 0555123456)'; end if;
  if v_wa is not null and v_wa !~ '^0[567][0-9]{8}$' then raise exception 'رقم واتساب غير صالح'; end if;
  if char_length(v_commune) < 2 then raise exception 'يرجى إدخال البلدية'; end if;
  if char_length(v_address) < 5 or char_length(v_address) > 300 then raise exception 'يرجى إدخال العنوان بالتفصيل'; end if;
  if v_notes is not null and char_length(v_notes) > 500 then raise exception 'الملاحظات طويلة جدًا'; end if;

  -- طريقة الدفع يجب أن تكون مفعّلة في الإعدادات
  select exists (
    select 1 from public.store_settings s, jsonb_array_elements(s.value) m
    where s.key = 'payment_methods' and m->>'id' = v_pay and coalesce((m->>'enabled')::boolean, false)
  ) into v_pay_ok;
  if not coalesce(v_pay_ok, false) then raise exception 'طريقة الدفع غير متاحة'; end if;

  -- حماية بسيطة من الإغراق
  select count(*) into v_recent from public.orders
    where phone = v_phone and created_at > now() - interval '1 hour';
  if v_recent >= 5 then raise exception 'عدد كبير من الطلبات من نفس الرقم، حاول لاحقًا'; end if;

  v_calc := public._calc_order(p_order->'items', v_wilaya, v_method, p_order->>'coupon', true);

  v_number := 'AB-' || to_char(now() at time zone 'Africa/Algiers', 'YYMMDD') || '-'
              || lpad(nextval('public.order_seq')::text, 4, '0');

  insert into public.orders (
    order_number, status, customer_name, phone, whatsapp, wilaya_id, wilaya_name,
    commune_name, address, delivery_method, payment_method, notes,
    subtotal, shipping_cost, discount_total, total, deposit_total, coupon_code)
  values (
    v_number, 'new', v_name, v_phone, v_wa, v_wilaya, v_calc->>'wilaya_name',
    v_commune, v_address, v_method, v_pay, v_notes,
    (v_calc->>'subtotal')::numeric, (v_calc->>'shipping')::numeric,
    (v_calc->>'discount')::numeric, (v_calc->>'total')::numeric,
    (v_calc->>'deposit')::numeric, v_calc->>'coupon_code')
  returning id into v_order_id;

  for v_line in select * from jsonb_array_elements(v_calc->'lines') loop
    insert into public.order_items (
      order_id, product_id, batch_id, product_name, batch_label, queen_type,
      is_preorder, unit_price, qty, line_total)
    values (
      v_order_id, (v_line->>'product_id')::uuid, (v_line->>'batch_id')::uuid,
      v_line->>'product_name', v_line->>'batch_label', v_line->>'queen_type',
      (v_line->>'is_preorder')::boolean, (v_line->>'unit_price')::numeric,
      (v_line->>'qty')::int, (v_line->>'line_total')::numeric)
    returning id into v_item_id;

    insert into public.inventory_reservations (order_id, order_item_id, batch_id, qty, status)
    values (v_order_id, v_item_id, (v_line->>'batch_id')::uuid, (v_line->>'qty')::int, 'active');

    update public.product_batches
      set reserved_qty = reserved_qty + (v_line->>'qty')::int
      where id = (v_line->>'batch_id')::uuid;
  end loop;

  if v_calc->>'coupon_code' is not null then
    update public.coupons set used_count = used_count + 1 where code = v_calc->>'coupon_code';
  end if;

  insert into public.order_status_history (order_id, from_status, to_status, note)
  values (v_order_id, null, 'new', 'تم إنشاء الطلب من المتجر');

  return v_calc || jsonb_build_object(
    'order_number', v_number, 'status', 'new', 'payment_method', v_pay,
    'delivery_method', v_method, 'customer_name', v_name);
end;
$$;

-- تتبع الطلب للعميل بدون حساب: رقم الطلب + رقم الهاتف
create or replace function public.track_order(p_order_number text, p_phone text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders
    where order_number = upper(btrim(p_order_number)) and phone = public._norm_phone(p_phone);
  if not found then raise exception 'لم يتم العثور على الطلب، تحقق من رقم الطلب ورقم الهاتف'; end if;
  return jsonb_build_object(
    'order_number', o.order_number, 'status', o.status, 'created_at', o.created_at,
    'wilaya_name', o.wilaya_name, 'subtotal', o.subtotal, 'shipping_cost', o.shipping_cost,
    'discount_total', o.discount_total, 'total', o.total, 'deposit_total', o.deposit_total,
    'tracking_number', o.tracking_number, 'carrier', o.carrier,
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
        'product_name', i.product_name, 'qty', i.qty, 'line_total', i.line_total)), '[]'::jsonb)
      from public.order_items i where i.order_id = o.id),
    'history', (select coalesce(jsonb_agg(jsonb_build_object(
        'to_status', h.to_status, 'created_at', h.created_at) order by h.created_at), '[]'::jsonb)
      from public.order_status_history h where h.order_id = o.id));
end;
$$;

-- مزامنة الحجوزات مع حالة الطلب (idempotent: لا خصم مزدوج أبدًا)
--   حالات الحجز: new / pending_customer / confirmed / preparing  -> active
--   shipped / delivered                                           -> consumed
--   cancelled / undeliverable                                     -> released
create or replace function public._sync_reservations(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_target text;
  r record;
begin
  select status into v_status from public.orders where id = p_order;
  v_target := case
    when v_status in ('shipped', 'delivered') then 'consumed'
    when v_status in ('cancelled', 'undeliverable') then 'released'
    else 'active' end;

  for r in
    select * from public.inventory_reservations
    where order_id = p_order order by batch_id for update
  loop
    if r.status = v_target then continue; end if;
    perform 1 from public.product_batches where id = r.batch_id for update;
    update public.product_batches set
      reserved_qty = reserved_qty - (case when r.status = 'active' then r.qty else 0 end)
                                  + (case when v_target = 'active' then r.qty else 0 end),
      sold_qty = sold_qty - (case when r.status = 'consumed' then r.qty else 0 end)
                          + (case when v_target = 'consumed' then r.qty else 0 end)
    where id = r.batch_id;
    update public.inventory_reservations set status = v_target, updated_at = now() where id = r.id;
  end loop;
end;
$$;

-- تغيير حالة الطلب (للمسؤول فقط)
create or replace function public.admin_set_order_status(
  p_order_id uuid, p_status text, p_note text default null
) returns void language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  if not public.is_admin() then raise exception 'غير مصرح'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'الطلب غير موجود'; end if;
  if o.status = p_status then return; end if;

  perform set_config('app.status_via_fn', '1', true);
  update public.orders set status = p_status where id = p_order_id;
  perform public._sync_reservations(p_order_id);
  insert into public.order_status_history (order_id, from_status, to_status, note, changed_by)
  values (p_order_id, o.status, p_status, p_note, auth.uid());
end;
$$;

-- إحصائيات لوحة التحكم (للمسؤول فقط)
create or replace function public.admin_stats()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.is_admin() then raise exception 'غير مصرح'; end if;
  select jsonb_build_object(
    'orders_total', (select count(*) from public.orders),
    'by_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                  from (select status, count(*) n from public.orders group by status) s),
    'sales_total', (select coalesce(sum(total), 0) from public.orders
                    where status not in ('cancelled', 'undeliverable')),
    'delivered_sales', (select coalesce(sum(total), 0) from public.orders where status = 'delivered'),
    'available_qty', (select coalesce(sum(greatest(available_qty, 0)), 0)
                      from public.product_batches where is_active),
    'reserved_qty', (select coalesce(sum(reserved_qty + manual_reserved_qty), 0)
                     from public.product_batches where is_active),
    'low_stock', (select coalesce(jsonb_agg(jsonb_build_object(
                    'product', p.name, 'batch', b.label, 'available', b.available_qty)), '[]'::jsonb)
                  from public.product_batches b join public.products p on p.id = b.product_id
                  where b.is_active and p.is_active and b.available_qty <= 5)
  ) into v;
  return v;
end;
$$;

-- الصلاحيات: الدوال الداخلية لا تُستدعى من العميل
revoke all on function public._calc_order(jsonb, int, text, text, boolean) from public, anon, authenticated;
revoke all on function public._sync_reservations(uuid) from public, anon, authenticated;
revoke all on function public.admin_set_order_status(uuid, text, text) from public, anon;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.quote_order(jsonb, int, text, text) to anon, authenticated;
grant execute on function public.place_order(jsonb) to anon, authenticated;
grant execute on function public.track_order(text, text) to anon, authenticated;
grant execute on function public.admin_set_order_status(uuid, text, text) to authenticated;
grant execute on function public.admin_stats() to authenticated;

-- ============================================================
-- تخزين الصور (Supabase Storage)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store-media', 'store-media', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy "store_media_public_read" on storage.objects for select
  using (bucket_id = 'store-media');
create policy "store_media_admin_insert" on storage.objects for insert
  with check (bucket_id = 'store-media' and public.is_admin());
create policy "store_media_admin_update" on storage.objects for update
  using (bucket_id = 'store-media' and public.is_admin());
create policy "store_media_admin_delete" on storage.objects for delete
  using (bucket_id = 'store-media' and public.is_admin());
