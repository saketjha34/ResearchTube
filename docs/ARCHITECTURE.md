# ResearchTube: Complete System Architecture & Technical Specifications

> **ResearchTube** is an enterprise-grade, multi-agent AI research pipeline that converts raw YouTube video streams into structured, publication-ready technical intelligence reports. It leverages a **7-node LangGraph Directed Acyclic Graph (DAG)** state machine, **PostgreSQL pgvector RAG** semantic retrieval, a **3-layer proxy-resilient transcript scraper**, and a modern **React 19 + FastAPI** architecture.


## 1. HIGH LEVEL SYSTEM DESIGN

![](static/images/hld.png)


## 2. Auth Service

```mermaid
%%{init: {
  "theme": "base",
  "themeVariables": {
    "fontSize": "20px",
    "fontFamily": "Arial, sans-serif",
    "background": "#FFF9C4",
    "primaryColor": "#FFF176",
    "primaryTextColor": "#111111",
    "primaryBorderColor": "#B7791F",
    "lineColor": "#333333",
    "textColor": "#111111",
    "secondaryColor": "#FFFDE7",
    "tertiaryColor": "#FFF59D"
  }
}}%%

flowchart TD
    Start(["User Visits ResearchTube"]) --> AuthChoice{"Choose Auth Path"}

    %% Local Registration
    AuthChoice -->|"Sign Up"| RegInput["Submit Email, Username, and Password"]
    RegInput --> RegCheck{"Email & Username Unique?"}
    RegCheck -->|"No"| RegErr["Return Conflict Error"]
    RegCheck -->|"Yes"| RegCreate["Create User Profile & Store Hashed Password"]
    RegCreate --> IssuePair["Issue JWT Access Token + Opaque Refresh Token"]

    %% Local Login
    AuthChoice -->|"Sign In"| LoginInput["Submit Email/Username + Password"]
    LoginInput --> LoginCheck{"Account Active & Password Valid?"}
    LoginCheck -->|"No"| LoginErr["Return 401 Unauthorized"]
    LoginCheck -->|"Yes"| IssuePair

    %% Google OAuth
    AuthChoice -->|"Continue with Google"| GoogleRedirect["Redirect to Google Consent Screen"]
    GoogleRedirect --> GoogleCallback["Receive Auth Code & Exchange for Google Profile"]
    GoogleCallback --> OAuthLookup{"Google Account Linked?"}
    OAuthLookup -->|"Yes"| FetchUser["Load Linked User"]
    OAuthLookup -->|"No"| EmailLookup{"User Exists with Same Email?"}
    EmailLookup -->|"Yes"| LinkAccount["Link Google Account & Mark Verified"]
    EmailLookup -->|"No"| CreateGoogleUser["Create Verified User & Link Google Account"]
    FetchUser --> IssuePair
    LinkAccount --> IssuePair
    CreateGoogleUser --> RedirectFE["Redirect to Frontend Callback with Tokens in URL Fragment"]
    RedirectFE --> Authenticated

    %% Forgot / Reset Password
    AuthChoice -->|"Forgot Password"| ResetReq["Submit Email or Username"]
    ResetReq --> GenReset["Invalidate Old Tokens, Store Hashed Reset Token, Send Email"]
    GenReset --> ResetLink["User Opens Reset Link & Submits New Password"]
    ResetLink --> VerifyReset{"Token Valid, Unused, Not Expired & User Matches?"}
    VerifyReset -->|"No"| ResetErr["Reject Reset Request"]
    VerifyReset -->|"Yes"| UpdatePass["Update Password Hash & Revoke All Refresh Sessions"]
    UpdatePass --> LoginInput

    %% Authenticated Session
    IssuePair --> Authenticated["User Authenticated"]
    Authenticated --> ApiCall["Call Protected API with Bearer JWT"]
    ApiCall --> JwtCheck{"JWT Valid & User Active?"}
    JwtCheck -->|"Yes"| AllowAccess["Serve Protected Resource"]
    JwtCheck -->|"Expired"| RefreshCall["Send Refresh Token"]

    RefreshCall --> RefreshCheck{"Refresh Token Valid & Not Expired?"}
    RefreshCheck -->|"No"| ForceLogin["Session Expired - Re-login Required"]
    RefreshCheck -->|"Revoked within 30s Grace Window"| GraceIssue["Issue New Access Token (Multi-Tab Safe)"]
    RefreshCheck -->|"Active"| RotateToken["Revoke Old Refresh Token & Issue New Token Pair"]
    GraceIssue --> AllowAccess
    RotateToken --> AllowAccess

    %% Logout
    Authenticated -->|"Logout"| RevokeSession["Mark Refresh Token Revoked"]
    RevokeSession --> LoggedOut(["Session Ended"])
```



## 6. Frontend Architecture & Component Hierarchy

The frontend is structured modularly with clear separation of UI pages, state context, and layout components:

```text
frontend/src/
├── api/
│   ├── client.ts          # Axios instance with JWT interceptors & token refresh
│   ├── auth.ts            # Auth requests & localStorage session persistence
│   └── research.ts        # Research pipeline API calls & history queries
├── components/
│   ├── Button.tsx         # Primary & Secondary button design system
│   ├── Input.tsx          # Form inputs with helper text & validation
│   ├── Navbar.tsx          # Main header navigation bar
│   ├── Sidebar.tsx         # Collapsible sidebar with active tab glow
│   ├── UserMenu.tsx       # Profile menu & logout trigger
│   └── KnowledgeGraph.tsx # D3 / SVG 2D Knowledge Graph Visualizer
├── context/
│   └── AuthContext.tsx    # Auth state, login/register/logout, full-screen loading screen
├── layouts/
│   └── AppLayout.tsx      # Authenticated dashboard wrapper with route key animation
└── pages/
    ├── Landing.tsx        # Public landing page with live interactive pipeline demo
    ├── Research.tsx       # Research dashboard, search bar, history drawer, ReportView
    ├── Profile.tsx        # Profile management, security, and Research Analytics stats
    ├── Library.tsx        # Feature showcase library
    ├── About.tsx          # Project architecture & mission
    ├── Login.tsx          # Sign-in page with Google OAuth button
    ├── Register.tsx       # Account creation page
    └── SharedReport.tsx   # Public share view for research reports
```