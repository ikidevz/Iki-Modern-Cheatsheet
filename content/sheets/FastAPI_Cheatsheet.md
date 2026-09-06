# FastAPI Cheat Sheet

A structured, practical reference for building APIs with FastAPI — from basic routing through auth, databases, testing, and deployment. Every snippet below has been executed against FastAPI 0.141, Pydantic 2.13, and SQLAlchemy 2.0.

---

## Table of Contents

1. 🧩 [Core Concepts](#core-concepts)
2. ⚡ [Quick Reference Table](#quick-reference-table)
3. 📦 [Installation & Project Setup](#installation--project-setup)
4. 🚀 [Basic App & Running the Server](#basic-app--running-the-server)
5. 🌐 [HTTP Methods (Path Operations)](#http-methods-path-operations)
6. 🔗 [Path Parameters](#path-parameters)
7. 🔍 [Query Parameters](#query-parameters)
8. 📝 [Request Body & Pydantic Models](#request-body--pydantic-models)
9. 📤 [Response Models & Status Codes](#response-models--status-codes)
10. ⚠️ [Error Handling](#error-handling)
11. 💉 [Dependency Injection](#dependency-injection)
12. 🔐 [Authentication & Security (OAuth2 + JWT)](#authentication--security-oauth2--jwt)
13. 📁 [File Uploads](#file-uploads)
14. 🧱 [Middleware](#middleware)
15. 🕒 [Background Tasks](#background-tasks)
16. 🗄️ [Database Integration (SQLAlchemy 2.0)](#database-integration-sqlalchemy-20)
17. 📄 [Pagination](#pagination)
18. 🔌 [WebSockets](#websockets)
19. 📡 [Streaming Responses & Server-Sent Events](#streaming-responses--server-sent-events)
20. 🗂️ [API Routers & Versioning](#api-routers--versioning)
21. 🧪 [Testing](#testing)
22. ⚙️ [Configuration & Environment Variables](#configuration--environment-variables)
23. 🖼️ [Static Files & Templates](#static-files--templates)
24. ♻️ [Lifespan Events (Startup/Shutdown)](#lifespan-events-startupshutdown)
25. 🚢 [Running & Deployment](#running--deployment)
26. 🔢 [Common Status Codes](#common-status-codes)
27. 📥 [Useful Imports](#useful-imports)
28. 🐛 [Gotchas](#gotchas)

---

## Core Concepts

| Concept                  | What it is                                                                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Path operation**       | A function bound to an HTTP method + path (`@app.get("/items")`), the core routing unit.                                                            |
| **Pydantic model**       | A typed data class used for request/response validation and (de)serialization.                                                                      |
| **Dependency**           | A reusable callable FastAPI resolves and injects into a path operation via `Depends()`.                                                             |
| **ASGI**                 | The async server interface FastAPI is built on (via Starlette); requires an ASGI server like Uvicorn.                                               |
| **`response_model`**     | Declares the shape of the response, independent of what the function returns — enables filtering, docs generation, and validation of outgoing data. |
| **OpenAPI / Swagger UI** | Auto-generated interactive docs at `/docs` (Swagger) and `/redoc` (ReDoc), built from your type hints.                                              |
| **`Annotated`**          | The modern way to attach metadata (`Query`, `Path`, `Depends`, etc.) to a parameter's type hint — the recommended style since FastAPI 0.95.         |
| **Lifespan**             | The `asynccontextmanager`-based hook for startup/shutdown logic (replaces the older `@app.on_event`).                                               |

---

## Quick Reference Table

| Task                         | Snippet                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| Define a GET route           | `@app.get("/items/{id}")`                                                             |
| Path parameter               | `async def f(item_id: int): ...`                                                      |
| Query parameter with default | `async def f(skip: int = 0): ...`                                                     |
| Validated query param        | `q: Annotated[str \| None, Query(min_length=3)] = None`                               |
| Request body                 | `async def f(item: Item): ...` (where `Item(BaseModel)`)                              |
| Response shape               | `@app.post("/items", response_model=ItemOut)`                                         |
| Custom status code           | `@app.post("/items", status_code=201)`                                                |
| Raise an API error           | `raise HTTPException(status_code=404, detail="msg")`                                  |
| Inject a dependency          | `db: Annotated[Session, Depends(get_db)]`                                             |
| Protect a route              | `user: Annotated[User, Depends(get_current_user)]`                                    |
| Run in the background        | `background_tasks.add_task(fn, arg)`                                                  |
| Group routes                 | `router = APIRouter(prefix="/v1")` then `app.include_router(router)`                  |
| Startup/shutdown logic       | `@asynccontextmanager async def lifespan(app): ...` then `FastAPI(lifespan=lifespan)` |
| Run dev server               | `uvicorn main:app --reload`                                                           |
| Run prod server              | `uvicorn main:app --host 0.0.0.0 --port 8000`                                         |
| Test a route                 | `TestClient(app).get("/items/1")`                                                     |

---

## Installation & Project Setup

```bash
pip install fastapi
pip install "uvicorn[standard]"   # ASGI server, with performance extras

# Common companions, install as needed:
pip install pydantic-settings           # typed settings from env vars/.env
pip install "sqlalchemy>=2.0" aiosqlite  # ORM (+ async SQLite driver)
pip install pwdlib[argon2] pyjwt         # password hashing + JWT
pip install python-multipart            # required for form data / file uploads
pip install httpx pytest                # testing
```

A minimal project layout:

```
myapp/
├── main.py           # FastAPI() instance + route includes
├── routers/          # APIRouter modules, one per resource
├── models.py         # Pydantic schemas
├── db.py             # engine, session factory, ORM models
├── dependencies.py   # shared Depends() callables
├── config.py         # Settings (pydantic-settings)
├── tests/
└── .env
```

---

## Basic App & Running the Server

```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Hello World"}

# Run with: uvicorn main:app --reload
```

---

## HTTP Methods (Path Operations)

```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/items/{item_id}")
async def read_item(item_id: int):
    return {"item_id": item_id}

@app.post("/items/")
async def create_item(item: dict):
    return item

@app.put("/items/{item_id}")
async def update_item(item_id: int, item: dict):
    return {"item_id": item_id, **item}

@app.delete("/items/{item_id}")
async def delete_item(item_id: int):
    return {"deleted": item_id}

@app.patch("/items/{item_id}")
async def patch_item(item_id: int, item: dict):
    return {"item_id": item_id, **item}
```

`GET`/`DELETE` don't take a body in typical use; `POST` creates, `PUT` replaces a whole resource, `PATCH` partially updates one.

---

## Path Parameters

```python
from enum import Enum
from typing import Annotated
from fastapi import FastAPI, Path

app = FastAPI()

@app.get("/users/{user_id}")
async def read_user(user_id: int):
    return {"user_id": user_id}

# Multiple path parameters, mixed types
@app.get("/users/{user_id}/items/{item_id}")
async def read_user_item(user_id: int, item_id: str):
    return {"user_id": user_id, "item_id": item_id}

# Enum path parameters — restricts input to fixed choices, shown as a dropdown in /docs
class ModelName(str, Enum):
    alexnet = "alexnet"
    resnet = "resnet"
    lenet = "lenet"

@app.get("/models/{model_name}")
async def get_model(model_name: ModelName):
    return {"model_name": model_name}

# Validated path parameter (modern Annotated + Path() style)
@app.get("/items2/{item_id}")
async def read_item2(item_id: Annotated[int, Path(title="The ID of the item", ge=1)]):
    return {"item_id": item_id}
```

`Path()` (like `Query()` below) accepts `ge`/`le`/`gt`/`lt` for numeric bounds, `min_length`/`max_length` for strings, and `title`/`description` for OpenAPI docs.

---

## Query Parameters

```python
from typing import Annotated, Optional
from fastapi import FastAPI, Query

app = FastAPI()

# Defaults make a parameter optional; no default makes it required
@app.get("/items/")
async def read_items(skip: int = 0, limit: int = 10):
    return {"skip": skip, "limit": limit}

# Optional query parameter (Optional[str] / str | None both work)
@app.get("/items/{item_id}")
async def read_item(item_id: str, q: Optional[str] = None):
    if q:
        return {"item_id": item_id, "q": q}
    return {"item_id": item_id}

# Multiple query parameters together
@app.get("/search/")
async def read_search(skip: int = 0, limit: int = 10, q: Optional[str] = None):
    items = {"skip": skip, "limit": limit}
    if q:
        items.update({"q": q})
    return items

# Modern Annotated + Query() validation style (preferred since FastAPI 0.95+)
@app.get("/items2/{item_id}")
async def read_item2(
    item_id: int,
    q: Annotated[Optional[str], Query(min_length=3, max_length=50)] = None,
):
    return {"item_id": item_id, "q": q}
```

---

## Request Body & Pydantic Models

Pydantic v2 is the current major version — `field_validator` replaces the old `validator`, and `model_config = ConfigDict(...)` replaces the old inner `class Config`.

```python
from typing import Optional
from fastapi import FastAPI
from pydantic import BaseModel, Field, field_validator

app = FastAPI()

class Item(BaseModel):
    name: str
    price: float = Field(gt=0, description="Price must be positive")
    is_offer: Optional[bool] = None
    description: Optional[str] = Field(default=None, max_length=300)

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name must not be blank")
        return v

@app.post("/items/")
async def create_item(item: Item):
    return item

# Nested models
class User(BaseModel):
    name: str
    email: str

class ItemWithUser(BaseModel):
    name: str
    price: float
    owner: User

@app.post("/items-with-user/")
async def create_item_with_user(item: ItemWithUser):
    return item
```

`Field()` constraints (`gt`, `ge`, `lt`, `le`, `min_length`, `max_length`, `pattern`) are validated automatically and show up in the OpenAPI schema — prefer them over hand-written `if` checks for simple constraints, and reach for `@field_validator` for anything more custom.

---

## Response Models & Status Codes

```python
from fastapi import FastAPI, status
from pydantic import BaseModel, ConfigDict

app = FastAPI()

class ItemResponse(BaseModel):
    # replaces Pydantic v1's `class Config: orm_mode = True`
    model_config = ConfigDict(from_attributes=True)
    name: str
    price: float
    item_id: int

@app.post("/items/", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(name: str, price: float):
    # response_model filters/validates what's returned, even if you return more fields
    return ItemResponse(name=name, price=price, item_id=1)
```

`response_model` matters even when your return type already matches: it strips extra fields you might accidentally leak (e.g. a hashed password on a DB model), coerces types, and drives the `/docs` schema.

---

## Error Handling

```python
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

app = FastAPI()

@app.get("/items/{item_id}")
async def read_item(item_id: str):
    if item_id == "foo":
        raise HTTPException(status_code=404, detail="Item not found")
    return {"item_id": item_id}

# Custom exception + handler
class UnicornException(Exception):
    def __init__(self, name: str):
        self.name = name

@app.exception_handler(UnicornException)
async def unicorn_exception_handler(request: Request, exc: UnicornException):
    return JSONResponse(
        status_code=418,
        content={"message": f"Oops! {exc.name} did something wrong."},
    )

@app.get("/unicorn/{name}")
async def trigger_unicorn(name: str):
    raise UnicornException(name=name)

# Override the default 422 validation error response shape
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": "Validation failed", "errors": exc.errors()},
    )
```

---

## Dependency Injection

```python
from typing import Annotated, Optional
from fastapi import FastAPI, Depends

app = FastAPI()

# Function-based dependency
def common_parameters(q: Optional[str] = None, skip: int = 0, limit: int = 100):
    return {"q": q, "skip": skip, "limit": limit}

@app.get("/items/")
async def read_items(commons: Annotated[dict, Depends(common_parameters)]):
    return commons

# Class-based dependency — useful when you need shared state/methods
class CommonQueryParams:
    def __init__(self, q: Optional[str] = None, skip: int = 0, limit: int = 100):
        self.q = q
        self.skip = skip
        self.limit = limit

@app.get("/items2/")
async def read_items2(commons: Annotated[CommonQueryParams, Depends(CommonQueryParams)]):
    return {"q": commons.q, "skip": commons.skip, "limit": commons.limit}
```

Dependencies can themselves depend on other dependencies (sub-dependencies), and a `yield`-based dependency (like `get_db` in the [Database](#database-integration-sqlalchemy-20) section) runs its teardown code after the response is sent — the standard pattern for anything that needs cleanup (DB sessions, file handles, connections).

---

## Authentication & Security (OAuth2 + JWT)

FastAPI's official tutorial now uses **`pwdlib`** for password hashing and **`PyJWT`** for tokens — `passlib` is unmaintained and breaks with `bcrypt>=4.1`, and `python-jose` has seen the same reduced-maintenance concerns. Use `pwdlib[argon2]` and `pyjwt` for new code.

```bash
pip install "pwdlib[argon2]" pyjwt python-multipart
```

```python
from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

import jwt
from jwt.exceptions import InvalidTokenError
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pwdlib import PasswordHash
from pydantic import BaseModel

app = FastAPI()

# Generate a real one with: openssl rand -hex 32 — never hardcode in production
SECRET_KEY = "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

password_hash = PasswordHash.recommended()  # Argon2id under the hood
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

fake_users_db = {
    "alice": {
        "username": "alice",
        "hashed_password": password_hash.hash("secret123"),
        "disabled": False,
    }
}

class Token(BaseModel):
    access_token: str
    token_type: str

def verify_password(plain_password, hashed_password):
    return password_hash.verify(plain_password, hashed_password)

def get_user(db, username: str):
    return db.get(username)

def authenticate_user(db, username: str, password: str):
    user = get_user(db, username)
    if not user or not verify_password(password, user["hashed_password"]):
        return False
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise credentials_exception
    except InvalidTokenError:
        raise credentials_exception
    user = get_user(fake_users_db, username)
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: Annotated[dict, Depends(get_current_user)]):
    if current_user.get("disabled"):
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

@app.post("/token", response_model=Token)
async def login_for_access_token(form_data: Annotated[OAuth2PasswordRequestForm, Depends()]):
    user = authenticate_user(fake_users_db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(
        data={"sub": user["username"]},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return Token(access_token=access_token, token_type="bearer")

@app.get("/users/me")
async def read_users_me(current_user: Annotated[dict, Depends(get_current_active_user)]):
    return {"username": current_user["username"]}
```

Call it as: `POST /token` with form fields `username`/`password` → get a bearer token → send `Authorization: Bearer <token>` on subsequent requests.

**Simple bearer-token check** (no OAuth2 form flow, e.g. for a service-to-service API key style check):

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

def get_current_user_simple(credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]):
    if credentials.credentials != "valid-token":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
    return {"username": "current_user"}
```

---

## File Uploads

```python
from fastapi import FastAPI, File, UploadFile

app = FastAPI()

@app.post("/uploadfile/")
async def create_upload_file(file: UploadFile = File(...)):
    contents = await file.read()
    return {"filename": file.filename, "size": len(contents)}

# Multiple files
@app.post("/uploadfiles/")
async def create_upload_files(files: list[UploadFile] = File(...)):
    return {"filenames": [file.filename for file in files]}
```

Requires `python-multipart` installed (FastAPI raises a clear error at startup if it's missing). `UploadFile` streams to a spooled temp file, so it's memory-safe for large files — use `await file.read()` or read in chunks with `await file.read(chunk_size)`.

---

## Middleware

```python
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # restrict this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)  # compress responses over 1KB

# Custom middleware — runs around every request
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response
```

Middleware registered later with `add_middleware` runs _outside_ (wraps) middleware registered earlier — order matters, especially with `CORSMiddleware`, which generally should be added first/outermost.

---

## Background Tasks

```python
from fastapi import BackgroundTasks, FastAPI

app = FastAPI()

def write_notification(email: str, message: str = ""):
    with open("log.txt", mode="w") as email_file:
        content = f"notification for {email}: {message}"
        email_file.write(content)

@app.post("/send-notification/{email}")
async def send_notification(email: str, background_tasks: BackgroundTasks):
    background_tasks.add_task(write_notification, email, message="some notification")
    return {"message": "Notification sent in the background"}
```

`BackgroundTasks` runs _after_ the response is sent, in the same process — good for logging, sending a quick email, or invalidating a cache entry. For anything long-running, retryable, or that must survive a process restart, use a real task queue (Celery, Arq, Dramatiq) instead.

---

## Database Integration (SQLAlchemy 2.0)

SQLAlchemy 2.0's typed `Mapped`/`mapped_column` style replaces the old `Column(...)` + `declarative_base()` pattern. Both sync and async are shown below — pick one per project.

**Sync (simpler, no async driver needed):**

```python
from typing import Annotated, Generator
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker, Session

class Base(DeclarativeBase):
    pass

class ItemDB(Base):
    __tablename__ = "items"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(index=True)
    price: Mapped[int]

engine = create_engine("sqlite:///./app.db", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

app = FastAPI()

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/items/{item_id}")
def read_item(item_id: int, db: Annotated[Session, Depends(get_db)]):
    item = db.scalar(select(ItemDB).where(ItemDB.id == item_id))
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"id": item.id, "name": item.name, "price": item.price}
```

**Async (pairs naturally with `async def` routes; needs an async driver like `aiosqlite` or `asyncpg`):**

```python
from typing import Annotated, AsyncGenerator
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    pass

class ItemDB(Base):
    __tablename__ = "items"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(index=True)
    price: Mapped[int]

engine = create_async_engine("sqlite+aiosqlite:///./app.db")
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session

app = FastAPI()

@app.get("/items/{item_id}")
async def read_item(item_id: int, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(ItemDB).where(ItemDB.id == item_id))
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"id": item.id, "name": item.name, "price": item.price}
```

For schema migrations, pair either style with **Alembic** rather than relying on `create_all` beyond local prototyping.

---

## Pagination

```python
from typing import Annotated
from fastapi import FastAPI, Query
from pydantic import BaseModel

app = FastAPI()

class Page(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    has_next: bool

@app.get("/items/", response_model=Page)
async def list_items(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 10,
):
    all_items = get_all_items_from_somewhere()  # e.g. a DB query with LIMIT/OFFSET
    start = (page - 1) * page_size
    end = start + page_size
    items = all_items[start:end]
    return Page(
        items=items,
        total=len(all_items),
        page=page,
        page_size=page_size,
        has_next=end < len(all_items),
    )
```

Offset-based pagination (`page`/`page_size`, shown above) is simplest but can skip/duplicate rows under concurrent writes; **cursor-based pagination** (an opaque `next_cursor` token derived from the last row's sort key) is more consistent for high-write tables and infinite-scroll UIs.

---

## WebSockets

```python
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

app = FastAPI()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"Message text was: {data}")
    except WebSocketDisconnect:
        pass  # client disconnected — clean up any per-connection state here
```

Always wrap the receive loop in a `try/except WebSocketDisconnect` — without it, a client closing the connection raises inside your handler instead of exiting cleanly.

---

## Streaming Responses & Server-Sent Events

```python
import asyncio
import json
from fastapi import FastAPI
from fastapi.responses import StreamingResponse

app = FastAPI()

# Plain chunked streaming (e.g. large file/report generation)
async def number_stream():
    for i in range(5):
        yield f"{i}\n"
        await asyncio.sleep(0)  # yield control back to the event loop

@app.get("/stream")
async def stream_numbers():
    return StreamingResponse(number_stream(), media_type="text/plain")

# Server-Sent Events (SSE) — one-way push for live updates, progress, notifications
async def event_stream():
    for i in range(3):
        yield f"data: {json.dumps({'count': i})}\n\n"
        await asyncio.sleep(1)

@app.get("/sse")
async def sse():
    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

For real two-way, low-latency communication, use WebSockets instead; SSE is simpler when you only need server → client push over plain HTTP (and it works fine through most proxies/load balancers without special config).

---

## API Routers & Versioning

```python
from fastapi import APIRouter, FastAPI

app = FastAPI()

router_v1 = APIRouter(prefix="/api/v1", tags=["v1"])

@router_v1.get("/ping")
async def ping_v1():
    return {"version": "v1", "status": "ok"}

app.include_router(router_v1)
```

`APIRouter` lets you split routes across files (`routers/users.py`, `routers/items.py`, ...) and mount them with a shared prefix, tags (for grouping in `/docs`), and even shared dependencies:

```python
router = APIRouter(
    prefix="/items",
    tags=["items"],
    dependencies=[Depends(get_current_active_user)],  # applied to every route in this router
)
```

---

## Testing

```python
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_read_main():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Hello World"}

def test_create_item():
    response = client.post("/items/", json={"name": "Test Item", "price": 10.5})
    assert response.status_code == 200
    assert response.json()["name"] == "Test Item"
```

**Overriding dependencies in tests** (e.g. swap a real DB session or the current user for a fake one):

```python
def override_get_current_user():
    return {"username": "test-user", "disabled": False}

app.dependency_overrides[get_current_active_user] = override_get_current_user
# ... run tests ...
app.dependency_overrides = {}  # reset afterwards, e.g. in a pytest fixture teardown
```

**Testing lifespan-dependent apps** (DB setup/teardown, etc.) — use `TestClient` as a context manager so the `lifespan` startup/shutdown actually run:

```python
with TestClient(app) as client:
    response = client.post("/items/", params={"name": "Widget", "price": 100})
    assert response.status_code == 200
```

---

## Configuration & Environment Variables

`BaseSettings` moved out of Pydantic core into the separate **`pydantic-settings`** package as of Pydantic v2 — `from pydantic import BaseSettings` now raises an error.

```bash
pip install pydantic-settings
```

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Awesome API"
    admin_email: str
    items_per_user: int = 50

settings = Settings()

@app.get("/info")
async def info():
    return {
        "app_name": settings.app_name,
        "admin_email": settings.admin_email,
        "items_per_user": settings.items_per_user,
    }
```

Settings are read once at import time — for values that must reload without a restart, wrap access in a function or use `Depends(get_settings)` with `functools.lru_cache`.

---

## Static Files & Templates

```python
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="templates")

@app.get("/items/{id}")
async def read_item(request: Request, id: str):
    return templates.TemplateResponse("item.html", {"request": request, "id": id})
```

Requires `jinja2` installed for `Jinja2Templates`. `app.mount()` serves a whole directory tree under a prefix — good for CSS/JS/images alongside a server-rendered app, less relevant for a pure JSON API.

---

## Lifespan Events (Startup/Shutdown)

The `@app.on_event("startup")` / `@app.on_event("shutdown")` decorators are deprecated — the current pattern is a single `asynccontextmanager` passed to `FastAPI(lifespan=...)`:

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- startup ---
    print("Starting up: create DB connections, load ML models, warm caches, etc.")
    yield
    # --- shutdown ---
    print("Shutting down: close connections, flush buffers, etc.")

app = FastAPI(lifespan=lifespan)
```

Everything before `yield` runs once at startup; everything after runs once at shutdown — the pattern used for the DB engine setup in the [Database](#database-integration-sqlalchemy-20) section above.

---

## Running & Deployment

```bash
# Development — auto-reloads on code changes
uvicorn main:app --reload

# Production — bind to all interfaces, explicit port
uvicorn main:app --host 0.0.0.0 --port 8000

# Production with multiple worker processes (via Gunicorn + Uvicorn workers)
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

# Or run multiple Uvicorn workers directly (no Gunicorn needed)
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

A minimal production Dockerfile:

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## Common Status Codes

```python
from fastapi import status

status.HTTP_200_OK                    # successful GET/PUT/PATCH
status.HTTP_201_CREATED               # successful POST that created a resource
status.HTTP_204_NO_CONTENT            # successful, nothing to return (e.g. DELETE)
status.HTTP_400_BAD_REQUEST           # malformed request
status.HTTP_401_UNAUTHORIZED          # missing/invalid credentials
status.HTTP_403_FORBIDDEN             # authenticated, but not allowed
status.HTTP_404_NOT_FOUND             # resource doesn't exist
status.HTTP_409_CONFLICT              # e.g. duplicate unique field
status.HTTP_422_UNPROCESSABLE_ENTITY  # FastAPI's default for request validation errors
status.HTTP_429_TOO_MANY_REQUESTS     # rate limited
status.HTTP_500_INTERNAL_SERVER_ERROR # unhandled server error
```

---

## Useful Imports

```python
from fastapi import (
    FastAPI, Depends, HTTPException, status, File, UploadFile,
    Request, Response, BackgroundTasks, WebSocket, WebSocketDisconnect,
    APIRouter, Query, Path, Body,
)
from fastapi.security import (
    HTTPBearer, HTTPAuthorizationCredentials,
    OAuth2PasswordBearer, OAuth2PasswordRequestForm,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.testclient import TestClient
from fastapi.responses import JSONResponse, HTMLResponse, FileResponse, StreamingResponse
from fastapi.exceptions import RequestValidationError

from pydantic import BaseModel, Field, field_validator, ConfigDict
from pydantic_settings import BaseSettings, SettingsConfigDict

from typing import Optional, Annotated, List, Dict
from contextlib import asynccontextmanager
```

---

## Gotchas

- **`BaseSettings` no longer lives in `pydantic`** — since Pydantic v2, it's in the separate `pydantic-settings` package (`from pydantic_settings import BaseSettings`). Importing it from `pydantic` directly now raises an error.
- **`orm_mode` is gone** — Pydantic v2 renamed it to `from_attributes`, set via `model_config = ConfigDict(from_attributes=True)`, not an inner `class Config`.
- **`passlib` is effectively broken on modern `bcrypt`** — `bcrypt>=4.1` removed the `__about__` attribute passlib's version check relies on, causing a hard error on hash/verify. FastAPI's own docs now recommend `pwdlib[argon2]`; `python-jose` has similar reduced-maintenance concerns, so prefer `pyjwt` for new code.
- **`EXPOSE`-style thinking doesn't apply here, but CORS wildcards do bite** — `allow_origins=["*"]` combined with `allow_credentials=True` is rejected by browsers; you must list explicit origins if you need credentialed requests.
- **`response_model` doesn't stop your function from computing extra data** — it filters the _output_, so don't rely on it to avoid querying/exposing sensitive fields internally; keep sensitive fields out of the model you return, not just out of the response schema.
- **A `yield`-based dependency's teardown code won't run if the response was never generated** (e.g. the client disconnected mid-request) in some edge cases — don't rely solely on it for must-happen cleanup like committing a transaction; commit explicitly before `yield`-ing back if that matters.
- **`@app.on_event("startup")`/`("shutdown")` are deprecated** — use the `lifespan` context manager shown above; the old decorators still work for now but emit a deprecation warning and will eventually be removed.
- **File uploads silently fail at import/startup without `python-multipart` installed** — FastAPI raises a clear `RuntimeError` telling you to install it, but it's easy to forget since `UploadFile`/`File` import fine without it.
- **`BackgroundTasks` runs in-process, after the response** — if your app restarts or crashes right after responding, a scheduled background task never runs. Don't use it for anything that must survive a restart or needs retries — use a real task queue.
- **Async and sync dependencies can be mixed, but a sync (`def`) dependency runs in a threadpool** — a blocking sync dependency won't block the event loop, but it does consume a worker thread; don't put slow sync I/O in the hot path of a highly concurrent async app without being aware of this.
- **`Optional[str] = None` and `str | None = None` are equivalent** in modern Python/Pydantic — either works; `|` union syntax requires Python 3.10+ (or `from __future__ import annotations` on 3.9).
- **Starlette's `TestClient` recently started warning that `httpx` is deprecated in favor of a separate `httpx2` package** for the test transport — the existing `httpx`-based `TestClient` code still works, but installing `httpx2` alongside removes the deprecation warning if you want to silence it.
- **`list[UploadFile]` (built-in generic) needs Python 3.9+** — on older versions use `List[UploadFile]` from `typing` instead.
- **Pydantic validation errors return HTTP 422, not 400** — that's FastAPI's default for `RequestValidationError`; if your API contract expects 400 for bad input, add the custom exception handler shown in [Error Handling](#error-handling).
