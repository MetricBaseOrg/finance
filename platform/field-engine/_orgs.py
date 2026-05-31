import os, psycopg
c = psycopg.connect(os.environ["PGDSN"])
rows = c.execute('''
  select o.id, o.name, o.slug,
         (select count(*) from "Membership" m where m."organizationId"=o.id) as members
  from "Organization" o order by members desc
''').fetchall()
for r in rows:
    print(r)
