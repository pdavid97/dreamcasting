-- 후보 한 줄 소개: 최근작과 후보 이유(TMDB 데이터 기반 문장). Edge Function blurb가 채움
alter table candidates add column if not exists blurb jsonb;
alter table candidates add column if not exists blurb_at timestamptz;

CREATE OR REPLACE FUNCTION public.vote_deck(lim integer DEFAULT 12)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare tp jsonb := case when auth.uid() is null then null else taste_profile(auth.uid()) end; res jsonb;
begin
  with base as (
    select t.*,
      coalesce((tp->'cats'->>t.cat)::numeric, 0) as cat_fit,
      coalesce((select sum((tp->'tags'->>g)::numeric) from unnest(t.tags) g where tp->'tags' ? g), 0) as tag_fit,
      (select count(*) from candidates c join roles r on r.id = c.role_id where r.topic_id = t.id and c.person_id in (select (a->>'id')::bigint from jsonb_array_elements(coalesce(tp->'actors','[]')) a)) as actor_fit,
      (select count(*) from roles r where r.topic_id = t.id and r.slot is not null and r.stage in ('dream','rumor')) as nroles,
      (select count(*) from votes v join roles r on r.id = v.role_id where r.topic_id = t.id and r.slot is not null and v.user_id = auth.uid()) as mine
    from topics t where t.closed_at is null and t.closes_at > now()
      and exists(select 1 from roles r where r.topic_id = t.id and r.slot is not null and r.stage in ('dream','rumor'))
  ), ranked as (
    select b.*, (b.buzz + least(b.cat_fit, 10) * 3 + least(b.tag_fit, 10) * 2 + least(b.actor_fit, 3) * 8 - case when b.mine >= b.nroles then 100 else 0 end) as score,
      case when b.actor_fit > 0 then 'fan' when b.cat_fit + b.tag_fit > 0 then 'taste' else 'buzz' end as why
    from base b order by score desc, b.sort limit lim)
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'cat', t.cat, 'info', t.info, 'buzz', t.buzz, 'score', round(t.score, 1), 'why', t.why,
      'news', t.buzz_meta->'news', 'nnews', t.buzz_meta->'n', 'trending', t.buzz_meta->'trending',
      'poster', coalesce(t.work->>'backdrop', t.work->>'poster'), 'vposter', t.work->>'poster', 'closes_at', t.closes_at, 'seen', can_see(t.id), 'done', t.mine >= t.nroles,
      'roles', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'ch', r.ch, 'slot', r.slot, 'orig', r.orig, 'age', r.age_hint, 'descr', r.descr,
          'mine', (select candidate_id from votes v where v.role_id = r.id and v.user_id = auth.uid()),
          'cands', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'blurb', c.blurb, 'votes', case when can_see(t.id) then (select coalesce(sum(weight),0) from votes v where v.candidate_id = c.id) end) order by c.id), '[]') from candidates c where c.role_id = r.id)
        ) order by array_position(array['male_lead','female_lead','lead','male_sub','female_sub','support'], r.slot), r.pos), '[]')
        from roles r where r.topic_id = t.id and r.slot is not null and r.stage in ('dream','rumor'))) order by t.score desc), '[]') into res
  from ranked t;
  return res;
end $function$;

-- cand_pitch
alter table candidates add column if not exists pitch text check (pitch is null or char_length(pitch) <= 80);
alter table candidates add column if not exists kind text not null default 'actor' check (kind in ('actor','comedian','singer','stage','musical','influencer','youtuber','idol','other'));
