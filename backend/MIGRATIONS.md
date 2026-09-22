# Database Migrations with Alembic (Dual Workmode: Dev & Prod)

This document explains how database migrations are configured, managed, and executed in **ResearchTube** across both **Local Development** (Docker PostgreSQL) and **Production** (Supabase / Hosted PostgreSQL).

---

## 1. Overview & Dual Workmode

The migration system uses [Alembic](https://alembic.sqlalchemy.org/) configured with **asynchronous SQLAlchemy 2.0 (`asyncpg`)** and native `pgvector` support.

### How Dual Workmode Works
Alembic dynamically detects which database to target using the `-x env=<mode>` command-line option, falling back to the `ENVIRONMENT` variable in `.env`:

| Mode | Flag | Target Database | Description |
| :--- | :--- | :--- | :--- |
| **Development** | `-x env=dev` | `DATABASE_URL` | Local Docker PostgreSQL (`localhost:5432` or container `postgres:5432`) |
| **Production** | `-x env=prod` | `PROD_DATABASE_URL` | Hosted PostgreSQL (e.g., Supabase / Neon / RDS) with pooler support |

---

## 2. Environment Configuration

Ensure your `.env` file in `backend/` has the following variables configured:

```ini
# Environment selector ('dev' or 'prod')
ENVIRONMENT=dev

# Local Docker PostgreSQL
DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/youtube_research

# Production Hosted PostgreSQL (Supabase pooler or direct connection)
PROD_DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
```

> [!NOTE]
> - `alembic/env.py` automatically translates `postgresql://` to `postgresql+asyncpg://` if needed.
> - When targeting Supabase connection poolers (port 6543), `alembic/env.py` automatically configures `statement_cache_size = 0` to prevent PgBouncer prepared-statement conflicts.
> - When running from your host machine (Windows/Mac/Linux outside Docker), `alembic/env.py` automatically routes `postgres:5432` to `localhost:5432`.

---

## 3. Local Development Migrations (`dev`)

You can run migration commands either **inside the Docker container** or **from your local Python virtual environment**.

### Option A: Running via Docker Compose (Recommended)

```bash
# Check current database revision
docker compose exec api alembic -x env=dev current

# Preview SQL statements without executing (dry-run)
docker compose exec api alembic -x env=dev upgrade head --sql

# If your database already has tables created before Alembic (marks existing schema as up-to-date without re-creating):
docker compose exec api alembic -x env=dev stamp head

# Apply pending migrations to local dev database:
docker compose exec api alembic -x env=dev upgrade head
```

### Option B: Running from Host Machine (Python venv)

From the `backend/` directory:

```powershell
# Activate venv (Windows PowerShell)
.\venv\Scripts\Activate.ps1

# Check current revision
alembic -x env=dev current

# Stamp existing tables (if tables already exist and you are initializing Alembic):
alembic -x env=dev stamp head

# Apply pending migrations:
alembic -x env=dev upgrade head
```

---

## 4. Production Migrations (`prod`)

Always test migrations locally first before running them against production!

### Step 1: Preview Migration SQL (Dry-Run / Safe Check)
Before executing anything on production, generate the exact SQL that will be executed:

```powershell
# From local terminal:
alembic -x env=prod upgrade head --sql

# Or via Docker:
docker compose exec api alembic -x env=prod upgrade head --sql
```

### Step 2: Stamping Existing Production DB (One-Time Setup)
If your production database **already has existing tables** and you are introducing Alembic:
```powershell
# Mark the database as current without running CREATE TABLE statements:
alembic -x env=prod stamp head
```

### Step 3: Apply Migrations to Production
When you have new pending migrations to apply:
```powershell
# From local terminal:
alembic -x env=prod upgrade head

# Or via Docker:
docker compose exec api alembic -x env=prod upgrade head
```

---

## 5. Workflow: How to Create New Migrations

Whenever you add, modify, or delete a model in `app/db/models/`:

### Phase 1: Update or Add SQLAlchemy Model
Make your changes in Python, for example adding a new table in `app/db/models/test_model.py` or editing existing models in `app/db/models/youtube.py`.

### Phase 2: Auto-Generating the Migration Script
Whenever you change or add models, you run the autogenerate command:

```powershell
alembic -x env=dev revision --autogenerate -m "create_test_table"
```
*(Or inside Docker: `docker compose exec api alembic -x env=dev revision --autogenerate -m "create_test_table"`)*

This compares your models against the local database and generates a new migration file inside `alembic/versions/` (e.g., `alembic/versions/<hash>_create_test_table.py`).

### Phase 3: Inspect the Generated Migration File
Open the newly created script in `alembic/versions/`:
- Review the `upgrade()` function (e.g. `op.create_table('test', ...)`).
- Review the `downgrade()` function (e.g. `op.drop_table('test')`).
- Fine-tune any constraints or index names if needed.

### Phase 4: Test and Apply to Local Development (`dev`)
Preview the SQL first (optional dry-run):
```powershell
alembic -x env=dev upgrade head --sql
```
Apply the migration to your local Dev database:
```powershell
alembic -x env=dev upgrade head
```
Verify the table or columns in local PostgreSQL:
```powershell
docker exec youtube_research_postgres psql -U postgres -d youtube_research -c "\d test"
```

### Phase 5: Deploy and Apply to Production (`prod`)
Preview the SQL for production:
```powershell
alembic -x env=prod upgrade head --sql
```
Apply the migration to Supabase/Production:
```powershell
alembic -x env=prod upgrade head
```
Verify Production current revision:
```powershell
alembic -x env=prod current
```

---

## 6. Useful Maintenance & Rollback Commands

### Check Current Migration Status
```powershell
# See currently applied revision
alembic -x env=dev current
alembic -x env=prod current

# View history of all revisions
alembic history --verbose

# View available head revisions
alembic heads
```

### Rollback / Downgrade
```powershell
# Revert the last applied migration:
alembic -x env=dev downgrade -1
alembic -x env=prod downgrade -1

# Revert to a specific revision ID:
alembic -x env=dev downgrade <revision_id>

# Revert all migrations (use with extreme caution):
alembic -x env=dev downgrade base
```

---

## 7. Troubleshooting & Best Practices

1. **Supabase Pooler Prepared Statement Error (`prepared statement already exists`)**:
   - Supabase connection poolers on port `6543` run in transaction pooling mode.
   - `alembic/env.py` automatically detects this and configures `statement_cache_size = 0`.
   - If you still encounter issues, use the direct connection string (port `5432`) in `PROD_DATABASE_URL` for running migrations.

2. **pgvector Extension (`type "vector" does not exist`)**:
   - The initial baseline migration includes `op.execute("CREATE EXTENSION IF NOT EXISTS vector")` at the beginning of `upgrade()`.
   - On hosted PostgreSQL (Supabase / AWS RDS), ensure your database user has permission to create extensions (standard on Supabase).

3. **Database Out of Sync / Multiple Heads**:
   - If two developers create migrations concurrently, Alembic will report multiple heads (`alembic heads`).
   - Merge them with:
     ```powershell
     alembic merge -m "merge_concurrent_heads" <rev1> <rev2>
     ```
