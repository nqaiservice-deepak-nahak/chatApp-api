# Real-Time Group Chat — Backend

NestJS + MongoDB + Socket.IO API.

## Tech Stack

- NestJS 11
- MongoDB / Mongoose
- Socket.IO
- JWT (`@nestjs/jwt`) for authentication
- bcrypt for password hashing
- Swagger (`@nestjs/swagger`)
- class-validator / class-transformer

> **Note on "Passport JWT":** the provided reference project does not use Passport at all — it authenticates requests with a custom `AuthGuard` that verifies a Bearer token using `@nestjs/jwt`'s `JwtService` directly. To follow the reference architecture as closely as possible, this project uses that same pattern instead of `passport-jwt`. Functionally it's equivalent (verify a signed JWT on every protected route), just without the extra Passport strategy layer.

> **Fixed bug — 500 errors on `/groups/my`, `/groups/available`, and group creation:** `AuthGuard` originally only read metadata off `context.getHandler()`, but `@Authorize()` was applied at the **controller class level** on `GroupsController`/`MessagesController`. NestJS's `Reflector` doesn't see class-level decorators through `getHandler()` alone, so those routes were silently treated as public — `request.claims` was never set, and the service layer then crashed trying to read `claims.userId` off `undefined`, surfacing as a generic 500 "Something went wrong." The guard now uses `reflector.getAllAndOverride(SECURED, [context.getHandler(), context.getClass()])`, which checks both the method and the class. This is already fixed in this codebase.

## Installation

```bash
cp .env.example .env   # then edit values as needed
npm install
npm run start:dev
```

The server starts on `http://localhost:8000` with the global prefix `/api`, so all routes below are relative to `http://localhost:8000/api`.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `APP_PORT` | Port the API listens on | `8000` |
| `ENVIRONMENT` | `development` / `production` — Swagger is disabled in production | `development` |
| `UI_URL` | Frontend origin, used for CORS | `http://localhost:5173` |
| `MONGO_CONNECTION_STRING` | Mongo connection URI | `mongodb://127.0.0.1:27017/realtime-group-chat` |
| `MONGO_SYNC_BIT` | `1` to auto-create collections/indexes on boot | `1` |
| `JWT_ACCESS_TOKEN_SECRET` | Secret used to sign/verify JWTs | — |
| `JWT_ACCESS_TOKEN_EXPIRES_IN` | JWT expiry (e.g. `1d`, `12h`) | `1d` |
| `LOG_LEVEL` | winston log level | `debug` |

## Folder Structure

```
src/
├── main.ts
├── config/                     # AppConfigService — reads process.env once, typed accessors
├── core/                       # Cross-cutting concerns
│   ├── bootstrap.ts             # global prefix, CORS, helmet, validation pipe, interceptors, swagger
│   ├── core.module.ts           # @Global module exposing the above to the whole app
│   ├── providers.ts
│   ├── constants/                # SetMetadata keys
│   ├── decorators/               # @Authorize(), @CurrentUser()
│   ├── guards/                   # AuthGuard (JWT verification)
│   ├── loggers/                  # AppLogger (winston wrapper)
│   ├── middleware/                # ResponseHandler / ErrorHandler / RequestHandler
│   ├── swagger/                  # Swagger document setup
│   └── utils/                    # currentDate() helper
├── shared/                     # AppResponse, messages enum + messageFactory, AtPayload, regex
├── database/
│   ├── database.module.ts        # wires DAOs + schema/connection providers together
│   ├── schemas/                  # Users, Groups, GroupMembers, Messages (Mongoose schemas)
│   └── mongodb/
│       ├── connection/            # connection factory, Collections enum, model providers
│       ├── abstract/              # AbstractAuthDao / AbstractGroupsDao / AbstractMessagesDao
│       └── dao/                   # AuthDao / GroupsDao / MessagesDao (concrete Mongoose queries)
└── modules/
    ├── app/                      # root module + health check
    ├── auth/                     # register / login / profile
    │   ├── dto/
    │   ├── auth.abstract.ts
    │   ├── auth.controller.ts
    │   ├── auth.service.ts
    │   └── auth.module.ts
    ├── groups/                   # create / list / details / join
    ├── messages/                 # REST chat history endpoint
    └── socket/                   # ChatGateway (Socket.IO) + SocketModule
```

Every domain module follows: **Controller → Abstract Service → Concrete Service → Abstract DAO → Concrete DAO → Mongoose Model**, matching the reference project's layering.

## REST API Documentation

Interactive Swagger UI is available at `GET /api/docs` (non-production only). Summary below.

All responses share this shape:

```json
{ "code": 200, "message": "Success.", "data": { } }
```

### Auth

| Method | Path | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/api/auth/register` | No | `{ name, email, password }` | Create a new user. Fails with `409` if the email is already registered. |
| POST | `/api/auth/login` | No | `{ email, password }` | Returns `{ accessToken, user }`. |
| GET | `/api/auth/me` | Yes | — | Returns the current user's profile. |

### Groups

| Method | Path | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/api/groups` | Yes | `{ name, description? }` | Create a group. The creator automatically becomes a member. |
| GET | `/api/groups/my` | Yes | — | Groups the current user has already joined. |
| GET | `/api/groups/available` | Yes | — | Groups that exist but the current user hasn't joined. |
| GET | `/api/groups/:groupId` | Yes | — | Group details: name, description, createdBy, createdOn, totalMembers, and whether the current user is already a member. |
| POST | `/api/groups/:groupId/join` | Yes | — | Join a group. Records `joinedAt` for this user. Returns `409` if already a member. |

### Messages

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/groups/:groupId/messages` | Yes | Chat history — **only** messages created on/after the requesting user's `joinedAt` for this group. Returns `403` if the user isn't a member. |

All protected routes expect `Authorization: Bearer <accessToken>`.

### Error Handling

| Scenario | HTTP status |
|---|---|
| Invalid login credentials | 401 |
| Duplicate email registration | 409 |
| Joining a group twice | 409 |
| Sending/reading messages without being a member | 403 |
| Invalid/malformed group id | 400 |
| Missing/expired/invalid JWT | 401 |
| Validation errors (missing/invalid fields) | 400, with a descriptive `message` |
| Unexpected server error | 500 |

## Socket.IO Event Documentation

Connect to the Socket.IO server at the same host as the REST API (default `http://localhost:8000`), path `/socket.io`, and pass the JWT via the `auth` payload:

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:8000', {
  transports: ['websocket'],
  auth: { token: accessToken }
});
```

If the token is missing or invalid, the server emits an `error` event and disconnects the socket immediately.

### Client → Server events

| Event | Payload | Description |
|---|---|---|
| `joinGroup` | `{ groupId }` | Verifies (server-side) that the connected user is a member of the group, then joins the corresponding Socket.IO room. Emits `joinedGroup` on success, or `error` if not a member. |
| `leaveGroup` | `{ groupId }` | Leaves the room (also happens automatically on disconnect). |
| `sendMessage` | `{ groupId, message }` | Re-verifies membership, persists the message to MongoDB, then broadcasts it to everyone currently in the room. |

### Server → Client events

| Event | Payload | Description |
|---|---|---|
| `joinedGroup` | `{ groupId }` | Confirms the room join succeeded. |
| `newMessage` | `{ _id, groupId, senderId, senderName, message, createdOn }` | Broadcast to every socket in the room whenever any member sends a message. |
| `error` | `{ message }` | Sent for auth failures, unauthorized room joins, or failed sends. |

## Database Design

| Collection | Purpose | Key fields |
|---|---|---|
| `Users` | Registered users | `name`, `email` (unique), `hashedPassword`, `createdOn` |
| `Groups` | Chat groups | `name`, `description`, `createdBy`, `createdByName`, `createdOn` |
| `GroupMembers` | Membership + join time | `groupId`, `userId`, `userName`, `joinedAt` — **`joinedAt` is what powers the message-visibility rule** |
| `Messages` | Chat messages | `groupId`, `senderId`, `senderName`, `message`, `createdOn` |

## What was added today

- Added support for creating groups with multiple members in a single request via `memberIds` on `POST /api/groups`.
- Ensured group creation still adds the creator as a member automatically.
- Implemented `GET /api/groups/:groupId/available-members` to return users who are not yet in the group.
- Updated `GET /api/auth/available-users` to exclude users the current user already has a private chat with.
- Added direct-chat metadata handling so private-chat partner exclusion works correctly even for historical private messages.
- Fixed aggregation logic in direct-chat partner lookup to use proper MongoDB field path notation.
- Verified the backend compiles cleanly after these updates.
