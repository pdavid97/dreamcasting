alter table topics drop constraint if exists topics_cat_check;
alter table topics add constraint topics_cat_check check (cat = any (array['wn','k2','us2k','k2us','k2cn','k2tw','k2hk','ip2live','live2x','bio']));
