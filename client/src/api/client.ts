import axios from 'axios'

const api = axios.create({ 
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api' 
})

// Add token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('fa_music_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 errors (unauthorized)
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('fa_music_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
