import apiClient from './client'

export interface ProxyControl {
  master_enabled: boolean
  auth_enabled: boolean
  chat_enabled: boolean
  port: number
}

export const proxyControlApi = {
  get: () =>
    apiClient.get<never, ProxyControl>('/api/admin/proxy-control'),

  update: (data: ProxyControl) =>
    apiClient.put('/api/admin/proxy-control', data),

  getConfigPreview: () =>
    apiClient.get<never, string>('/api/admin/proxy-config', {
      responseType: 'text',
    }),
}
