# Product Context

## Why This Project Exists
This is a personal web application serving as both a useful household tool and a learning/portfolio project. It provides a single platform where family members can access shared financial tools, with access controlled by the owner/admin.

## Problems It Solves
1. **Fragmented personal finance tools** — consolidates budget tracking and family finance management into one place
2. **Uncontrolled access** — invite-only registration ensures only trusted people (family/household) can join
3. **Module sprawl** — a single dashboard gives users a clear view of what tools they have access to, rather than managing multiple separate apps

## How It Should Work

### User Journey
1. Admin creates an invite token (via Django admin panel)
2. Admin shares the invite link (`/register?invite=<token>`) with the new user
3. New user visits the link, validates the token, and fills in their details
4. After registration, the user is automatically logged in and lands on the dashboard
5. The dashboard shows only the modules the admin has granted them access to
6. User clicks a module card to enter that module

### Authentication Flow
- Login returns JWT access token (60 min) + refresh token (7 days)
- Tokens stored in `localStorage`
- Axios interceptor automatically attaches access token to all API requests
- On 401 response, interceptor silently refreshes the access token and retries
- Logout blacklists the refresh token server-side

### Module Access Flow
- Each user has `UserModuleAccess` records linking them to specific module slugs
- On login, the frontend fetches `/api/auth/me/modules/` and stores the list in `AuthContext`
- `ModuleRoute` component checks `hasModuleAccess(slug)` before rendering a module page
- Users without access are redirected to `/unauthorized`

## User Experience Goals
- Clean, minimal UI (Tailwind CSS utility classes, white cards, gray backgrounds)
- Fast feedback — loading states on all async actions, inline error messages
- Graceful degradation — if a user has no modules, they see a friendly "no modules yet" message
- Redirect preservation — if a user visits a protected route while logged out, they are sent back there after login
