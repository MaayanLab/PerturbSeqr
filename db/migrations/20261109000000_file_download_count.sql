-- migrate:up
-- Existing download-counters implementation; retain legacy object-key identities.
CREATE TABLE app_public.file_download (
 key varchar PRIMARY KEY,
 count bigint NOT NULL DEFAULT 0
);
GRANT SELECT ON app_public.file_download TO guest,authenticated;
CREATE FUNCTION app_public.increment_file_download(key varchar) RETURNS app_public.file_download
LANGUAGE sql SECURITY DEFINER AS $$
 INSERT INTO app_public.file_download(key,count)
 SELECT increment_file_download.key,1 WHERE increment_file_download.key ~ '^[A-Za-z0-9._-]{1,200}$'
 ON CONFLICT(key) DO UPDATE SET count=app_public.file_download.count+1 RETURNING *;
$$;
GRANT EXECUTE ON FUNCTION app_public.increment_file_download TO guest,authenticated;
-- migrate:down
DROP FUNCTION app_public.increment_file_download;
DROP TABLE app_public.file_download;
