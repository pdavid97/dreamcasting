-- 076 실화 캐스팅: 기사 링크를 판 링크로 옮기는 트리거(073c), 전기 영화 월간 수집, 실화 판 초안 주간 생성
create or replace function public.topics_auto_links() returns trigger language plpgsql as $$
begin
  if new.links is null and new.auto ? 'news' and new.auto->'news'->>'u' is not null then
    new.links := jsonb_build_array(jsonb_build_object('url', new.auto->'news'->>'u', 't', new.auto->'news'->>'t', 's', new.auto->'news'->>'s'));
  end if;
  return new;
end $$;
drop trigger if exists topics_auto_links on topics;
create trigger topics_auto_links before insert or update of auto on topics for each row execute function topics_auto_links();
update topics set auto = auto where auto ? 'news' and links is null;

select cron.schedule('dc-ipsync-biopic', '46 19 2 * *', $c$select net.http_post(url:='https://dnzcvbidppzaogtmwamc.supabase.co/functions/v1/ipsync', headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuemN2YmlkcHB6YW9ndG13YW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUyODgwNzgsImV4cCI6MjExMDg2NDA3OH0.yiKbCh3iuH8_GFpx-ezzbauZNOkffOe5cuIGKUQGBIE'), body:='{"grp":"biopic"}'::jsonb, timeout_milliseconds:=150000)$c$);
select cron.schedule('dc-autogen-bio-weekly', '51 4 * * 3', $c$select net.http_post(url:='https://dnzcvbidppzaogtmwamc.supabase.co/functions/v1/autogen', headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuemN2YmlkcHB6YW9ndG13YW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUyODgwNzgsImV4cCI6MjExMDg2NDA3OH0.yiKbCh3iuH8_GFpx-ezzbauZNOkffOe5cuIGKUQGBIE'), body:='{"bio":true,"n":3}'::jsonb, timeout_milliseconds:=150000)$c$);
