import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 60_000,
})

export default api

// Campaigns
export const getCampaigns = () => api.get('/campaigns/').then(r => r.data)
export const getCampaign = (id: number) => api.get(`/campaigns/${id}`).then(r => r.data)
export const generateCampaign = (industry = 'accounting') =>
  api.post(`/campaigns/generate?industry=${industry}`).then(r => r.data)
export const updateCampaign = (id: number, data: any) =>
  api.patch(`/campaigns/${id}`, data).then(r => r.data)
export const approveCampaign = (id: number) =>
  api.post(`/campaigns/${id}/approve`).then(r => r.data)
export const sendCampaign = (id: number) =>
  api.post(`/campaigns/${id}/send`).then(r => r.data)
export const deleteCampaign = (id: number) =>
  api.delete(`/campaigns/${id}`).then(r => r.data)

// Subscribers
export const getSubscribers = () => api.get('/subscribers/').then(r => r.data)
export const getSubscriberStats = () => api.get('/subscribers/stats').then(r => r.data)
export const createSubscriber = (data: any) => api.post('/subscribers/', data).then(r => r.data)
export const deleteSubscriber = (id: number) => api.delete(`/subscribers/${id}`).then(r => r.data)

// Analytics
export const getOverview = () => api.get('/analytics/overview').then(r => r.data)
export const getCampaignAnalytics = () => api.get('/analytics/campaigns').then(r => r.data)
export const getEventsTimeline = (days = 30) =>
  api.get(`/analytics/events-timeline?days=${days}`).then(r => r.data)
export const getSubscriberGrowth = (days = 90) =>
  api.get(`/analytics/subscriber-growth?days=${days}`).then(r => r.data)
export const getABResults = () => api.get('/analytics/ab-results').then(r => r.data)

// Settings
export const getSettings = () => api.get('/settings/').then(r => r.data)
export const saveSettings = (data: any) => api.post('/settings/', data).then(r => r.data)
