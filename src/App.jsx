import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import Layout from '@/components/Layout'
import HomePage from '@/pages/HomePage'
import DisplayPage from '@/pages/DisplayPage'
import KioskPage from '@/pages/KioskPage'
import ReceptionPage from '@/pages/ReceptionPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/"          element={<HomePage />} />
            <Route path="/display"   element={<DisplayPage />} />
            <Route path="/kiosk"     element={<KioskPage />} />
            <Route path="/reception" element={<ReceptionPage />} />
            {/* Catch-all */}
            <Route path="*" element={
              <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-gray-500">
                <span className="text-6xl">404</span>
                <p className="text-lg font-medium">Trang không tồn tại</p>
                <a href="/" className="btn btn-primary">Về trang chủ</a>
              </div>
            } />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
