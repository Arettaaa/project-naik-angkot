import { createContext, useContext } from 'react'

export const DashboardCtx = createContext(null)
export const useDashboard = () => useContext(DashboardCtx)
