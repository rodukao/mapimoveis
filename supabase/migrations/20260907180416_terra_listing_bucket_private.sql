-- Version allocated by Supabase's migration service. Applied after client v12 deployment.
update storage.buckets set public=false where id='terra-listing-photos';
