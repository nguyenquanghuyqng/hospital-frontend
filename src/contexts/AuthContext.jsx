import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { authApi } from '@/services/api'

const AuthContext = createContext(null)

const USER_KEY = 'auth_user'

function loadUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser)

  // Khi app load, nếu đã có token thì refresh profile từ server
  // để lấy clinic_room và các thông tin mới nhất
  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return
    authApi.me()
      .then((profile) => {
        const updated = {
          id: profile.id,
          username: profile.username,
          full_name: profile.full_name,
          role: profile.role,
          clinic_room: profile.clinic_room,
        }
        localStorage.setItem(USER_KEY, JSON.stringify(updated))
        setUser(updated)
      })
      .catch(() => {
        // Token hết hạn hoặc invalid → logout
        localStorage.removeItem('access_token')
        localStorage.removeItem(USER_KEY)
        setUser(null)
      })
  }, [])

  const login = useCallback(async (username, password) => {
    const data = await authApi.login(username, password)
    localStorage.setItem('access_token', data.access_token)
    const profile = {
      id: data.user_id,
      username: data.username,
      full_name: data.full_name,
      role: data.role,
      clinic_room: data.clinic_room,
    }
    localStorage.setItem(USER_KEY, JSON.stringify(profile))
    setUser(profile)
    return profile
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('access_token')
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
