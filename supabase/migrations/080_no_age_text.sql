-- 080 배우 나이는 어떤 형태로도 보여 주지 않음: 저장된 후보 소개와 추천 이유에서 나이 문구를 지움
update candidates set pick_why = null where pick_why ~ '[0-9]+ ?살';
update candidates c set blurb = jsonb_set(c.blurb, '{reasons}', coalesce((select jsonb_agg(x) from jsonb_array_elements(c.blurb->'reasons') x
      where x->>'k' is distinct from 'age' and coalesce(x->>'text','') !~ '[0-9]+ ?살'), '[]'::jsonb))
where jsonb_typeof(c.blurb->'reasons')='array' and ((c.blurb->'reasons')::text ~ '"k": ?"age"' or (c.blurb->'reasons')::text ~ '[0-9]+ ?살');
update candidates c set blurb = jsonb_set(c.blurb, '{why}', coalesce(to_jsonb(c.blurb->'reasons'->0->>'text'), 'null'::jsonb))
where c.blurb->>'why' ~ '[0-9]+ ?살';

-- 앞으로 저장되는 후보 문구에도 나이가 들어가지 않게 저장 직전에 걸러 냄
create or replace function public.cand_no_age() returns trigger language plpgsql as $$
begin
  if new.pick_why ~ '[0-9]+ ?살' then new.pick_why := null; end if;
  if jsonb_typeof(new.blurb->'reasons')='array' then
    new.blurb := jsonb_set(new.blurb, '{reasons}', coalesce((select jsonb_agg(x) from jsonb_array_elements(new.blurb->'reasons') x
      where x->>'k' is distinct from 'age' and coalesce(x->>'text','') !~ '[0-9]+ ?살'), '[]'::jsonb));
  end if;
  if new.blurb->>'why' ~ '[0-9]+ ?살' then new.blurb := jsonb_set(new.blurb, '{why}', coalesce(to_jsonb(new.blurb->'reasons'->0->>'text'), 'null'::jsonb)); end if;
  return new;
end $$;
drop trigger if exists cand_no_age on candidates;
create trigger cand_no_age before insert or update of pick_why, blurb on candidates for each row execute function cand_no_age();

-- my_insights의 age 항목은 빈 배열로 바꿈(080c, 함수 본문을 DB에서 직접 치환)
