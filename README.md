# 🏥 Hospital Frontend

Ứng dụng quản lý nội bộ cho **Phòng Khám Thiện Nhân** — giao diện dành cho bác sĩ, điều dưỡng và nhân viên tiếp đón.

> **Backend:** [`hospital-core/`](../hospital-core) — FastAPI + PostgreSQL

---

## Stack

- **React 18** + **TypeScript strict**
- **Vite 5** — build tool
- **Zustand** — state management
- **react-hook-form** + **zod** — form validation
- **react-hot-toast** — notifications
- **react-router-dom v6** — routing

---

## Cấu trúc

```
src/
├── api/              # API client tách theo domain (không hard-code URL)
│   ├── client.ts     # Base HTTP client, token inject, error normalize
│   ├── auth.api.ts
│   ├── reception.api.ts
│   ├── doctor.api.ts
│   ├── examination.api.ts
│   └── queue.api.ts
├── app/
│   ├── Router.tsx    # Routing tập trung, lazy loading
│   ├── AppShell.tsx  # Layout: Sidebar + Topbar
│   └── routes.ts     # ROUTES constants — không hard-code path
├── components/ui/    # Design system: Button, Modal, Card, Badge...
├── features/
│   ├── auth/         # Login, AuthContext, RBAC, ProtectedRoute
│   ├── reception/    # Tiếp đón: quét CCCD, đăng ký, check-in
│   ├── queue/        # Kiosk lấy số, Màn hình LED, Quản lý hàng chờ
│   ├── doctor/       # Hàng đợi bác sĩ, chuyển phòng
│   └── examination/  # Phiếu khám: 7 tabs chức năng
├── hooks/            # useAsync, useWebSocket, usePagination
├── store/            # Zustand stores
├── types/            # TypeScript types (mirror Python schemas)
└── lib/utils.ts      # Format helpers
```

---

## Cài đặt & Chạy

```bash
# Cài dependencies
npm install

# Copy env
cp .env.example .env

# Dev server (port 5173)
npm run dev

# Build production
npm run build

# Type check
npm run type-check
```

---

## Cấu hình `.env`

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_BASE_URL=ws://localhost:8000
VITE_APP_NAME=Phòng Khám Thiện Nhân
```

Dev server tự proxy `/api/*` → `http://localhost:8000` nên không bị CORS.

---

## Tài khoản test

| Username | Password | Role | Quyền |
|----------|----------|------|-------|
| `admin` | `Admin@123` | admin | Tất cả |
| `doctor` | `Doctor@123` | doctor | Phòng khám + Phiếu khám |
| `nurse` | `Nurse@123` | nurse | Tiếp đón + Hàng chờ |

---

## Các trang

| URL | Mô tả | Cần đăng nhập |
|-----|-------|:---:|
| `/` | Trang chủ — chọn chức năng | ✅ |
| `/reception` | Quầy tiếp đón (quét CCCD, đăng ký, check-in) | ✅ |
| `/queue` | Quản lý hàng chờ (gọi số, done, skip) | ✅ |
| `/doctor` | Hàng đợi bác sĩ | ✅ |
| `/examination/:id` | Phiếu khám bệnh (7 tabs) | ✅ |
| `/kiosk` | Kiosk lấy số thứ tự | ❌ |
| `/display` | Màn hình LED số đang gọi | ❌ |

---

*Thiết kế & phát triển bởi **Nguyễn Quang Huy***
