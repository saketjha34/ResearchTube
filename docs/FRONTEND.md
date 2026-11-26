# ResearchTube: Frontend Architecture & Documentation

> The **ResearchTube** frontend is a modern **React 19 + TypeScript + Vite** Single-Page Application (SPA) styled with **Tailwind CSS v4**, featuring JWT auto-refresh authentication, real-time SSE AI chat streaming, LaTeX/Markdown/code rendering, and interactive research report views.

---

## 1. Directory Structure

```text
frontend/
├── public/                     # Static public assets
├── src/
│   ├── api/                    # HTTP & streaming clients
│   │   ├── config.ts           # Env-aware API base URL (dev/prod) & buildApiUrl()
│   │   ├── client.ts           # Axios instance + JWT interceptor + 401 refresh queue
│   │   ├── auth.ts             # Login, register, refresh, logout, password reset APIs
│   │   ├── research.ts         # YouTube research pipeline & history APIs
│   │   └── chat.ts             # Chat sessions, SSE stream reader, sharing & forking APIs
│   ├── assets/                 # Images & SVGs
│   ├── components/             # Reusable UI components
│   │   ├── chat/               # ChatInput, ChatMessageItem, ToolSelector, VideoScopeSelector, ShareModal
│   │   ├── KnowledgeGraph.tsx  # Interactive knowledge graph visualization
│   │   ├── Navbar.tsx / Sidebar.tsx / Footer.tsx
│   │   ├── ProtectedRoute.tsx  # Auth guard for private routes
│   │   └── Onboarding.tsx / Toast.tsx / UserMenu.tsx / Button.tsx / Input.tsx
│   ├── context/
│   │   └── AuthContext.tsx     # Global auth state, JWT expiry parsing & session lifecycle
│   ├── layouts/
│   │   └── AppLayout.tsx       # Authenticated shell (Sidebar + Navbar + Outlet)
│   ├── pages/                  # Route-level views
│   │   ├── Landing.tsx         # Public landing page (/)
│   │   ├── Library.tsx         # Public/curated research library (/library)
│   │   ├── About.tsx           # About page (/about)
│   │   ├── Login.tsx / Register.tsx / ForgotPassword.tsx / ResetPassword.tsx
│   │   ├── AuthCallback.tsx    # Google OAuth2 fragment (#) token parser
│   │   ├── Research.tsx        # Multi-agent YouTube research runner & report viewer
│   │   ├── Chat.tsx            # Scoped RAG + E2B Sandbox + Web Search SSE chat
│   │   ├── Profile.tsx / Settings.tsx
│   │   └── SharedReport.tsx / SharedChat.tsx / ShareResolver.tsx
│   ├── routes/
│   │   └── AppRoutes.tsx       # Public, share, and ProtectedRoute definitions
│   ├── App.tsx
│   └── main.tsx
├── package.json
└── vite.config.ts
```

---

## 2. Tech Stack & Why Each Library Is Used

### Core Framework & Build Tooling
| Library | Version | Why It Is Used |
| :--- | :--- | :--- |
| **`react` & `react-dom`** | `^19.2.8` | Component-based UI with concurrent rendering and hooks for managing streaming chat state and research views. |
| **`typescript`** | `~6.0.2` | End-to-end type safety across API request/response schemas, router params, and component props. |
| **`vite` & `@vitejs/plugin-react`** | `^8.2.0` | Ultra-fast HMR dev server and optimized production bundling for deployment on Vercel. |
| **`oxlint`** | `^1.75.0` | High-speed Rust-based linter for catching TypeScript/React issues in CI and local development. |

### Styling & Icons
| Library | Version | Why It Is Used |
| :--- | :--- | :--- |
| **`tailwindcss`** (`@tailwindcss/postcss`, `autoprefixer`) | `^4.3.3` | Utility-first CSS framework for rapid, responsive, consistent UI styling without custom CSS bloat. |
| **`lucide-react`** | `^1.31.0` | Crisp, tree-shakeable SVG icon set used across navigation, chat tool selectors, research cards, and auth forms. |

### Routing & Networking
| Library | Version | Why It Is Used |
| :--- | :--- | :--- |
| **`react-router-dom`** | `^7.18.2` | Client-side routing supporting public pages, `/share/:id` resolvers, and nested `<ProtectedRoute><AppLayout /></ProtectedRoute>` guards. |
| **`axios`** | `^1.19.0` | HTTP client with request/response interceptors that attach `Bearer` JWTs and queue concurrent `401` requests behind a single token-refresh call. |

### AI Chat, Markdown, Math & Code Rendering
| Library | Version | Why It Is Used |
| :--- | :--- | :--- |
| **`react-markdown`** | `^10.1.0` | Safely renders streamed LLM responses and research reports as structured React elements. |
| **`remark-gfm`** | `^4.0.1` | Adds GitHub-Flavored Markdown support (tables, task lists, strikethrough, autolinks) for structured research summaries. |
| **`remark-math` + `rehype-katex` + `katex`** | `^6.0.0` / `^7.0.1` / `^0.18.7` | Parses and renders LaTeX mathematical formulas (`$...$`, `$$...$$`) in AI explanations and technical video breakdowns. |
| **`react-syntax-highlighter`** | `^16.1.1` | Syntax-highlighted code blocks for Python, C++, SQL, and shell snippets returned by the AI or E2B Sandbox. |

### Telemetry
| Library | Version | Why It Is Used |
| :--- | :--- | :--- |
| **`@vercel/analytics`** | `^2.0.1` | Lightweight page-view and usage analytics when deployed on Vercel. |

---

## 3. Key Frontend Workflows

### A. Authentication & Concurrency-Safe Token Refresh (`api/client.ts` + `AuthContext.tsx`)
1. **Outbound Requests:** Every Axios call automatically attaches `Authorization: Bearer <access_token>`.
2. **401 Refresh Queue:** If an access token expires mid-session, `client.ts` pauses concurrent failing requests in `failedQueue`, runs a **single** `/auth/refresh` request, persists the rotated token pair, and replays all queued requests seamlessly.
3. **Google OAuth2 Callback (`/auth/callback`):** `AuthCallback.tsx` reads `access_token`, `refresh_token`, and `user` from the URL hash fragment (`#`) so tokens never hit server logs.

### B. Real-Time AI Chat & Streaming (`pages/Chat.tsx` + `components/chat/`)
- **SSE Stream Reader:** Consumes `event: user`, `event: status` (`searching`, `scraping`, `executing_code`, `code_executed`, `generating`), `event: delta` (live tokens), `event: done` (citations + artifact counts), and `event: error`.
- **Scoping & Tools:** Users can switch scope between **No Scope**, **Single Video**, **Research Run**, or **All Library Videos**, and toggle **Web Search** or autonomous **E2B Python/C++ Sandbox** execution (rendering inline base64 charts and downloadable PDF/CSV files).

### C. Routing Overview (`routes/AppRoutes.tsx`)
- **Public Routes:** `/`, `/library`, `/about`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/auth/callback`
- **Public Share Routes:** `/share/:id` (`ShareResolver`), `/share/report/:runId`, `/share/chat/:shareToken`
- **Protected Routes (`ProtectedRoute` + `AppLayout`):** `/research` (`/dashboard` redirects here), `/chat/:sessionId?`, `/profile`, `/settings`

---

## 4. Website Screenshots

> Place captured screenshots in `docs/static/images/frontend/` to render them here:
>
> - `docs/static/images/frontend/landing.png` — Landing Page (`/`)
> - `docs/static/images/frontend/library.png` — Research Library (`/library`)
> - `docs/static/images/frontend/research.png` — Multi-Agent Research Runner (`/research`)
> - `docs/static/images/frontend/chat.png` — RAG & Sandbox AI Chat (`/chat`)
> - `docs/static/images/frontend/login.png` — Sign In & Google OAuth (`/login`)
